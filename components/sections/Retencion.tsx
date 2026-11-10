"use client";

import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ALL, fmt1, fmtInt, fmtMonth, fmtPct, fmtUsd, type Filters, type Visit } from "@/lib/metrics";
import {
  ACTIVE_DAYS, LOST_DAYS, VISIT_BUCKETS, buildClients, clientStatus, cohorts, filterClients, gapsByFrequency, median,
  retentionCurve,
} from "@/lib/clients";
import { AXIS, MixPie, SectionNote, Stat, tooltipStyle } from "@/components/ui";

type Props = { visits: Visit[]; cutoff: string; filters: Filters };

const STATUS_COLORS: Record<string, string> = { Activo: "#2E68F5", "En riesgo": "#F2A541", Perdido: "#B9C4D3" };

export default function Retencion({ visits, cutoff, filters }: Props) {
  const allClients = useMemo(() => buildClients(visits), [visits]);
  const clients = useMemo(() => filterClients(allClients, filters), [allClients, filters]);
  const ids = useMemo(() => new Set(clients.map((c) => c.id)), [clients]);
  const scheduled = useMemo(
    () => new Set(visits.filter((v) => v.status === "agendado").map((v) => v.client_id)),
    [visits]
  );

  // ---- estado de la base de clientes ----
  const status = useMemo(() => {
    const counts: Record<string, number> = { Activo: 0, "En riesgo": 0, Perdido: 0 };
    for (const c of clients) counts[clientStatus(c, cutoff, scheduled)]++;
    return counts;
  }, [clients, cutoff, scheduled]);
  const repeaters = clients.filter((c) => c.visits >= 2).length;
  const repeatRate = clients.length ? repeaters / clients.length : 0;
  const ltv = clients.length ? clients.reduce((a, c) => a + c.revenue, 0) / clients.length : 0;
  const ltvRepeat = repeaters ? clients.filter((c) => c.visits >= 2).reduce((a, c) => a + c.revenue, 0) / repeaters : 0;

  // ---- cohortes ----
  const rows = useMemo(() => cohorts(visits, clients, cutoff), [visits, clients, cutoff]);
  const curve = useMemo(() => retentionCurve(rows), [rows]);
  const at = (k: number) => curve[k]?.pct ?? null;

  // ---- tiempo entre visitas ----
  const gaps = useMemo(() => gapsByFrequency(visits, ids), [visits, ids]);
  const gapRows = ["Semanal", "Quincenal", "Mensual", "Única (por validar)"]
    .filter((f) => gaps.get(f)?.length)
    .map((f) => ({ f, median: median(gaps.get(f)!), n: gaps.get(f)!.length }));

  // ---- Pareto ----
  const pareto = useMemo(() => {
    const sorted = [...clients].sort((a, b) => b.revenue - a.revenue);
    const total = sorted.reduce((a, c) => a + c.revenue, 0);
    let acc = 0;
    const points = sorted.map((c, i) => {
      acc += c.revenue;
      return { x: (i + 1) / sorted.length, y: total ? acc / total : 0 };
    });
    const shareAt = (p: number) => points[Math.max(0, Math.ceil(p * points.length) - 1)]?.y ?? 0;
    // muestreo para la gráfica
    const step = Math.max(1, Math.floor(points.length / 100));
    const chart = [{ x: 0, y: 0 }, ...points.filter((_, i) => i % step === 0 || i === points.length - 1)].map((p) => ({
      pctClientes: Math.round(p.x * 1000) / 10,
      pctIngreso: Math.round(p.y * 1000) / 10,
    }));
    const buckets = VISIT_BUCKETS.map((b) => {
      const inB = clients.filter((c) => c.visits >= b.min && c.visits <= b.max);
      const rev = inB.reduce((a, c) => a + c.revenue, 0);
      return { ...b, clients: inB.length, revenue: rev, pctClients: clients.length ? inB.length / clients.length : 0, pctRevenue: total ? rev / total : 0 };
    });
    return { total, chart, top10: shareAt(0.1), top20: shareAt(0.2), buckets };
  }, [clients]);

  const isFiltered = filters.city !== ALL || filters.service !== ALL;
  const statusPie = Object.entries(status).map(([name, value]) => ({ name, value, color: STATUS_COLORS[name] }));

  return (
    <>
      <section className="card hero">
        <div className="hero-main">
          <span className="eyebrow">Clientes que regresan</span>
          <div className="hero-figure">
            <strong>{fmtPct(repeatRate)}</strong>
            <span>repiten al menos una vez</span>
          </div>
          <div className="progress"><span style={{ width: `${repeatRate * 100}%` }} /></div>
          <p className="muted small">
            {fmtInt(repeaters)} de {fmtInt(clients.length)} clientes {isFiltered ? "(con los filtros aplicados)" : "desde febrero 2025"} volvieron a contratar.
            Los demás son la base de la campaña de reactivación (etiqueta <i>winback</i> en GHL).
          </p>
        </div>
        <div className="hero-side">
          <Stat label="Siguen al mes 1" value={at(1) === null ? "–" : fmtPct(at(1)!)} sub="de cada cohorte" />
          <Stat label="Siguen al mes 3" value={at(3) === null ? "–" : fmtPct(at(3)!)} sub="de cada cohorte" />
          <Stat label="Siguen al mes 6" value={at(6) === null ? "–" : fmtPct(at(6)!)} sub="de cada cohorte" />
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <h2>Estado de la base de clientes</h2>
          <p className="muted small">
            Activo: servicio en los últimos {ACTIVE_DAYS} días o cita agendada · En riesgo: {ACTIVE_DAYS + 1} a {LOST_DAYS} días · Perdido: más de {LOST_DAYS} días
          </p>
          <MixPie data={statusPie} total={clients.length} unit="clientes" />
        </div>
        <div className="card">
          <h2>Valor del cliente</h2>
          <p className="muted small">Ingreso acumulado por cliente desde febrero 2025, sin propinas</p>
          <div className="kpi-grid">
            <Stat label="Ingreso promedio por cliente" value={fmtUsd(ltv)} sub="todos los clientes" />
            <Stat label="Cliente que repite" value={fmtUsd(ltvRepeat)} sub={`${ltv ? fmt1(ltvRepeat / ltv) : "–"}x el promedio`} accent />
            <Stat label="Clientes en riesgo" value={fmtInt(status["En riesgo"])} sub="prioridad para recuperar ya" />
            <Stat label="Clientes perdidos" value={fmtInt(status.Perdido)} sub="base para campañas de winback" />
          </div>
          <SectionNote>Es un valor observado, no una proyección: los clientes recientes todavía no acumulan toda su historia.</SectionNote>
        </div>
      </section>

      <section className="card">
        <h2>Curva de retención</h2>
        <p className="muted small">De cada 100 clientes que entran, cuántos siguen contratando k meses después (promedio ponderado de todas las cohortes)</p>
        <div className="chart">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={curve.filter((c) => c.pct !== null).map((c) => ({ mes: `Mes ${c.k}`, pct: Math.round((c.pct ?? 0) * 1000) / 10 }))} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#E3E9F1" />
              <XAxis dataKey="mes" tick={AXIS} tickLine={false} axisLine={false} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "Siguen activos"]} />
              <Line dataKey="pct" stroke="#2E68F5" strokeWidth={3} dot={{ r: 4, fill: "#fff", strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card">
        <h2>Cohortes por mes de entrada</h2>
        <p className="muted small">Cada fila es el grupo de clientes que hizo su primer servicio ese mes. Cada celda: % del grupo que tuvo al menos un servicio k meses después.</p>
        <div className="table-wrap">
          <table className="cohort">
            <thead>
              <tr>
                <th>Cohorte</th>
                <th>Clientes</th>
                {Array.from({ length: 13 }, (_, k) => <th key={k}>{k === 0 ? "Mes 0" : k}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.cohort}>
                  <td>{fmtMonth(r.cohort)}</td>
                  <td>{r.size}</td>
                  {r.cells.map((v, k) => (
                    <td key={k} className="heat" style={v === null ? undefined : { background: heat(v), color: v > 0.55 ? "#fff" : "#151C25" }}>
                      {v === null ? "" : fmtPct(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <h2>Concentración del ingreso</h2>
          <p className="muted small">
            El 10% de clientes que más compra genera el <b>{fmtPct(pareto.top10)}</b> del ingreso; el 20%, el <b>{fmtPct(pareto.top20)}</b>.
          </p>
          <div className="chart">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={pareto.chart} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#E3E9F1" />
                <XAxis dataKey="pctClientes" type="number" domain={[0, 100]} unit="%" tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis type="number" domain={[0, 100]} unit="%" tick={AXIS} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "Del ingreso"]} labelFormatter={(l) => `${l}% de los clientes`} />
                <Line dataKey="pctIngreso" stroke="#151C25" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h2>Clientes por número de visitas</h2>
          <p className="muted small">Ingreso total: {fmtUsd(pareto.total)}</p>
          <div className="table-wrap">
            <table className="goal-table">
              <thead><tr><th>Grupo</th><th>Clientes</th><th>% clientes</th><th>Ingreso</th><th>% ingreso</th></tr></thead>
              <tbody>
                {pareto.buckets.map((b) => (
                  <tr key={b.name}>
                    <td>{b.name}</td>
                    <td>{fmtInt(b.clients)}</td>
                    <td>{fmtPct(b.pctClients)}</td>
                    <td>{fmtUsd(b.revenue)}</td>
                    <td><div className="mini-progress"><span style={{ width: `${b.pctRevenue * 100}%` }} /></div>{fmtPct(b.pctRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 style={{ marginTop: 20 }}>¿Vuelven cuando deberían?</h3>
          <p className="muted small">Días reales entre una visita y la siguiente de un mismo cliente, contra la frecuencia que contrató</p>
          <div className="table-wrap">
            <table className="goal-table">
              <thead><tr><th>Frecuencia</th><th>Debería volver</th><th>Vuelve (mediana)</th><th>Retraso</th><th>Visitas al año</th></tr></thead>
              <tbody>
                {gapRows.map((g) => {
                  const expected = g.f === "Semanal" ? 7 : g.f === "Quincenal" ? 14 : g.f === "Mensual" ? 28 : null;
                  const delay = expected ? g.median - expected : null;
                  const perYear = g.median ? 365 / g.median : 0;
                  const ideal = expected ? 365 / expected : null;
                  return (
                    <tr key={g.f}>
                      <td>{g.f}</td>
                      <td>{expected ? `cada ${expected} días` : "–"}</td>
                      <td>cada {fmtInt(g.median)} días</td>
                      <td className={delay && delay > 1 ? "down" : ""}>{delay === null ? "–" : delay > 1 ? `+${fmtInt(delay)} días` : "a tiempo"}</td>
                      <td>{fmt1(perYear)}{ideal && delay && delay > 1 ? <span className="muted"> de {fmt1(ideal)}</span> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <SectionNote>
            Un retraso de pocos días se acumula: un cliente mensual que vuelve cada 32 días en lugar de 28 hace unas 2 visitas menos al año.
            Los clientes marcados como &quot;única&quot; que aparecen aquí sí volvieron, lo que confirma que esa etiqueta hay que validarla.
          </SectionNote>
        </div>
      </section>
    </>
  );
}

function heat(v: number) {
  // escala de azul claro a azul de marca
  const a = Math.min(1, Math.max(0, v));
  const mix = (x: number, y: number) => Math.round(x + (y - x) * a);
  return `rgb(${mix(243, 46)}, ${mix(247, 104)}, ${mix(255, 245)})`;
}
