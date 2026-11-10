"""
Data Engine Kiki's House Cleaning — ETL
Lee el Excel operativo de Kiki's y genera tablas limpias y anonimizadas.

Uso:
  python scripts/etl/build_dataset.py <ruta_excel> <carpeta_salida> [fecha_corte YYYY-MM-DD]

Salida (NO se sube al repositorio; la carpeta data/ está en .gitignore):
  visits.csv, weekly_marketing.csv, seed.sql

Privacidad: no se exportan nombres, teléfonos, direcciones completas, correos
ni datos de nómina. El cliente se identifica con un hash del teléfono.
Las reglas marcadas "PROVISIONAL" dependen de validaciones pendientes con Kiki's.
"""
import hashlib, os, re, sys
import pandas as pd

XLSX, OUT = sys.argv[1], sys.argv[2]
CUTOFF = pd.Timestamp(sys.argv[3] if len(sys.argv) > 3 else pd.Timestamp.today().date())
SALT = os.environ.get("KIKIS_HASH_SALT", "kikis-data-engine")
os.makedirs(OUT, exist_ok=True)

# ---------- ciudades ----------
sched = pd.read_excel(XLSX, sheet_name="Schedule")
REGION_NAMES = {1: "Norte", 2: "Oeste", 3: "Este / Dallas"}
city_region = {str(c).strip(): int(r) for c, r in zip(sched["City"], sched["Region"]) if pd.notna(c) and pd.notna(r)}
KNOWN = sorted(city_region, key=len, reverse=True)
CANON = {c.lower(): c for c in KNOWN}
CANON.update({"mckinney": "McKinney", "the colony": "The Colony"})

def parse_city(addr):
    if not isinstance(addr, str):
        return None
    a = addr.lower()
    for c in KNOWN:  # ciudades conocidas, de la más larga a la más corta
        if re.search(r"\b" + re.escape(c.lower()) + r"\b", a):
            return c
    m = re.search(r"([a-z][a-z .']+?),?\s+(tx|texas)\b", a)
    if m:
        name = m.group(1).split(",")[-1].strip()
        words = [w for w in name.split() if not re.search(r"\d", w)]
        name = " ".join(words[-2:]) if words else None
        if name:
            return CANON.get(name.lower(), name.title())
    return None

# ---------- tipo de servicio (validado con Kiki's, doc de consultas v2, preguntas 1-4) ----------
# Se ofrecen Standard, Deep Clean, Move In y Move Out. Una casa parcial (solo planta baja) se vende por horas.
# Comercial, Post Construction y Airbnb son "call for quote". Move In se separa de Deep Clean aunque tenga el mismo precio.
PARTIAL = r"downstairs only|skip upstairs|(1st|first) floor only|upstairs only"
def service_family(desc):
    d = str(desc).lower()
    if d in ("nan", ""):
        return "Sin descripción"
    if re.search(r"post[ -]?(construction|remodel)", d):
        return "Post Construction"
    if "commercial" in d or "office" in d:
        return "Comercial"
    if "airbnb" in d:
        return "Airbnb"
    if "move out" in d or "moveout" in d:
        return "Move Out"
    if "move in" in d:
        return "Move In"
    if "deep" in d:
        return "Deep Clean"
    if re.search(r"organiz|\borg\b", d):
        return "Organizing"
    if re.search(PARTIAL, d) and "deep" not in d:
        return "Por horas"
    if re.search(r"\d+\s*(hr|hrs|hour|hours)\b|cleaners?\s+\d|\bpp\b|people|person|hourly", d):
        return "Por horas"
    if "standard" in d or "eco" in d or "regular" in d:
        return "Standard"
    return "Otro"

ADDONS = {
    "addon_laundry": r"laundry|lavander",
    "addon_baseboards": r"baseboard",
    "addon_windows": r"window",
    "addon_oven": r"oven",
    "addon_fridge": r"fridge|refrigerator",
    "addon_cabinets": r"cabinet",
}

FREQ = {"W": "Semanal", "Bi-W": "Quincenal", "M": "Mensual", "DND": "DND (no contactar)"}

def size_bucket(bd):
    bd = pd.to_numeric(bd, errors="coerce")
    if pd.isna(bd):
        return "Sin dato"
    b = int(bd)
    if b <= 1:
        return "1 recámara o estudio"
    if b >= 5:
        return "5+ recámaras"
    return f"{b} recámaras"

def norm_phone(p):
    if pd.isna(p):
        return None
    digits = re.sub(r"\D", "", str(p).split(".")[0])
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) != 10 or digits.startswith("999999"):
        return None  # teléfonos de relleno
    return digits

def hid(x):
    return hashlib.sha256((SALT + x).encode()).hexdigest()[:16]

# ---------- servicios ----------
c = pd.read_excel(XLSX, sheet_name="CONTACTS")
c = c[c["Date"].notna()].copy()
c["phone"] = c["Phone"].map(norm_phone)
c["client_key"] = c["phone"].fillna("name:" + c["Name"].astype(str).str.strip().str.lower())
c["client_id"] = c["client_key"].map(hid)
c["city"] = c["Address"].map(parse_city)
c["region"] = c["city"].map(lambda x: REGION_NAMES.get(city_region.get(x)) if x else None)
c["service_family"] = c["Extras"].map(service_family)
for col, pat in ADDONS.items():
    c[col] = c["Extras"].astype(str).str.contains(pat, case=False, regex=True)
c["frequency"] = c["FREQ"].map(FREQ).fillna("Sin dato")
c["size_bucket"] = c["Bd"].map(size_bucket)
c["status"] = (c["Date"] < CUTOFF).map({True: "realizado", False: "agendado"})
pay = c[["Pay1", "Pay2"]].apply(pd.to_numeric, errors="coerce").fillna(0).sum(axis=1)
# Desde ~marzo 2026 "Pay1" guarda el pago SEMANAL de cada limpiadora en una sola fila, no el pago por servicio.
# Solo se conserva como costo por servicio cuando es plausible (mayor a 0 y no más de 1.2× el precio).
price_num = pd.to_numeric(c["Price"], errors="coerce")
c["labor_cost"] = pay.where((pay > 0) & (pay <= price_num * 1.2))

done = c[c["status"] == "realizado"]
first_date = done.groupby("client_id")["Date"].min()
c["client_first_date"] = c["client_id"].map(first_date)
c["is_first_visit"] = (c["status"] == "realizado") & (c["Date"] == c["client_first_date"])

# fuente del cliente. "Cold Call" NO es fuente: LEAD = cliente que no ha repetido, CALL = cliente que solo necesita agendar
# (respuesta de Kiki's, pregunta 6). La fuente solo se identifica cruzando con Thumbtack y Melissa.com.
fv = c[c["is_first_visit"]].drop_duplicates("client_id")
src = pd.Series("Sin fuente identificada", index=fv["client_id"].values)
# cruce con Thumbtack (nombre exacto) y Melissa.com (teléfono)
tt = pd.read_excel(XLSX, sheet_name="leads-inbox (2)")
tt_names = set(tt["Customer"].dropna().astype(str).str.strip().str.lower())
mel = pd.read_excel(XLSX, sheet_name="Melissa.com")
mel_phones = set(mel["Phone"].map(norm_phone).dropna())
name_by_client = fv.set_index("client_id")["Name"].astype(str).str.strip().str.lower()
phone_by_client = fv.set_index("client_id")["phone"]
for cid in src.index:
    if phone_by_client.get(cid) in mel_phones:
        src[cid] = "Mudanzas (Melissa.com)"
    elif name_by_client.get(cid) in tt_names:
        src[cid] = "Thumbtack"
c["client_source"] = c["client_id"].map(src).fillna("Sin fuente identificada")

visits = pd.DataFrame({
    "visit_id": range(1, len(c) + 1),  # el ID del Excel tiene duplicados
    "visit_date": c["Date"].dt.date,
    "week_start": (c["Date"] - pd.to_timedelta((c["Date"].dt.weekday + 1) % 7, unit="D")).dt.date,
    "year": c["YY"].astype(int),
    "week": c["WW"].astype(int),
    "status": c["status"],
    "client_id": c["client_id"],
    "is_first_visit": c["is_first_visit"],
    "client_first_date": c["client_first_date"].dt.date,
    "client_source": c["client_source"],
    "city": c["city"].fillna("Sin ciudad"),
    "region": c["region"].fillna("Sin región"),
    "service_family": c["service_family"],
    "frequency": c["frequency"],
    "bedrooms": pd.to_numeric(c["Bd"], errors="coerce"),
    "bathrooms": pd.to_numeric(c["Ba"], errors="coerce"),
    "size_bucket": c["size_bucket"],
    "price": pd.to_numeric(c["Price"], errors="coerce"),
    "tip": pd.to_numeric(c["Tip"], errors="coerce"),
    "total": pd.to_numeric(c["Total"], errors="coerce"),
    "labor_cost": c["labor_cost"],
    "payment_code": c["Cash"].astype(str).str.upper().replace({"NAN": None}),
    **{k: c[k] for k in ADDONS},
})
visits.to_csv(f"{OUT}/visits.csv", index=False)

# ---------- marketing semanal ----------
k = pd.read_excel(XLSX, sheet_name="KPI")
k = k[k["YY"].notna() & k["WW"].notna()]
weekly = pd.DataFrame({
    "year": k["YY"].astype(int), "week": k["WW"].astype(int),
    "marketing_spend": -pd.to_numeric(k["Marketing"], errors="coerce").fillna(0),
    "sales": pd.to_numeric(k["Sales"], errors="coerce"),
    "labor": -pd.to_numeric(k["Labor"], errors="coerce").fillna(0),
})
# semana calendario (domingo a sábado) de cada semana del KPI, tomada de los servicios
wk_map = visits.groupby(["year", "week"])["week_start"].agg(lambda x: x.mode().iloc[0])
weekly["week_start"] = [wk_map.get((y, w)) for y, w in zip(weekly["year"], weekly["week"])]
weekly = weekly[weekly["week_start"].notna()].drop_duplicates("week_start")
weekly.to_csv(f"{OUT}/weekly_marketing.csv", index=False)
pd.DataFrame([{"key": "data_cutoff", "value": str(CUTOFF.date())}]).to_csv(f"{OUT}/meta.csv", index=False)

# ---------- operación semanal (capacidad) ----------
# Horas-persona estimadas por servicio:
#  1) si la descripción dice "N cleaners M hours" / "M HR N PP", se usa N×M;
#  2) si no, horas de la lista vigente por recámaras/baños × multiplicador de la hoja AUTOMATION
#     (Standard 1, Deep Clean 1.5, Move Out/Move In 1.75).
LIST_HOURS = {(1, 1): 3.0, (2, 1): 3.5, (2, 2): 4.0, (3, 2): 4.5, (3, 3): 5.0, (4, 3): 5.5, (4, 4): 6.0, (5, 4): 7.0, (5, 5): 8.0}
MULT = {"Deep Clean": 1.5, "Move Out": 1.75, "Move In": 1.75}

def list_hours(bd, ba):
    bd, ba = pd.to_numeric(bd, errors="coerce"), pd.to_numeric(ba, errors="coerce")
    if pd.isna(bd) or bd <= 0:
        return 4.5  # mediana de la lista
    b = int(min(5, max(1, bd)))
    bath = int(max(1, ba if not pd.isna(ba) else 1))
    opts = [(k, h) for k, h in LIST_HOURS.items() if k[0] == b and k[1] <= bath] or [(k, h) for k, h in LIST_HOURS.items() if k[0] == b]
    return opts[-1][1]

def est_hours(row):
    d = str(row["Extras"])
    m = re.search(r"(\d+)\s*(?:cleaners?|pp|people|persons?)\s*(\d+(?:\.\d+)?)\s*(?:hr|hrs|hour|hours)", d, re.I)
    if m:
        return float(m.group(1)) * float(m.group(2))
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:hr|hrs|hour|hours)\s*(\d+)\s*(?:pp|people|persons?|cleaners?)", d, re.I)
    if m:
        return float(m.group(1)) * float(m.group(2))
    return list_hours(row["Bd"], row["Ba"]) * MULT.get(row["service_family"], 1.0)

c["est_hours"] = c.apply(est_hours, axis=1)
c["week_start_dt"] = c["Date"] - pd.to_timedelta((c["Date"].dt.weekday + 1) % 7, unit="D")
ops_src = c[c["status"] == "realizado"]
ops = ops_src.groupby("week_start_dt").agg(
    services=("ID", "size"),
    clients=("client_id", "nunique"),
    est_hours=("est_hours", "sum"),
    # limpiadoras distintas registradas en la semana (nombres no se exportan, solo el conteo)
    active_cleaners=("Cleaner", lambda x: x.dropna().astype(str).str.strip().str.lower().nunique()),
).reset_index().rename(columns={"week_start_dt": "week_start"})
ops["week_start"] = ops["week_start"].dt.date
ops["est_hours"] = ops["est_hours"].round(1)
ops.to_csv(f"{OUT}/weekly_ops.csv", index=False)

# ---------- Thumbtack: embudo mensual (solo conteos, sin nombres) ----------
tt["month"] = pd.to_datetime(tt["Lead received"], errors="coerce").dt.to_period("M").astype(str)
job = tt["Job type"].astype(str).str.lower()
tt_m = pd.DataFrame({
    "month": tt["month"],
    "leads": 1,
    "charged": (tt["Charge status"] == "Charged").astype(int),
    "credited": (tt["Charge status"] == "Credited").astype(int),
    "phone": (tt["Lead type"] == "Phone call").astype(int),
    "job_standard": job.str.contains("standard").astype(int),
    "job_deep": job.str.contains("deep").astype(int),
    "job_moving": job.str.contains("moving").astype(int),
    "job_office": job.str.contains("office").astype(int),
}).groupby("month").sum().reset_index()
tt_clients = fv[fv["client_id"].map(src) == "Thumbtack"].copy()
tt_clients["month"] = tt_clients["Date"].dt.to_period("M").astype(str)
tt_m["clients_matched"] = tt_m["month"].map(tt_clients.groupby("month").size()).fillna(0).astype(int)
tt_m = tt_m[tt_m["month"] != "NaT"]
tt_m.to_csv(f"{OUT}/thumbtack_monthly.csv", index=False)

# ---------- seed.sql ----------
def lit(v):
    if v is None or (isinstance(v, float) and pd.isna(v)) or v is pd.NaT:
        return "null"
    if isinstance(v, (bool,)) or str(type(v)).endswith("bool_'>"):
        return "true" if v else "false"
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return repr(float(v)) if isinstance(v, float) else str(v)
    return "'" + str(v).replace("'", "''") + "'"

with open(f"{OUT}/seed.sql", "w") as f:
    f.write("-- Data Engine Kiki's · carga de datos (generado por build_dataset.py)\nbegin;\ntruncate visits, weekly_marketing, meta;\n")
    cols = list(visits.columns)
    rows = visits.astype(object).where(visits.notna(), None).values.tolist()
    for i in range(0, len(rows), 500):
        f.write(f"insert into visits ({', '.join(cols)}) values\n")
        f.write(",\n".join("(" + ", ".join(lit(v) for v in r) + ")" for r in rows[i:i+500]) + ";\n")
    wcols = list(weekly.columns)
    f.write(f"insert into weekly_marketing ({', '.join(wcols)}) values\n")
    f.write(",\n".join("(" + ", ".join(lit(v) for v in r) + ")" for r in weekly.astype(object).values.tolist()) + ";\n")
    f.write(f"insert into meta (key, value) values ('data_cutoff', '{CUTOFF.date()}');\n")
    f.write("commit;\n")

# ---------- resumen ----------
print("servicios", len(visits), "| realizados", (visits.status == "realizado").sum(), "| agendados", (visits.status == "agendado").sum())
print("clientes", visits.client_id.nunique())
print("familias", visits.service_family.value_counts().to_dict())
print("frecuencia", visits.frequency.value_counts().to_dict())
print("fuente (clientes)", visits.drop_duplicates("client_id").client_source.value_counts().to_dict())
print("thumbtack", tt_m[["leads","charged","clients_matched"]].sum().to_dict())
print("sin ciudad", (visits.city == "Sin ciudad").sum(), "| ciudades", visits.city.nunique())
print("top ciudades", visits.city.value_counts().head(12).to_dict())
