import { WINDOW, avg, weekStartOf, weeklyClients, type Visit, type WeekMarketing, type WeekOps } from "./metrics";

const DAY = 86_400_000;
const t = (d: string) => new Date(d + "T00:00:00Z").getTime();
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const DOW = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export type SeasonWeek = { week: string; clients: number; nuevos: number; sales: number | null; ma4: number | null; ratio: number | null };

/** Serie semanal completa (semanas completas) con promedio móvil de 4 semanas previas. */
export function seasonSeries(visits: Visit[], marketing: WeekMarketing[], cutoff: string): SeasonWeek[] {
  const rows = weeklyClients(visits, cutoff);
  const sales = new Map(marketing.map((m) => [m.week_start, m.sales ?? null]));
  // rellenar semanas sin servicios
  if (!rows.length) return [];
  const first = t(rows[0].week);
  const last = t(weekStartOf(cutoff)) - 7 * DAY;
  const by = new Map(rows.map((r) => [r.week, r]));
  const out: SeasonWeek[] = [];
  for (let w = first; w <= last; w += 7 * DAY) {
    const week = new Date(w).toISOString().slice(0, 10);
    const r = by.get(week);
    out.push({ week, clients: r?.clients ?? 0, nuevos: r?.nuevos ?? 0, sales: sales.get(week) ?? null, ma4: null, ratio: null });
  }
  out.forEach((r, i) => {
    if (i < 4) return;
    const prev = avg(out.slice(i - 4, i).map((x) => x.clients));
    r.ma4 = prev;
    r.ratio = prev ? r.clients / prev : null;
  });
  return out;
}

/**
 * Índice estacional por mes del año. Se calcula dentro de cada año (promedio del mes ÷ promedio de ese año)
 * y luego se promedia entre años, para que el crecimiento del negocio no se confunda con temporada.
 * Se excluye el primer mes de operación (arranque).
 */
export function monthIndex(series: SeasonWeek[]) {
  const launch = series[0]?.week.slice(0, 7);
  const usable = series.filter((s) => s.week.slice(0, 7) !== launch);
  const years = [...new Set(usable.map((s) => s.week.slice(0, 4)))];
  const yearAvg = new Map(years.map((y) => [y, avg(usable.filter((s) => s.week.startsWith(y)).map((s) => s.clients))]));
  return MONTHS.map((label, m) => {
    const perYear: number[] = [];
    for (const y of years) {
      const ws = usable.filter((s) => s.week.startsWith(y) && new Date(s.week + "T00:00:00Z").getUTCMonth() === m);
      if (ws.length >= 3 && yearAvg.get(y)) perYear.push(avg(ws.map((w) => w.clients)) / yearAvg.get(y)!);
    }
    return { label, index: perYear.length ? avg(perYear) : null, years: perYear.length };
  });
}

/** Mismo mes, año contra año. Solo meses con 3+ semanas en ambos años; excluye el mes de arranque. */
export function yearOverYear(series: SeasonWeek[]) {
  const launch = series[0]?.week.slice(0, 7);
  const byYM = new Map<string, number[]>();
  for (const s of series) {
    const k = s.week.slice(0, 7);
    if (k === launch) continue;
    if (!byYM.has(k)) byYM.set(k, []);
    byYM.get(k)!.push(s.clients);
  }
  const out: { label: string; prev: number; curr: number; growth: number }[] = [];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, "0");
    const a = byYM.get(`2025-${mm}`), b = byYM.get(`2026-${mm}`);
    if (a && b && a.length >= 3 && b.length >= 3) {
      const prev = avg(a), curr = avg(b);
      out.push({ label: MONTHS[m - 1], prev, curr, growth: prev ? curr / prev - 1 : 0 });
    }
  }
  return out;
}

/** Crecimiento total de los meses comparables (suma 2026 ÷ suma 2025 − 1). */
export function yoyTotal(rows: { prev: number; curr: number }[]) {
  const p = rows.reduce((a, r) => a + r.prev, 0);
  const c = rows.reduce((a, r) => a + r.curr, 0);
  return p ? c / p - 1 : null;
}

export function dayOfWeek(visits: Visit[], cutoff: string, period: "12w" | "all") {
  const end = t(weekStartOf(cutoff));
  const from = period === "12w" ? end - WINDOW * 7 * DAY : -Infinity;
  const counts = Array(7).fill(0);
  for (const v of visits) {
    if (v.status !== "realizado") continue;
    const tt = t(v.week_start);
    if (tt < from || tt >= end) continue;
    counts[new Date(v.visit_date + "T00:00:00Z").getUTCDay()]++;
  }
  const total = counts.reduce((a, b) => a + b, 0);
  // Lunes a domingo
  return [1, 2, 3, 4, 5, 6, 0].map((d) => ({ day: DOW[d], value: counts[d], pct: total ? counts[d] / total : 0 }));
}

/** Semanas que se desvían más de ±25% de su promedio de las 4 semanas previas. */
export function atypicalWeeks(series: SeasonWeek[], threshold = 0.25) {
  return series.filter((s) => s.ratio !== null && s.ma4! >= 5 && Math.abs(s.ratio - 1) >= threshold);
}

// ---------- operación ----------
export function opsSummary(ops: WeekOps[], marketing: WeekMarketing[], cutoff: string) {
  const end = t(weekStartOf(cutoff));
  const from = end - WINDOW * 7 * DAY;
  const win = ops.filter((o) => t(o.week_start) >= from && t(o.week_start) < end);
  const labor = new Map(marketing.map((m) => [m.week_start, m.labor ?? 0]));
  const cleaners = avg(win.map((o) => o.active_cleaners));
  const hours = avg(win.map((o) => o.est_hours));
  const services = avg(win.map((o) => o.services));
  const clients = avg(win.map((o) => o.clients));
  const payroll = avg(win.map((o) => labor.get(o.week_start) ?? 0));
  return {
    weeks: win,
    cleaners,
    hours,
    services,
    clients,
    payroll,
    hoursPerCleaner: cleaners ? hours / cleaners : 0,
    servicesPerCleaner: cleaners ? services / cleaners : 0,
    hoursPerClient: clients ? hours / clients : 0,
    costPerHour: hours ? payroll / hours : 0,
  };
}

export function capacityPlan(goalClients: number, hoursPerClient: number, hoursPerCleaner: number, currentCleaners: number, costPerHour: number) {
  const hoursNeeded = goalClients * hoursPerClient;
  const cleanersNeeded = hoursPerCleaner ? hoursNeeded / hoursPerCleaner : 0;
  return {
    hoursNeeded,
    cleanersNeeded,
    extraCleaners: Math.max(0, Math.ceil(cleanersNeeded) - Math.round(currentCleaners)),
    payrollNeeded: hoursNeeded * costPerHour,
  };
}
