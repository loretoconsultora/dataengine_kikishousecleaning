"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt1, fmtInt, fmtPct, fmtUsd, type Visit, type WeekMarketing, type WeekOps } from "@/lib/metrics";
import { opsSummary } from "@/lib/analysis";
import { baseLevers, calibrate, presets, simulate, type Levers } from "@/lib/scenarios";
import { AXIS, SectionNote, Stat, tooltipStyle } from "@/components/ui";

type Props = { visits: Visit[]; marketing: WeekMarketing[]; ops: WeekOps[]; cutoff: string };

const GOAL = 100;
const COLORS: Record<string, string> = { hoy: "#B9C4D3", pauta: "#F2A541", sistema: "#151C25", custom: "#2E68F5" };
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fmtDate = (d: string | null) => {
  if (!d) return "No en el horizonte";
  const x = new Date(d + "T00:00:00Z");
  return `${MONTHS[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
};

export default function Escenarios({ visits, marketing, ops, cutoff }: Props) {
  const cal = useMemo(() => calibrate(visits, marketing, cutoff), [visits, marketing, cutoff]);
  const op = useMemo(() => opsSummary(ops, marketing, cutoff), [ops, marketing, cutoff]);
  const hoursPerClient = op.hoursPerClient || 4.5;
  const hoursPerCleaner = op.hoursPerCleaner || 30;
  const horizon = useMemo(() => Math.ceil((new Date("2027-12-31T00:00:00Z").getTime() - new Date(cal.start + "T00:00:00Z").getTime()) / (7 * 86_400_000)), [cal.start]);
  const ps = useMemo(() => presets(cal), [cal]);
  const [levers, setLevers] = useState<Levers>(() => ps.find((p) => p.id === "sistema")!.levers);
  const set = <K extends keyof Levers>(k: K, v: Levers[K]) => setLevers((l) => ({ ...l, [k]: v }));

  const runs = useMemo(() => {
    const all = [...ps.map((p) => ({ id: p.id, label: p.label, desc: p.desc, levers: p.levers })), { id: "custom", label: "Personalizado", desc: "Los controles de abajo", levers }];
    return all.map((r) => ({ ...r, sim: simulate(cal, r.levers, horizon, GOAL, hoursPerClient, hoursPerCleaner) }));
  }, [ps, levers, cal, horizon, hoursPerClient, hoursPerCleaner]);

  const chart = useMemo(() => runs[0].sim.rows.map((row, i) => {
    const x: Record<string, number | string> = { label: `${MONTHS[row.month]} ${row.week.slice(2, 4)}` };
    for (const r of runs) x[r.label] = Math.round(r.sim.rows[i].clients * 10) / 10;
    return x;
  }), [runs]);

  const at = (sim: (typeof runs)[number]["sim"], ym: string) => {
    const rows = sim.rows.filter((r) => r.week.startsWith(ym));
    return rows.length ? rows.reduce((a, r) => a + r.clients, 0) / rows.length : null;
  };
  const year = (sim: (typeof runs)[number]["sim"]) => sim.rows.filter((r) => r.week.startsWith("2027"));
  const custom = runs.find((r) => r.id === "custom")!.sim;
  const peakCleaners = Math.max(...custom.rows.map((r) => r.cleaners));
  const base = baseLevers(cal);

  return (
    <>
      <section className="card">
        <h2>¿Cuándo se llega a {GOAL} clientes por semana?</h2>
        <p className="muted small">Proyección semanal hasta diciembre 2027 con el modelo calibrado con los datos de Kiki&apos;s. Hoy: {fmt1(cal.currentClients)} clientes por semana.</p>
        <div className="chart">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chart} margin={{ top: 12, right: 12, left: -14, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#E3E9F1" />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval={7} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} domain={[0, (max: number) => Math.max(GOAL + 10, Math.ceil(max / 10) * 10)]} />
              <ReferenceLine y={GOAL} stroke="#3FB68B" strokeDasharray="5 4" label={{ value: `Meta ${GOAL}`, position: "insideTopLeft", fill: "#3FB68B", fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [fmt1(Number(v)), String(n)]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {runs.map((r) => (
                <Line key={r.id} dataKey={r.label} stroke={COLORS[r.id]} strokeWidth={r.id === "custom" || r.id === "sistema" ? 3 : 2} strokeDasharray={r.id === "custom" ? "6 4" : undefined} dot={false} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="table-wrap">
          <table className="goal-table">
            <thead><tr><th>Escenario</th><th>Supuestos</th><th>Marzo 2027</th><th>Diciembre 2027</th><th>Llega a {GOAL}</th><th>Ingreso 2027</th></tr></thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className={r.id === "custom" ? "hl" : ""}>
                  <td><span className="dot" style={{ background: COLORS[r.id], display: "inline-block", width: 10, height: 10, borderRadius: 99, marginRight: 8 }} /><b>{r.label}</b></td>
                  <td className="wrap">{r.desc}</td>
                  <td>{fmt1(at(r.sim, "2027-03") ?? 0)}</td>
                  <td>{fmt1(at(r.sim, "2027-12") ?? 0)}</td>
                  <td className={r.sim.reached ? "up" : ""}>{fmtDate(r.sim.reached)}</td>
                  <td>{fmtUsd(year(r.sim).reduce((a, x) => a + x.revenue, 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <SectionNote>
          Clientes por semana: promedio del mes. &quot;Llega a {GOAL}&quot; es la primera semana en que el promedio de 4 semanas alcanza la meta. Con los supuestos de hoy el negocio se estabiliza en unos {fmt1(runs[0].sim.steady)} clientes por semana: lo que entra de clientes nuevos se compensa con los que se van.
        </SectionNote>
      </section>

      <section className="grid-2">
        <div className="card">
          <h2>Arma tu escenario</h2>
          <p className="muted small">Cada control parte del valor actual. La línea azul punteada de la gráfica responde en vivo.</p>
          <div className="levers">
            <Lever label="Pauta por semana" value={fmtUsd(levers.spend)} hint={`hoy ${fmtUsd(base.spend)}`}>
              <input type="range" min={0} max={Math.round(base.spend * 3 / 100) * 100} step={50} value={levers.spend} onChange={(e) => set("spend", Number(e.target.value))} />
            </Lever>
            <Lever label="Mejora en el cierre de leads" value={`+${fmtPct(levers.closeUp)}`} hint="más nuevos con la misma pauta">
              <input type="range" min={0} max={1} step={0.05} value={levers.closeUp} onChange={(e) => set("closeUp", Number(e.target.value))} />
            </Lever>
            <Lever label="Nuevos por referidos y reactivación" value={`${fmt1(levers.referrals)} por semana`} hint="sin costo de pauta">
              <input type="range" min={0} max={15} step={0.5} value={levers.referrals} onChange={(e) => set("referrals", Number(e.target.value))} />
            </Lever>
            <Lever label="Nuevos que hacen segunda visita" value={fmtPct(levers.secondVisit)} hint={`hoy ${fmtPct(base.secondVisit)}`}>
              <input type="range" min={0.1} max={0.9} step={0.01} value={levers.secondVisit} onChange={(e) => set("secondVisit", Number(e.target.value))} />
            </Lever>
            <Lever label="Reducción de bajas" value={`−${fmtPct(levers.churnCut)}`} hint={`hoy se va ${fmtPct(cal.churn, 1)} de la base por semana`}>
              <input type="range" min={0} max={0.6} step={0.05} value={levers.churnCut} onChange={(e) => set("churnCut", Number(e.target.value))} />
            </Lever>
            <Lever label="Ajuste de precio" value={`${levers.price >= 0 ? "+" : ""}${fmtPct(levers.price)}`} hint="solo cambia el ingreso">
              <input type="range" min={-0.1} max={0.2} step={0.01} value={levers.price} onChange={(e) => set("price", Number(e.target.value))} />
            </Lever>
            <label className="lever-check">
              <input type="checkbox" checked={levers.seasonal} onChange={(e) => set("seasonal", e.target.checked)} /> Aplicar temporada (índice mensual)
            </label>
            <div className="seg" role="group" aria-label="Partir de">
              {ps.map((p) => <button key={p.id} onClick={() => setLevers(p.levers)}>Partir de: {p.label}</button>)}
            </div>
          </div>
        </div>
        <div className="card">
          <h2>Resultado del escenario personalizado</h2>
          <div className="kpi-grid" style={{ marginTop: 14 }}>
            <Stat label={`Llega a ${GOAL} clientes`} value={fmtDate(custom.reached)} sub={`equilibrio: ${fmt1(custom.steady)} por semana`} accent />
            <Stat label="Clientes por semana, dic 2027" value={fmt1(at(custom, "2027-12") ?? 0)} sub={`marzo 2027: ${fmt1(at(custom, "2027-03") ?? 0)}`} />
            <Stat label="Ingreso 2027" value={fmtUsd(year(custom).reduce((a, x) => a + x.revenue, 0))} sub={`${fmtUsd(cal.revenuePerClient * (1 + levers.price))} por cliente-semana`} />
            <Stat label="Limpiadoras en el pico" value={fmt1(peakCleaners)} sub={`hoy ${fmt1(op.cleaners)} · ${fmt1(hoursPerCleaner)} h cada una`} />
          </div>
          <SectionNote>
            El salto grande no viene de la pauta: viene de que más clientes nuevos hagan su segunda visita y de que la base recurrente se vaya más despacio. Cada punto de bajas que se recupera se acumula semana a semana; cada dólar extra de pauta compra clientes a un costo mayor que el promedio.
          </SectionNote>
        </div>
      </section>

      <section className="card">
        <h2>Cómo funciona el modelo</h2>
        <p className="muted small">Calibrado con las últimas 26 semanas completas de servicios</p>
        <div className="kpi-grid four" style={{ marginTop: 14 }}>
          <Stat label="Base recurrente hoy" value={fmtInt(cal.base0)} sub="2+ visitas, la última hace ≤ 60 días" />
          <Stat label="Visitas por semana de la base" value={fmtPct(cal.visitRate)} sub="mezcla de semanal, quincenal y mensual" />
          <Stat label="Bajas por semana" value={fmtPct(cal.churn, 1)} sub="de la base recurrente" />
          <Stat label="Nuevos que repiten" value={fmtPct(cal.secondVisit)} sub="segundas visitas ÷ nuevos, en cualquier plazo" />
        </div>
        <ul className="method">
          <li><b>Clientes de la semana</b> = nuevos + base recurrente × visitas por semana.</li>
          <li><b>Nuevos</b> = {fmt1(cal.newPerWeek)} por semana hoy + {fmt1(cal.slope * 100)} por cada USD 100 extra de pauta (regresión de la sección Adquisición), × (1 + mejora de cierre) × índice de temporada + referidos y reactivación.</li>
          <li><b>Base recurrente</b>: cada semana pierde el {fmtPct(cal.churn, 1)} (bajas) y gana a los nuevos que hacen su segunda visita unas 4 semanas después.</li>
          <li><b>Ingreso</b> = clientes × {fmtUsd(cal.revenuePerClient)} por cliente-semana × (1 + ajuste de precio). <b>Limpiadoras</b> = clientes × {fmt1(hoursPerClient)} horas ÷ {fmt1(hoursPerCleaner)} horas por limpiadora.</li>
          <li><b>Límites:</b> el precio no cambia la demanda en el modelo; las cancelaciones aún no se registran; la pauta solo explica una parte de los clientes nuevos. Los escenarios son para comparar decisiones, no un pronóstico de ventas.</li>
        </ul>
      </section>
    </>
  );
}

function Lever({ label, value, hint, children }: { label: string; value: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="lever">
      <div className="lever-head"><span>{label}</span><b>{value}</b></div>
      {children}
      <small className="muted">{hint}</small>
    </div>
  );
}
