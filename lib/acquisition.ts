import { avg, weekStartOf, type Visit, type WeekMarketing } from "./metrics";

export type ThumbtackMonth = {
  month: string; leads: number; charged: number; credited: number; phone: number;
  job_standard: number; job_deep: number; job_moving: number; job_office: number; clients_matched: number;
};

const DAY = 86_400_000;
const t = (d: string) => new Date(d + "T00:00:00Z").getTime();

/** Semanas completas con clientes nuevos, pauta y CAC (desde la primera semana con pauta). */
export function acquisitionWeeks(visits: Visit[], marketing: WeekMarketing[], cutoff: string) {
  const end = t(weekStartOf(cutoff));
  const news = new Map<string, Set<string>>();
  const firstRevenue = new Map<string, number>();
  for (const v of visits) {
    if (v.status !== "realizado" || !v.is_first_visit) continue;
    if (!news.has(v.week_start)) news.set(v.week_start, new Set());
    news.get(v.week_start)!.add(v.client_id);
    firstRevenue.set(v.week_start, (firstRevenue.get(v.week_start) ?? 0) + (v.price ?? 0));
  }
  return marketing
    .filter((m) => t(m.week_start) < end)
    .sort((a, b) => a.week_start.localeCompare(b.week_start))
    .map((m) => {
      const nuevos = news.get(m.week_start)?.size ?? 0;
      const spend = m.marketing_spend ?? 0;
      return { week: m.week_start, nuevos, spend, cac: nuevos ? spend / nuevos : null, revenue: firstRevenue.get(m.week_start) ?? 0 };
    });
}

/** Regresión lineal simple: clientes nuevos por semana ~ pauta de la semana. */
export function spendRegression(weeks: { nuevos: number; spend: number }[]) {
  const pts = weeks.filter((w) => w.spend > 0);
  const n = pts.length;
  if (n < 8) return null;
  const mx = avg(pts.map((p) => p.spend));
  const my = avg(pts.map((p) => p.nuevos));
  let sxy = 0, sxx = 0, syy = 0;
  for (const p of pts) {
    sxy += (p.spend - mx) * (p.nuevos - my);
    sxx += (p.spend - mx) ** 2;
    syy += (p.nuevos - my) ** 2;
  }
  const b = sxx ? sxy / sxx : 0;
  const a = my - b * mx;
  const r2 = sxx && syy ? (sxy * sxy) / (sxx * syy) : 0;
  // error estándar de la pendiente, para decir si la relación es confiable
  const sse = pts.reduce((acc, p) => acc + (p.nuevos - (a + b * p.spend)) ** 2, 0);
  const se = n > 2 && sxx ? Math.sqrt(sse / (n - 2) / sxx) : 0;
  return { a, b, r2, n, t: se ? b / se : 0, marginalCac: b > 0 ? 1 / b : null, points: pts, meanSpend: mx, meanNew: my };
}

/**
 * Calidad del cliente nuevo según su primer servicio: cuántos hacen una segunda visita en 90 días
 * y cuánto han facturado. Solo clientes cuya primera visita tiene al menos 90 días.
 */
export function entryQuality(visits: Visit[], cutoff: string) {
  const byClient = new Map<string, Visit[]>();
  for (const v of visits) {
    if (v.status !== "realizado") continue;
    if (!byClient.has(v.client_id)) byClient.set(v.client_id, []);
    byClient.get(v.client_id)!.push(v);
  }
  const limit = t(cutoff) - 90 * DAY;
  const groups = new Map<string, { n: number; second90: number; revenue: number; gaps: number[] }>();
  for (const list of byClient.values()) {
    list.sort((a, b) => a.visit_date.localeCompare(b.visit_date));
    const first = list[0];
    if (t(first.visit_date) > limit) continue;
    const fam = first.service_family ?? "Sin dato";
    if (!groups.has(fam)) groups.set(fam, { n: 0, second90: 0, revenue: 0, gaps: [] });
    const g = groups.get(fam)!;
    g.n++;
    g.revenue += list.reduce((a, v) => a + (v.price ?? 0), 0);
    if (list[1]) {
      const gap = (t(list[1].visit_date) - t(first.visit_date)) / DAY;
      g.gaps.push(gap);
      if (gap <= 90) g.second90++;
    }
  }
  const rows = [...groups.entries()].map(([family, g]) => ({
    family, n: g.n, conv90: g.n ? g.second90 / g.n : 0, revenuePerClient: g.n ? g.revenue / g.n : 0,
  })).sort((a, b) => b.n - a.n);
  const total = rows.reduce((a, r) => a + r.n, 0);
  const conv = total ? rows.reduce((a, r) => a + r.conv90 * r.n, 0) / total : 0;
  const allGaps = [...groups.values()].flatMap((g) => g.gaps).sort((a, b) => a - b);
  return { rows, total, conv90: conv, medianGap: allGaps.length ? allGaps[Math.floor(allGaps.length / 2)] : null };
}

/** Mezcla de primer servicio de los clientes nuevos en una ventana de semanas. */
export function entryMix(visits: Visit[], cutoff: string, weeks: number | null) {
  const end = t(weekStartOf(cutoff));
  const from = weeks ? end - weeks * 7 * DAY : -Infinity;
  const m = new Map<string, number>();
  let total = 0;
  for (const v of visits) {
    if (v.status !== "realizado" || !v.is_first_visit) continue;
    const w = t(v.week_start);
    if (w < from || w >= end) continue;
    const k = v.service_family ?? "Sin dato";
    m.set(k, (m.get(k) ?? 0) + 1);
    total++;
  }
  return [...m.entries()].map(([name, value]) => ({ name, value, pct: total ? value / total : 0 })).sort((a, b) => b.value - a.value);
}

/**
 * "LEAD" en el Excel de Kiki's: cliente que ya tuvo su primera visita y no ha repetido.
 * Se cuentan los de los últimos 90 días, sin servicio agendado y sin marca DND: son la bolsa de segunda visita.
 */
export function secondVisitPipeline(visits: Visit[], cutoff: string) {
  const scheduled = new Set(visits.filter((v) => v.status === "agendado").map((v) => v.client_id));
  const byClient = new Map<string, Visit[]>();
  for (const v of visits) {
    if (v.status !== "realizado") continue;
    if (!byClient.has(v.client_id)) byClient.set(v.client_id, []);
    byClient.get(v.client_id)!.push(v);
  }
  const since = t(cutoff) - 90 * DAY;
  let pool = 0, poolMoveOut = 0, value = 0;
  for (const [id, list] of byClient) {
    if (list.length !== 1 || scheduled.has(id)) continue;
    const v = list[0];
    if (t(v.visit_date) < since || v.frequency?.startsWith("DND")) continue;
    pool++;
    if (v.service_family === "Move Out") poolMoveOut++;
    value += v.price ?? 0;
  }
  return { pool, poolMoveOut, avgTicket: pool ? value / pool : 0 };
}

export function thumbtackSummary(rows: ThumbtackMonth[]) {
  const s = (k: keyof ThumbtackMonth) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const leads = s("leads");
  return {
    months: rows.length, leads, charged: s("charged"), credited: s("credited"), phone: s("phone"),
    jobs: [
      { name: "Standard", value: s("job_standard") },
      { name: "Deep clean", value: s("job_deep") },
      { name: "Mudanza", value: s("job_moving") },
      { name: "Oficina", value: s("job_office") },
    ].map((j) => ({ ...j, pct: leads ? j.value / leads : 0 })),
    matched: s("clients_matched"),
    perMonth: rows.length ? leads / rows.length : 0,
    first: rows[0]?.month ?? null, last: rows[rows.length - 1]?.month ?? null,
  };
}
