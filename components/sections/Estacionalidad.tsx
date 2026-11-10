"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt1, fmtInt, fmtPct, fmtUsd, fmtWeek, type Filters, type Visit, type WeekMarketing } from "@/lib/metrics";
import { atypicalWeeks, dayOfWeek, monthIndex, seasonSeries, yearOverYear, yoyTotal } from "@/lib/analysis";
import { AXIS, SectionNote, Stat, tooltipStyle } from "@/components/ui";

type Props = { filtered: Visit[]; marketing: WeekMarketing[]; cutoff: string; filters: Filters };

export default function Estacionalidad({ filtered, marketing, cutoff, filters }: Props) {
  const series = useMemo(() => seasonSeries(filtered, marketing, cutoff), [filtered, marketing, cutoff]);
  const months = useMemo(() => monthIndex(series), [series]);
  const yoy = useMemo(() => yearOverYear(series), [series]);
  const dow = useMemo(() => dayOfWeek(filtered, cutoff, filters.period), [filtered, cutoff, filters.period]);
  const odd = useMemo(() => atypicalWeeks(series), [series]);

  const valid = months.filter((m) => m.index !== null);
  const best = [...valid].sort((a, b) => b.index! - a.index!)[0];
  const worst = [...valid].sort((a, b) => a.index! - b.index!)[0];
  const yoyAvg = yoyTotal(yoy) ?? 0;
  const peak = [...dow].sort((a, b) => b.value - a.value)[0];

  return (
    <>
      <section className="card">
        <h2>Clientes por semana desde febrero 2025</h2>
        <p className="muted small">Clientes distintos por semana (barras) y ventas semanales de la hoja KPI (línea)</p>
        <div className="kpi-grid four" style={{ marginTop: 16 }}>
          <Stat label="Crecimiento año contra año" value={`${yoyAvg >= 0 ? "+" : ""}${fmtPct(yoyAvg)}`} sub={`${yoy.map((r) => r.label).join(", ") || "sin meses comparables"}`} accent />
          <Stat label="Mes más fuerte" value={best ? best.label : "–"} sub={best ? `${fmtPct(best.index! - 1)} sobre el promedio` : ""} />
          <Stat label="Mes más débil" value={worst ? worst.label : "–"} sub={worst ? `${fmtPct(worst.index! - 1)} bajo el promedio` : ""} />
          <Stat label="Día con más servicios" value={peak?.day ?? "–"} sub={peak ? `${fmtPct(peak.pct)} de la semana` : ""} />
        </div>
        <div className="chart">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={series.map((s) => ({ ...s, label: fmtWeek(s.week) + " " + s.week.slice(2, 4) }))} margin={{ top: 12, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#E3E9F1" />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval={7} />
              <YAxis yAxisId="c" tick={AXIS} tickLine={false} axisLine={false} />
              <YAxis yAxisId="s" orientation="right" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [n === "Ventas" ? fmtUsd(Number(v)) : fmtInt(Number(v)), String(n)]} />
              <Bar yAxisId="c" dataKey="clients" name="Clientes" fill="#8FB0FA" radius={[3, 3, 0, 0]} />
              <Line yAxisId="s" dataKey="sales" name="Ventas" stroke="#151C25" strokeWidth={2} dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <h2>Índice estacional por mes</h2>
          <p className="muted small">Promedio semanal de clientes del mes ÷ promedio de ese año, promediado entre años. 100% = un mes normal.</p>
          <div className="chart">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={months.map((m) => ({ ...m, pct: m.index === null ? null : Math.round(m.index * 100) }))} margin={{ top: 12, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#E3E9F1" />
                <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} unit="%" />
                <ReferenceLine y={100} stroke="#151C25" strokeDasharray="4 4" />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "Índice"]} />
                <Bar dataKey="pct" radius={[6, 6, 0, 0]}>
                  {months.map((m) => <Cell key={m.label} fill={(m.index ?? 1) >= 1 ? "#2E68F5" : "#B9C4D3"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <SectionNote>
            Meses con dos años de datos: {months.filter((m) => m.years === 2).map((m) => m.label).join(", ") || "–"}. Los demás tienen un solo año y conviene leerlos con cautela. Se excluye el mes de arranque (febrero 2025).
          </SectionNote>
        </div>
        <div className="card">
          <h2>Año contra año</h2>
          <p className="muted small">Clientes por semana, mismo mes 2025 vs 2026 (solo meses completos en ambos años)</p>
          <div className="table-wrap">
            <table className="goal-table">
              <thead><tr><th>Mes</th><th>2025</th><th>2026</th><th>Crecimiento</th></tr></thead>
              <tbody>
                {yoy.map((r) => (
                  <tr key={r.label}>
                    <td>{r.label}</td><td>{fmt1(r.prev)}</td><td>{fmt1(r.curr)}</td>
                    <td className={r.growth >= 0 ? "up" : "down"}>{r.growth >= 0 ? "+" : ""}{fmtPct(r.growth)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <h2>Servicios por día de la semana</h2>
          <p className="muted small">{filters.period === "12w" ? "Últimas 12 semanas" : "Histórico"}. El día pico define cuántas limpiadoras se necesitan al mismo tiempo.</p>
          <ul className="bars city-bars">
            {dow.map((d) => (
              <li key={d.day}>
                <span>{d.day}</span>
                <div className="mini-progress wide"><span style={{ width: `${(d.value / (peak?.value || 1)) * 100}%` }} /></div>
                <b>{fmtPct(d.pct)}</b>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h2>Semanas atípicas</h2>
          <p className="muted small">Semanas con ±25% contra el promedio de sus 4 semanas previas. Candidatas a validar con Oscar (clima, festivos u otros eventos).</p>
          <div className="table-wrap">
            <table className="goal-table">
              <thead><tr><th>Semana</th><th>Clientes</th><th>Promedio previo</th><th>Variación</th></tr></thead>
              <tbody>
                {odd.slice(-12).reverse().map((s) => (
                  <tr key={s.week}>
                    <td>{fmtWeek(s.week)} {s.week.slice(0, 4)}</td><td>{fmtInt(s.clients)}</td><td>{fmt1(s.ma4!)}</td>
                    <td className={s.ratio! >= 1 ? "up" : "down"}>{s.ratio! >= 1 ? "+" : ""}{fmtPct(s.ratio! - 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <SectionNote>{odd.length} semanas atípicas en total; se muestran las 12 más recientes. Al confirmarlas, el modelo de proyección las trata como eventos y no como tendencia.</SectionNote>
        </div>
      </section>
    </>
  );
}
