export type Visit = {
  visit_id: number;
  visit_date: string;
  week_start: string;
  status: "realizado" | "agendado";
  client_id: string;
  is_first_visit: boolean;
  client_source: string | null;
  city: string | null;
  region: string | null;
  service_family: string | null;
  frequency: string | null;
  size_bucket: string | null;
  price: number | null;
  tip: number | null;
  total: number | null;
  labor_cost: number | null;
  client_first_date: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  addon_laundry: boolean | null;
  addon_baseboards: boolean | null;
  addon_windows: boolean | null;
  addon_oven: boolean | null;
  addon_fridge: boolean | null;
  addon_cabinets: boolean | null;
};

export type WeekMarketing = { week_start: string; marketing_spend: number | null; sales: number | null; labor?: number | null };

/** Pago por servicio confiable: solo registros donde Pay1 es por servicio (hasta ~marzo 2026). */
export const hasLabor = (v: Visit) => (v.labor_cost ?? 0) > 0 && (v.price ?? 0) > 0 && v.labor_cost! <= v.price! * 1.2;

export type WeekOps = { week_start: string; services: number; clients: number; est_hours: number; active_cleaners: number };

export type Filters = { city: string; service: string; period: "12w" | "all" };

export const ALL = "Todas";
export const WINDOW = 12;

const DAY = 86_400_000;
const toTime = (d: string) => new Date(d + "T00:00:00Z").getTime();

export function weekStartOf(date: string) {
  const t = new Date(date + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() - t.getUTCDay()); // domingo
  return t.toISOString().slice(0, 10);
}

export function applyFilters(visits: Visit[], f: Filters) {
  return visits.filter(
    (v) => (f.city === ALL || v.city === f.city) && (f.service === ALL || v.service_family === f.service)
  );
}

export type WeekRow = { week: string; clients: number; nuevos: number; recurrentes: number; ingresosNuevos: number };

/** Clientes distintos por semana (solo servicios realizados, solo semanas completas). */
export function weeklyClients(visits: Visit[], cutoff: string): WeekRow[] {
  const cutoffWeek = toTime(weekStartOf(cutoff));
  const map = new Map<string, { all: Set<string>; nuevos: Set<string>; ingresosNuevos: number }>();
  for (const v of visits) {
    if (v.status !== "realizado" || toTime(v.week_start) >= cutoffWeek) continue;
    let w = map.get(v.week_start);
    if (!w) map.set(v.week_start, (w = { all: new Set(), nuevos: new Set(), ingresosNuevos: 0 }));
    w.all.add(v.client_id);
    if (v.is_first_visit) {
      w.nuevos.add(v.client_id);
      w.ingresosNuevos += v.price ?? 0;
    }
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, w]) => ({
      week,
      clients: w.all.size,
      nuevos: w.nuevos.size,
      recurrentes: w.all.size - w.nuevos.size,
      ingresosNuevos: w.ingresosNuevos,
    }));
}

export function lastWeeks(rows: WeekRow[], cutoff: string, n = WINDOW) {
  // Rellena semanas sin servicios con cero para no inflar promedios con filtros.
  const end = toTime(weekStartOf(cutoff)) - 7 * DAY;
  const byWeek = new Map(rows.map((r) => [r.week, r]));
  const out: WeekRow[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const week = new Date(end - i * 7 * DAY).toISOString().slice(0, 10);
    out.push(byWeek.get(week) ?? { week, clients: 0, nuevos: 0, recurrentes: 0, ingresosNuevos: 0 });
  }
  return out;
}

export const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function marketingAvg(mk: WeekMarketing[], weeks: string[]) {
  const set = new Set(weeks);
  return avg(mk.filter((m) => set.has(m.week_start)).map((m) => m.marketing_spend ?? 0));
}

/** Agendados por adelantado: clientes distintos por semana futura (próximas n semanas). */
export function scheduledAhead(visits: Visit[], cutoff: string, n = 8) {
  const start = toTime(weekStartOf(cutoff));
  const out: { week: string; clients: number }[] = [];
  for (let i = 0; i < n; i++) {
    const week = new Date(start + i * 7 * DAY).toISOString().slice(0, 10);
    const set = new Set(visits.filter((v) => v.status === "agendado" && v.week_start === week).map((v) => v.client_id));
    out.push({ week, clients: set.size });
  }
  return out;
}

/** Distribución por categoría, en servicios realizados del periodo. */
export function distribution(visits: Visit[], key: keyof Visit, cutoff: string, period: Filters["period"]) {
  const end = toTime(weekStartOf(cutoff));
  const from = period === "12w" ? end - WINDOW * 7 * DAY : -Infinity;
  const counts = new Map<string, number>();
  for (const v of visits) {
    const t = toTime(v.week_start);
    if (v.status !== "realizado" || t < from || t >= end) continue;
    const k = String(v[key] ?? "Sin dato");
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value, pct: total ? value / total : 0 }));
}

export const fmtInt = (n: number) => Math.round(n).toLocaleString("es-MX");
export const fmt1 = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
export const fmtUsd = (n: number) => "USD " + Math.round(n).toLocaleString("es-MX");
export const fmtMonth = (m: string) =>
  new Date(m + "-01T00:00:00Z").toLocaleDateString("es-MX", { month: "short", year: "2-digit", timeZone: "UTC" });
export const daysBetween = (a: string, b: string) => Math.round((toTime(b) - toTime(a)) / DAY);
export const fmtPct = (n: number, d = 0) =>
  (n * 100).toLocaleString("es-MX", { maximumFractionDigits: d, minimumFractionDigits: d }) + "%";
export const fmtWeek = (w: string) =>
  new Date(w + "T00:00:00Z").toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "UTC" });
