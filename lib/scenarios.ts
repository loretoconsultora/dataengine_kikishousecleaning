import { avg, lastWeeks, weekStartOf, weeklyClients, type Visit, type WeekMarketing } from "./metrics";
import { monthIndex, seasonSeries } from "./analysis";
import { acquisitionWeeks, spendRegression } from "./acquisition";

const DAY = 86_400_000;
const t = (d: string) => new Date(d + "T00:00:00Z").getTime();
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const ACTIVE_DAYS = 60;
const SECOND_VISIT_DELAY = 4; // semanas: la mediana entre primera y segunda visita es ~30 días

/**
 * Calibración del modelo con los datos reales.
 * Base recurrente = clientes con 2 o más visitas y la última hace 60 días o menos.
 * Cada semana: recurrentes que vienen = base × tasa de visita; la base pierde una fracción (bajas)
 * y gana a los nuevos que hacen su segunda visita.
 */
export function calibrate(visits: Visit[], marketing: WeekMarketing[], cutoff: string) {
  const end = t(weekStartOf(cutoff));
  const byClient = new Map<string, number[]>();
  for (const v of visits) {
    if (v.status !== "realizado") continue;
    if (!byClient.has(v.client_id)) byClient.set(v.client_id, []);
    byClient.get(v.client_id)!.push(t(v.visit_date));
  }
  for (const l of byClient.values()) l.sort((a, b) => a - b);

  const baseAt = (w: number) => {
    let b = 0;
    for (const l of byClient.values()) {
      let k = 0, last = -Infinity;
      for (const d of l) { if (d < w) { k++; last = d; } else break; }
      if (k >= 2 && w - last <= ACTIVE_DAYS * DAY) b++;
    }
    return b;
  };
  const secondIn = (w0: number, w1: number) => {
    let n = 0;
    for (const l of byClient.values()) if (l[1] !== undefined && l[1] >= w0 && l[1] < w1) n++;
    return n;
  };

  const rows = weeklyClients(visits, cutoff);
  const recent = lastWeeks(rows, cutoff, 26);
  const series = recent.map((r) => {
    const w = t(r.week);
    return { week: r.week, B: baseAt(w), R: r.recurrentes, N: r.nuevos, I: secondIn(w, w + 7 * DAY) };
  });
  const last12 = series.slice(-12);
  const visitRate = avg(last12.filter((s) => s.B > 0).map((s) => s.R / s.B));
  const churns = series.slice(0, -1).map((s, i) => (s.B ? (s.B + s.I - series[i + 1].B) / s.B : 0));
  const churn = Math.max(0.005, avg(churns));
  const sumN = series.reduce((a, s) => a + s.N, 0);
  const secondVisit = sumN ? Math.min(0.95, series.reduce((a, s) => a + s.I, 0) / sumN) : 0.3;
  const base0 = baseAt(end);
  const newPerWeek = avg(last12.map((s) => s.N));

  // ingreso por cliente-semana (un cliente puede tener más de un servicio en la semana)
  const from12 = end - 12 * 7 * DAY;
  const win = visits.filter((v) => v.status === "realizado" && t(v.week_start) >= from12 && t(v.week_start) < end);
  const clientWeeks = new Set(win.map((v) => v.client_id + v.week_start)).size;
  const revenuePerClient = clientWeeks ? win.reduce((a, v) => a + (v.price ?? 0), 0) / clientWeeks : 0;

  const acq = acquisitionWeeks(visits, marketing, cutoff);
  const reg = spendRegression(acq.filter((w) => t(w.week) >= t("2025-03-02")));
  const spend0 = avg(acq.slice(-12).map((w) => w.spend));

  const idx = monthIndex(seasonSeries(visits, marketing, cutoff));
  const season = idx.map((m) => m.index ?? 1);

  return {
    base0, visitRate, churn, secondVisit, newPerWeek, spend0, revenuePerClient,
    slope: reg && reg.b > 0 ? reg.b : 0, reg, season, start: iso(end),
    currentClients: avg(lastWeeks(rows, cutoff).map((r) => r.clients)),
    series,
  };
}

export type Calibration = ReturnType<typeof calibrate>;

export type Levers = {
  spend: number;          // pauta semanal (USD)
  closeUp: number;        // mejora en tasa de cierre (0.25 = +25% nuevos con la misma pauta)
  referrals: number;      // clientes nuevos extra por semana sin pauta (referidos, reactivación)
  secondVisit: number;    // % de nuevos que hacen segunda visita
  churnCut: number;       // reducción de bajas (0.2 = 20% menos)
  price: number;          // ajuste de precio (0.05 = +5%)
  seasonal: boolean;
};

export function baseLevers(c: Calibration): Levers {
  return { spend: Math.round(c.spend0), closeUp: 0, referrals: 0, secondVisit: c.secondVisit, churnCut: 0, price: 0, seasonal: true };
}

export function presets(c: Calibration): { id: string; label: string; desc: string; levers: Levers }[] {
  const b = baseLevers(c);
  return [
    { id: "hoy", label: "Sin cambios", desc: "La pauta y la operación de hoy", levers: b },
    { id: "pauta", label: "Solo más pauta", desc: "+50% de pauta, todo lo demás igual", levers: { ...b, spend: Math.round(b.spend * 1.5) } },
    {
      id: "sistema", label: "Sistema de adquisición y retención", desc: "Cierre +25%, 3 nuevos por referidos y reactivación, +10 pts de segunda visita, 25% menos bajas",
      levers: { ...b, closeUp: 0.25, referrals: 3, secondVisit: Math.min(0.9, b.secondVisit + 0.1), churnCut: 0.25 },
    },
  ];
}

export function simulate(c: Calibration, l: Levers, weeks: number, goal: number, hoursPerClient: number, hoursPerCleaner: number) {
  const out: { week: string; month: number; clients: number; nuevos: number; recurrentes: number; revenue: number; cleaners: number }[] = [];
  let base = c.base0;
  const churn = c.churn * (1 - l.churnCut);
  const history: number[] = Array(SECOND_VISIT_DELAY).fill(c.newPerWeek);
  const start = t(c.start);
  let reached: string | null = null;
  for (let i = 0; i < weeks; i++) {
    const w = start + i * 7 * DAY;
    const month = new Date(w + 3 * DAY).getUTCMonth();
    const s = l.seasonal ? c.season[month] ?? 1 : 1;
    const paid = Math.max(0, c.newPerWeek + c.slope * (l.spend - c.spend0));
    const nuevos = paid * (1 + l.closeUp) * s + l.referrals;
    const recurrentes = c.visitRate * base;
    const clients = nuevos + recurrentes;
    const inflow = l.secondVisit * history[history.length - SECOND_VISIT_DELAY];
    history.push(nuevos);
    base = base * (1 - churn) + inflow;
    out.push({
      week: iso(w), month, clients, nuevos, recurrentes,
      revenue: clients * c.revenuePerClient * (1 + l.price),
      cleaners: hoursPerCleaner ? (clients * hoursPerClient) / hoursPerCleaner : 0,
    });
    if (!reached && out.length >= 4 && avg(out.slice(-4).map((r) => r.clients)) >= goal) reached = iso(w);
  }
  // nivel de equilibrio: base estable = entradas ÷ bajas
  const steadyNew = Math.max(0, c.newPerWeek + c.slope * (l.spend - c.spend0)) * (1 + l.closeUp) + l.referrals;
  const steadyBase = churn ? (l.secondVisit * steadyNew) / churn : 0;
  const steady = steadyNew + c.visitRate * steadyBase;
  return { rows: out, reached, steady, churn };
}
