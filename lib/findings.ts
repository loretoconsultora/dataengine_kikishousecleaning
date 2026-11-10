import {
  ALL, avg, hasLabor, lastWeeks, marketingAvg, weekStartOf, weeklyClients, WINDOW, distribution,
  type Visit, type WeekMarketing, type WeekOps,
} from "./metrics";
import { buildClients, clientStatus, cohorts, retentionCurve } from "./clients";
import { PRICE_LIST, listPrice, listRow } from "./prices";
import { atypicalWeeks, capacityPlan, dayOfWeek, monthIndex, opsSummary, seasonSeries, yearOverYear, yoyTotal } from "./analysis";

const DAY = 86_400_000;
const t = (d: string) => new Date(d + "T00:00:00Z").getTime();

/** Cálculo de los hallazgos del reporte, con la misma lógica del tablero (sin filtros). */
export function computeFindings(visits: Visit[], marketing: WeekMarketing[], ops: WeekOps[], cutoff: string, goal = 100) {
  // ---- punto de partida ----
  const weeks = lastWeeks(weeklyClients(visits, cutoff), cutoff);
  const clients = avg(weeks.map((w) => w.clients));
  const nuevos = avg(weeks.map((w) => w.nuevos));
  const recurrentes = avg(weeks.map((w) => w.recurrentes));
  const shareNew = clients ? nuevos / clients : 0;
  const share = Math.round(shareNew * 100) / 100;
  const goalNew = goal * share;
  const goalRec = goal - goalNew;
  const spend = marketingAvg(marketing, weeks.map((w) => w.week));
  const cac = nuevos ? spend / nuevos : 0;
  const cacTarget = goalNew ? spend / goalNew : 0;
  const roas = spend ? avg(weeks.map((w) => w.ingresosNuevos)) / spend : 0;

  // ---- retención ----
  const all = buildClients(visits);
  const scheduled = new Set(visits.filter((v) => v.status === "agendado").map((v) => v.client_id));
  const status = { Activo: 0, "En riesgo": 0, Perdido: 0 } as Record<string, number>;
  for (const c of all) status[clientStatus(c, cutoff, scheduled)]++;
  const repeaters = all.filter((c) => c.visits >= 2);
  const oneTime = all.length - repeaters.length;
  const ltv = all.length ? all.reduce((a, c) => a + c.revenue, 0) / all.length : 0;
  const ltvRepeat = repeaters.length ? repeaters.reduce((a, c) => a + c.revenue, 0) / repeaters.length : 0;
  const curve = retentionCurve(cohorts(visits, all, cutoff));
  const sortedRev = [...all].sort((a, b) => b.revenue - a.revenue);
  const totalRev = sortedRev.reduce((a, c) => a + c.revenue, 0);
  const top10 = totalRev ? sortedRev.slice(0, Math.ceil(sortedRev.length * 0.1)).reduce((a, c) => a + c.revenue, 0) / totalRev : 0;

  // ---- monetización ----
  const end = t(weekStartOf(cutoff));
  const from = end - WINDOW * 7 * DAY;
  const recent = visits.filter((v) => v.status === "realizado" && t(v.week_start) >= from && t(v.week_start) < end);
  const priced = recent.filter((v) => (v.price ?? 0) > 0);
  const ticket = avg(priced.map((v) => v.price!));
  const tip = avg(priced.map((v) => v.tip ?? 0));
  const wk = marketing.filter((m) => t(m.week_start) >= from && t(m.week_start) < end && (m.sales ?? 0) > 0 && (m.labor ?? 0) > 0);
  const sales = wk.reduce((a, m) => a + (m.sales ?? 0), 0);
  const labor = wk.reduce((a, m) => a + (m.labor ?? 0), 0);
  const marginPct = sales ? 1 - labor / sales : null;
  const addonKeys = ["addon_laundry", "addon_baseboards", "addon_windows", "addon_oven", "addon_fridge", "addon_cabinets"] as const;
  const addonPct = recent.length ? recent.filter((v) => addonKeys.some((k) => v[k])).length / recent.length : 0;
  const withLabor = visits.filter((v) => v.status === "realizado" && hasLabor(v) && v.service_family === "Standard");
  const sizes = PRICE_LIST.map((row) => {
    const vs = withLabor.filter((v) => listRow(v.bedrooms, v.bathrooms) === row);
    const price = avg(vs.map((v) => v.price!));
    const lab = avg(vs.map((v) => v.labor_cost!));
    const list = avg(vs.map((v) => listPrice(row, v.frequency)));
    return { label: row.label, bd: row.bd, n: vs.length, gap: list ? price / list - 1 : 0, marginHour: vs.length ? (price - lab) / row.hours : 0 };
  }).filter((r) => r.n >= 10);
  const small = sizes.find((r) => r.bd === 1);
  const large = sizes.filter((r) => r.bd === 5);
  const largeHour = large.length ? avg(large.map((r) => r.marginHour)) : null;
  const gaps = sizes.map((r) => r.gap);

  // ---- zonas ----
  const cityDist = distribution(visits, "city", cutoff, "12w");
  const regionDist = distribution(visits, "region", cutoff, "12w");
  const top5 = cityDist.slice(0, 5).reduce((a, r) => a + r.pct, 0);

  // ---- estacionalidad ----
  const series = seasonSeries(visits, marketing, cutoff);
  const months = monthIndex(series).filter((m) => m.index !== null);
  const best = [...months].sort((a, b) => b.index! - a.index!)[0];
  const worst = [...months].sort((a, b) => a.index! - b.index!)[0];
  const yoy = yearOverYear(series);
  const yoyAvg = yoyTotal(yoy);
  const dow = dayOfWeek(visits, cutoff, "12w");
  const peak = [...dow].sort((a, b) => b.value - a.value)[0];
  const odd = atypicalWeeks(series);

  // ---- operación ----
  const op = opsSummary(ops, marketing, cutoff);
  const plan = capacityPlan(goal, op.hoursPerClient, op.hoursPerCleaner, op.cleaners, op.costPerHour);

  // ---- calidad de datos ----
  const firstVisits = visits.filter((v) => v.is_first_visit);
  const noSource = firstVisits.length ? firstVisits.filter((v) => !v.client_source || v.client_source.startsWith("Sin")).length / firstVisits.length : 0;

  return {
    goal, cutoff,
    start: { clients, nuevos, recurrentes, shareNew, goalNew, goalRec, spend, cac, cacTarget, roas },
    retention: {
      totalClients: all.length, repeatRate: all.length ? repeaters.length / all.length : 0, oneTime, oneTimePct: all.length ? oneTime / all.length : 0,
      m1: curve[1]?.pct ?? null, m3: curve[3]?.pct ?? null, m6: curve[6]?.pct ?? null,
      lost: status.Perdido, atRisk: status["En riesgo"], active: status.Activo, ltv, ltvRepeat, top10,
    },
    money: { ticket, tip, tipPct: ticket ? tip / ticket : 0, marginPct, addonPct, smallHour: small?.marginHour ?? null, largeHour, gapMin: gaps.length ? Math.min(...gaps) : null, gapMax: gaps.length ? Math.max(...gaps) : null },
    zones: { cities: cityDist, regions: regionDist, top5, totalCities: cityDist.filter((c) => !c.name.startsWith("Sin")).length },
    season: { best, worst, yoyAvg, yoyMonths: yoy.map((r) => r.label).join(", "), peak, oddWeeks: odd.length },
    ops: { ...op, plan, hasData: ops.length > 0 },
    quality: { noSource },
    filtersNote: ALL,
  };
}

export type Findings = ReturnType<typeof computeFindings>;
