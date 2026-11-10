"use client";

import { useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt1, fmtInt, fmtPct, fmtUsd, fmtWeek, type Visit, type WeekMarketing, type WeekOps } from "@/lib/metrics";
import { capacityPlan, dayOfWeek, opsSummary } from "@/lib/analysis";
import { AXIS, SectionNote, Stat, tooltipStyle } from "@/components/ui";

type Props = { visits: Visit[]; ops: WeekOps[]; marketing: WeekMarketing[]; cutoff: string };

export default function Operacion({ visits, ops, marketing, cutoff }: Props) {
  const s = useMemo(() => opsSummary(ops, marketing, cutoff), [ops, marketing, cutoff]);
  const dow = useMemo(() => dayOfWeek(visits, cutoff, "12w"), [visits, cutoff]);
  const [goal, setGoal] = useState(100);
  const [hpc, setHpc] = useState<number | null>(null);
  const hoursPerCleaner = hpc ?? Math.round(s.hoursPerCleaner);
  const plan = capacityPlan(goal, s.hoursPerClient, hoursPerCleaner, s.cleaners, s.costPerHour);
  const peak = [...dow].sort((a, b) => b.value - a.value)[0];
  const peakServicesAtGoal = peak ? goal * (s.services / (s.clients || 1)) * peak.pct : 0;

  if (!ops.length) {
    return <section className="card"><h2>Operación y capacidad</h2><p className="muted">Falta cargar la tabla weekly_ops en Supabase.</p></section>;
  }

  return (
    <>
      <section className="card">
        <h2>Cómo opera hoy</h2>
        <p className="muted small">Promedio de las últimas 12 semanas completas. Las horas son estimadas a partir de la lista de precios y del tipo de servicio.</p>
        <div className="kpi-grid four" style={{ marginTop: 16 }}>
          <Stat label="Limpiadoras activas por semana" value={fmt1(s.cleaners)} sub="registradas en el Excel" />
          <Stat label="Horas de trabajo por semana" value={fmtInt(s.hours)} sub={`${fmt1(s.hoursPerClient)} h por cliente`} />
          <Stat label="Horas por limpiadora" value={fmt1(s.hoursPerCleaner)} sub={`${fmt1(s.servicesPerCleaner)} servicios por semana`} />
          <Stat label="Costo por hora de trabajo" value={fmtUsd(s.costPerHour)} sub={`nómina semanal ${fmtUsd(s.payroll)}`} />
        </div>
        <div className="chart">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={s.weeks.map((w) => ({ ...w, label: fmtWeek(w.week_start) }))} margin={{ top: 12, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#E3E9F1" />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
              <YAxis yAxisId="h" tick={AXIS} tickLine={false} axisLine={false} />
              <YAxis yAxisId="c" orientation="right" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar yAxisId="h" dataKey="est_hours" name="Horas estimadas" fill="#8FB0FA" radius={[6, 6, 0, 0]} />
              <Line yAxisId="c" dataKey="active_cleaners" name="Limpiadoras" stroke="#151C25" strokeWidth={3} dot={{ r: 4, fill: "#fff", strokeWidth: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card">
        <h2>¿Qué equipo se necesita para la meta?</h2>
        <p className="muted small">Ajusta la meta y las horas por limpiadora para ver el equipo y la nómina necesarios</p>
        <div className="goal-controls">
          <label>
            Clientes por semana
            <input type="number" min={1} value={goal} onChange={(e) => setGoal(Math.max(1, Number(e.target.value) || 1))} />
          </label>
          <label>
            Horas por limpiadora a la semana
            <input type="number" min={5} max={60} value={hoursPerCleaner} onChange={(e) => setHpc(Math.max(5, Number(e.target.value) || 5))} />
          </label>
          {hpc !== null && <button className="btn-link" onClick={() => setHpc(null)}>Usar promedio actual</button>}
        </div>
        <div className="kpi-grid four" style={{ marginTop: 16 }}>
          <Stat label="Horas de trabajo necesarias" value={fmtInt(plan.hoursNeeded)} sub={`hoy: ${fmtInt(s.hours)}`} />
          <Stat label="Limpiadoras necesarias" value={fmt1(plan.cleanersNeeded)} sub={`hoy: ${fmt1(s.cleaners)}`} accent />
          <Stat label="Limpiadoras por sumar" value={fmtInt(plan.extraCleaners)} sub="redondeado hacia arriba" />
          <Stat label="Nómina semanal estimada" value={fmtUsd(plan.payrollNeeded)} sub={`hoy: ${fmtUsd(s.payroll)}`} />
        </div>
        <SectionNote>
          Día pico: {peak?.day} con {fmtPct(peak?.pct ?? 0)} de los servicios. Con {goal} clientes serían unos {fmtInt(peakServicesAtGoal)} servicios ese día.
          La estimación supone el mismo tiempo por cliente y el mismo costo por hora que hoy; si se suben precios en casas grandes o se agrupan rutas por zona, baja la necesidad de horas.
        </SectionNote>
      </section>

      <section className="card">
        <h2>Cómo se calcula</h2>
        <ul className="method">
          <li><b>Limpiadoras activas:</b> nombres distintos registrados cada semana en el Excel (solo se usa el conteo, no los nombres).</li>
          <li><b>Horas por servicio:</b> si la descripción dice "N cleaners × M hours" se usa N×M; si no, las horas de la lista de precios por recámaras y baños × el multiplicador de la hoja AUTOMATION (Standard 1, Deep Clean 1.5, Move Out/In 1.75).</li>
          <li><b>Costo por hora:</b> nómina semanal de la hoja KPI ÷ horas estimadas.</li>
        </ul>
      </section>
    </>
  );
}
