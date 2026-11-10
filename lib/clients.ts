import { ALL, daysBetween, type Filters, type Visit } from "./metrics";

export type Client = {
  id: string;
  first: string;
  last: string;
  visits: number;
  revenue: number;
  city: string;
  service: string;
  source: string;
  frequency: string;
};

/** Una fila por cliente, con sus servicios realizados. Ciudad, servicio y frecuencia se toman de su primera visita. */
export function buildClients(visits: Visit[]): Client[] {
  const map = new Map<string, Client>();
  const sorted = visits.filter((v) => v.status === "realizado").sort((a, b) => a.visit_date.localeCompare(b.visit_date));
  for (const v of sorted) {
    let c = map.get(v.client_id);
    if (!c) {
      c = {
        id: v.client_id, first: v.visit_date, last: v.visit_date, visits: 0, revenue: 0,
        city: v.city ?? "Sin ciudad", service: v.service_family ?? "Sin dato",
        source: v.client_source ?? "Sin fuente identificada", frequency: v.frequency ?? "Sin dato",
      };
      map.set(v.client_id, c);
    }
    c.last = v.visit_date;
    c.visits += 1;
    c.revenue += v.price ?? 0;
  }
  return [...map.values()];
}

export function filterClients(clients: Client[], f: Filters) {
  return clients.filter((c) => (f.city === ALL || c.city === f.city) && (f.service === ALL || c.service === f.service));
}

export const ACTIVE_DAYS = 60;
export const LOST_DAYS = 120;

export function clientStatus(c: Client, cutoff: string, scheduled: Set<string>) {
  if (scheduled.has(c.id)) return "Activo";
  const d = daysBetween(c.last, cutoff);
  if (d <= ACTIVE_DAYS) return "Activo";
  if (d <= LOST_DAYS) return "En riesgo";
  return "Perdido";
}

const monthOf = (d: string) => d.slice(0, 7);
const addMonths = (m: string, k: number) => {
  const [y, mo] = m.split("-").map(Number);
  const t = new Date(Date.UTC(y, mo - 1 + k, 1));
  return t.toISOString().slice(0, 7);
};
const monthDiff = (a: string, b: string) => {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
};

export type CohortRow = { cohort: string; size: number; cells: (number | null)[] };

/** % de clientes de cada cohorte (mes de entrada) con al menos un servicio en el mes k. Solo meses completos. */
export function cohorts(visits: Visit[], clients: Client[], cutoff: string, maxK = 12): CohortRow[] {
  const ids = new Set(clients.map((c) => c.id));
  const firstMonth = new Map(clients.map((c) => [c.id, monthOf(c.first)]));
  const lastComplete = addMonths(monthOf(cutoff), -1);
  const activeBy = new Map<string, Set<string>>(); // "cohort|k" -> clientes
  for (const v of visits) {
    if (v.status !== "realizado" || !ids.has(v.client_id)) continue;
    const cm = firstMonth.get(v.client_id)!;
    const k = monthDiff(cm, monthOf(v.visit_date));
    if (k < 0 || k > maxK) continue;
    const key = `${cm}|${k}`;
    if (!activeBy.has(key)) activeBy.set(key, new Set());
    activeBy.get(key)!.add(v.client_id);
  }
  const sizes = new Map<string, number>();
  for (const c of clients) sizes.set(monthOf(c.first), (sizes.get(monthOf(c.first)) ?? 0) + 1);
  return [...sizes.entries()]
    .filter(([m]) => m <= lastComplete)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cohort, size]) => ({
      cohort,
      size,
      cells: Array.from({ length: maxK + 1 }, (_, k) =>
        addMonths(cohort, k) > lastComplete ? null : (activeBy.get(`${cohort}|${k}`)?.size ?? 0) / size
      ),
    }));
}

/** Promedio ponderado por tamaño de cohorte, para cada mes k. */
export function retentionCurve(rows: CohortRow[], maxK = 12) {
  return Array.from({ length: maxK + 1 }, (_, k) => {
    let num = 0, den = 0;
    for (const r of rows) {
      const v = r.cells[k];
      if (v === null || v === undefined) continue;
      num += v * r.size;
      den += r.size;
    }
    return { k, pct: den ? num / den : null, n: den };
  });
}

export function median(xs: number[]) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Días entre visitas consecutivas de un mismo cliente, por frecuencia. */
export function gapsByFrequency(visits: Visit[], ids: Set<string>) {
  const byClient = new Map<string, Visit[]>();
  for (const v of visits) {
    if (v.status !== "realizado" || !ids.has(v.client_id)) continue;
    if (!byClient.has(v.client_id)) byClient.set(v.client_id, []);
    byClient.get(v.client_id)!.push(v);
  }
  const gaps = new Map<string, number[]>();
  for (const list of byClient.values()) {
    list.sort((a, b) => a.visit_date.localeCompare(b.visit_date));
    for (let i = 1; i < list.length; i++) {
      const f = list[i].frequency ?? "Sin dato";
      const g = daysBetween(list[i - 1].visit_date, list[i].visit_date);
      if (g <= 0) continue;
      if (!gaps.has(f)) gaps.set(f, []);
      gaps.get(f)!.push(g);
    }
  }
  return gaps;
}

export const VISIT_BUCKETS = [
  { name: "1 visita", min: 1, max: 1 },
  { name: "2 a 7 visitas", min: 2, max: 7 },
  { name: "8 a 22 visitas", min: 8, max: 22 },
  { name: "23 o más visitas", min: 23, max: Infinity },
];
