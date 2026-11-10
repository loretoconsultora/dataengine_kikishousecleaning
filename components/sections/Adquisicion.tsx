"use client";

import { useMemo } from "react";
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import { ALL, WINDOW, avg, fmt1, fmtInt, fmtPct, fmtUsd, fmtWeek, weekStartOf, type Filters, type Visit, type WeekMarketing } from "@/lib/metrics";
import { acquisitionWeeks, entryMix, entryQuality, secondVisitPipeline, spendRegression, thumbtackSummary, type ThumbtackMonth } from "@/lib/acquisition";
import { AXIS, CategoryPie, SectionNote, Stat, tooltipStyle } from "@/components/ui";

type Props = { visits: Visit[]; filtered: Visit[]; marketing: WeekMarketing[]; thumbtack: ThumbtackMonth[]; cutoff: string; filters: Filters };

const GOAL = 100;
const DAY = 86_400_000;

export default function Adquisicion({ visits, filtered, marketing, thumbtack, cutoff, filters }: Props) {
  const isFiltered = filters.city !== ALL || filters.service !== ALL;
  const weeks = useMemo(() => acquisitionWeeks(visits, marketing, cutoff), [visits, marketing, cutoff]);
  const last = weeks.slice(-WINDOW);
  const nuevos = avg(last.map((w) => w.nuevos));
  const spend = avg(last.map((w) => w.spend));
  const cac = nuevos ? spend / nuevos : 0;
  const roas = spend ? avg(last.map((w) => w.revenue)) / spend : 0;

  // mismo cálculo de la meta que en Resumen: la meta de nuevos respeta la mezcla actual
  const totalClients = useMemo(() => {
    const end = new Date(weekStartOf(cutoff) + "T00:00:00Z").getTime();
    const from = end - WINDOW * 7 * DAY;
    const per = new Map<string, Set<string>>();
    for (const v of visits) {
      const tw = new Date(v.week_start + "T00:00:00Z").getTime();
      if (v.status !== "realizado" || tw < from || tw >= end) continue;
      if (!per.has(v.week_start)) per.set(v.week_start, new Set());
      per.get(v.week_start)!.add(v.client_id);
    }
    return avg([...per.values()].map((s) => s.size));
  }, [visits, cutoff]);
  const share = totalClients ? Math.round((nuevos / totalClients) * 100) / 100 : 0;
  const goalNew = GOAL * share;
  const cacTarget = goalNew ? spend / goalNew : 0;

  // margen de contribución de las últimas 12 semanas (hoja KPI) para la recuperación del CAC
  const lastMk = marketing.filter((m) => last.some((w) => w.week === m.week_start) && (m.sales ?? 0) > 0 && (m.labor ?? 0) > 0);
  const sales = lastMk.reduce((a, m) => a + (m.sales ?? 0), 0);
  const margin = sales ? 1 - lastMk.reduce((a, m) => a + (m.labor ?? 0), 0) / sales : 0;
  const firstTicket = useMemo(() => {
    const end = new Date(weekStartOf(cutoff) + "T00:00:00Z").getTime();
    const from = end - WINDOW * 7 * DAY;
    return avg(visits.filter((v) => v.status === "realizado" && v.is_first_visit && (v.price ?? 0) > 0 && new Date(v.week_start + "T00:00:00Z").getTime() >= from).map((v) => v.price!));
  }, [visits, cutoff]);
  const payback = firstTicket * margin ? cac / (firstTicket * margin) : 0;

  const reg = useMemo(() => spendRegression(weeks.filter((w) => w.week >= "2025-03-02")), [weeks]);
  const trend = useMemo(() => weeks.slice(-52).map((w, i, arr) => {
    const win = arr.slice(Math.max(0, i - 3), i + 1);
    const n = win.reduce((a, x) => a + x.nuevos, 0);
    return { label: fmtWeek(w.week), nuevos: w.nuevos, cac4: n ? Math.round(win.reduce((a, x) => a + x.spend, 0) / n) : null };
  }), [weeks]);

  const quality = useMemo(() => entryQuality(filtered, cutoff), [filtered, cutoff]);
  const mix = useMemo(() => entryMix(filtered, cutoff, filters.period === "12w" ? WINDOW : null), [filtered, cutoff, filters.period]);
  const pipe = useMemo(() => secondVisitPipeline(filtered, cutoff), [filtered, cutoff]);
  const tt = thumbtackSummary(thumbtack);
  const firstVisits = filtered.filter((v) => v.is_first_visit);
  const noSource = firstVisits.length ? firstVisits.filter((v) => !v.client_source || v.client_source.startsWith("Sin")).length / firstVisits.length : 0;
  const moveOut = quality.rows.find((r) => r.family === "Move Out");
  const standard = quality.rows.find((r) => r.family === "Standard");

  const fitLine = reg ? [0, Math.max(...reg.points.map((p) => p.spend))].map((x) => ({ spend: x, nuevos: reg.a + reg.b * x })) : [];
  const ttMonths = thumbtack.map((r) => ({ label: r.month.slice(2).replace("-", "/"), Cobrados: r.charged, "No cobrados": r.leads - r.charged }));

  return (
    <>
      <section className="card">
        <h2>Costo de conseguir clientes nuevos</h2>
        <p className="muted small">Promedios de las últimas {WINDOW} semanas completas. La pauta es global: no se separa por ciudad ni por servicio.</p>
        <div className="kpi-grid four" style={{ marginTop: 16 }}>
          <Stat label="Clientes nuevos por semana" value={fmt1(nuevos)} sub={`meta: ${fmt1(goalNew)} (${fmtPct(share)} de ${GOAL})`} />
          <Stat label="Pauta por semana" value={fmtUsd(spend)} sub={`ROAS del primer servicio: ${fmt1(roas)}x`} />
          <Stat label="CAC actual → objetivo" value={`${fmtUsd(cac)} → ${fmtUsd(cacTarget)}`} sub="con la misma pauta" accent />
          <Stat label="Servicios para recuperar el CAC" value={payback ? fmt1(payback) : "–"} sub={`margen de ${fmtUsd(firstTicket * margin)} por primer servicio`} />
        </div>
        <div className="chart">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={trend} margin={{ top: 12, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#E3E9F1" />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval={5} />
              <YAxis yAxisId="n" tick={AXIS} tickLine={false} axisLine={false} />
              <YAxis yAxisId="c" orientation="right" tick={AXIS} tickLine={false} axisLine={false} unit="$" />
              <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [n === "CAC (4 semanas)" ? fmtUsd(Number(v)) : fmtInt(Number(v)), String(n)]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="n" dataKey="nuevos" name="Clientes nuevos" fill="#8FB0FA" radius={[3, 3, 0, 0]} />
              <Line yAxisId="c" dataKey="cac4" name="CAC (4 semanas)" stroke="#151C25" strokeWidth={2} dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <SectionNote>
          El CAC usa toda la pauta entre todos los clientes nuevos, porque la fuente de cada cliente no está registrada. {payback <= 1.1 ? `El primer servicio apenas alcanza a pagar el CAC (${fmt1(payback)} servicios): la utilidad del cliente empieza en la segunda visita.` : `Hacen falta ${fmt1(payback)} servicios para pagar el CAC: un cliente que no regresa deja pérdida.`} Por eso la segunda visita es la que vuelve rentable la pauta.
        </SectionNote>
      </section>

      <section className="grid-2">
        <div className="card">
          <h2>¿Más pauta trae más clientes?</h2>
          <p className="muted small">Cada punto es una semana desde marzo 2025: pauta de la semana contra clientes nuevos</p>
          <div className="chart">
            <ResponsiveContainer width="100%" height={260}>
              <ScatterChart margin={{ top: 12, right: 12, left: -14, bottom: 0 }}>
                <CartesianGrid stroke="#E3E9F1" />
                <XAxis type="number" dataKey="spend" name="Pauta" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => `$${Math.round(v / 100) / 10}k`} />
                <YAxis type="number" dataKey="nuevos" name="Nuevos" tick={AXIS} tickLine={false} axisLine={false} />
                <ZAxis range={[40, 40]} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [n === "Pauta" ? fmtUsd(Number(v)) : fmt1(Number(v)), String(n)]} />
                <Scatter data={reg?.points ?? []} fill="#2E68F5" fillOpacity={0.55} />
                <Scatter data={fitLine} line={{ stroke: "#151C25", strokeWidth: 2 }} shape={() => <g />} legendType="none" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          {reg && (
            <div className="kpi-grid" style={{ marginTop: 10 }}>
              <Stat label="Nuevos extra por cada USD 100" value={fmt1(reg.b * 100)} sub={`R² = ${fmtPct(reg.r2)} · ${fmtInt(reg.n)} semanas`} />
              <Stat label="Costo de un cliente extra" value={reg.marginalCac ? fmtUsd(reg.marginalCac) : "–"} sub={`vs CAC promedio de ${fmtUsd(cac)}`} accent />
            </div>
          )}
          <SectionNote>
            Regresión lineal de clientes nuevos sobre la pauta semanal. La pauta explica alrededor de {reg ? fmtPct(reg.r2) : "–"} de la variación semanal de clientes nuevos: el resto depende de la temporada, de los referidos y de qué tan rápido se contesta y se cierra cada lead. Que el cliente extra cueste más que el promedio indica rendimientos decrecientes: subir la pauta sin mejorar el cierre encarece cada cliente.
          </SectionNote>
        </div>
        <div className="card">
          <h2>¿Qué primer servicio trae mejores clientes?</h2>
          <p className="muted small">Clientes con al menos 90 días desde su primera visita{isFiltered ? " (con los filtros elegidos)" : ""}</p>
          <div className="table-wrap">
            <table className="goal-table">
              <thead><tr><th>Primer servicio</th><th>Clientes</th><th>Regresan en 90 días</th><th>Ingreso por cliente</th></tr></thead>
              <tbody>
                {quality.rows.filter((r) => r.n >= 5).map((r) => (
                  <tr key={r.family}>
                    <td>{r.family}</td>
                    <td>{fmtInt(r.n)}</td>
                    <td className={r.conv90 >= quality.conv90 ? "up" : "down"}>{fmtPct(r.conv90)}</td>
                    <td>{fmtUsd(r.revenuePerClient)}</td>
                  </tr>
                ))}
                <tr className="strong"><td>Total</td><td>{fmtInt(quality.total)}</td><td>{fmtPct(quality.conv90)}</td><td></td></tr>
              </tbody>
            </table>
          </div>
          <SectionNote>
            {standard && moveOut ? `Un cliente que entra con Standard regresa en ${fmtPct(standard.conv90)} de los casos; uno de Move Out, en ${fmtPct(moveOut.conv90)}. ` : ""}
            Confirma lo que observa Kiki&apos;s: el Move Out casi no repite porque el cliente se va de la casa. Su valor está en el ticket y en las reseñas, no en la recurrencia; el CAC de esos clientes se tiene que pagar en el primer servicio.
            {quality.medianGap !== null && ` La segunda visita llega, en la mediana, ${fmtInt(quality.medianGap)} días después de la primera.`}
          </SectionNote>
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <h2>Bolsa de segunda visita</h2>
          <p className="muted small">Lo que Kiki&apos;s marca como LEAD: clientes de los últimos 90 días con una sola visita, sin servicio agendado y sin marca DND</p>
          <div className="kpi-grid" style={{ marginTop: 14 }}>
            <Stat label="Clientes por convertir" value={fmtInt(pipe.pool)} sub={`${fmtInt(pipe.poolMoveOut)} son Move Out (baja probabilidad)`} accent />
            <Stat label="Ticket de su primer servicio" value={fmtUsd(pipe.avgTicket)} sub="promedio" />
          </div>
          <SectionNote>
            Convertir {fmtInt(Math.round((pipe.pool - pipe.poolMoveOut) * 0.2))} de ellos (20% de los que no son Move Out) en recurrentes equivale a {fmt1(((pipe.pool - pipe.poolMoveOut) * 0.2) / (90 / 7))} clientes nuevos extra por semana sin gastar en pauta. Es el trabajo del check-in de 24 horas y del seguimiento a 30 días del sistema.
          </SectionNote>
        </div>
        <CategoryPieCard title="Primer servicio de los clientes nuevos" sub={filters.period === "12w" ? `últimas ${WINDOW} semanas` : "histórico"} data={mix} />
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Thumbtack</h2>
            <p className="muted small">
              {tt.months ? `Leads recibidos de ${fmtMonthEs(tt.first!)} a ${fmtMonthEs(tt.last!)}, según la bandeja exportada en el Excel` : "Sin datos de Thumbtack cargados"}
            </p>
          </div>
        </div>
        {tt.months > 0 && (
          <>
            <div className="kpi-grid four" style={{ marginTop: 12 }}>
              <Stat label="Leads" value={fmtInt(tt.leads)} sub={`${fmt1(tt.perMonth)} por mes`} />
              <Stat label="Cobrados por Thumbtack" value={fmtPct(tt.leads ? tt.charged / tt.leads : 0)} sub={`${fmtInt(tt.charged)} leads · ${fmtInt(tt.credited)} reembolsados`} />
              <Stat label="Llegaron por llamada" value={fmtPct(tt.leads ? tt.phone / tt.leads : 0)} sub="el resto, por mensaje" />
              <Stat label="Clientes identificados" value={`${fmtInt(tt.matched)} o más`} sub="cruce por nombre exacto" accent />
            </div>
            <div className="grid-2" style={{ marginTop: 6 }}>
              <div className="chart">
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={ttMonths} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#E3E9F1" />
                    <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
                    <YAxis tick={AXIS} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Cobrados" stackId="a" fill="#2E68F5" />
                    <Bar dataKey="No cobrados" stackId="a" fill="#C8D3E3" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="method">
                {tt.jobs.map((j) => <li key={j.name}><b>{j.name}:</b> {fmtPct(j.pct)} de los leads</li>)}
                <li><b>Sin tipo de trabajo:</b> {fmtPct(1 - tt.jobs.reduce((a, j) => a + j.pct, 0))}</li>
              </ul>
            </div>
            <SectionNote>
              Thumbtack cobra cada lead aunque no se cierre. La bandeja no trae el costo por lead ni el nombre completo del cliente (muchos leads solo tienen nombre de pila o ninguno), así que solo {fmtInt(tt.matched)} clientes se pueden ligar con certeza. Para saber si Thumbtack se paga hace falta su facturación mensual y registrar &quot;Thumbtack&quot; como fuente en cada cliente nuevo.
            </SectionNote>
          </>
        )}
      </section>

      <section className="card">
        <h2>¿De dónde llega cada cliente?</h2>
        <p className="muted small">Fuente identificada en la primera visita</p>
        <div className="kpi-grid" style={{ marginTop: 14 }}>
          <Stat label="Clientes sin fuente identificable" value={fmtPct(noSource)} sub={`de ${fmtInt(firstVisits.length)} clientes nuevos`} accent />
          <Stat label="Lo que falta para el CAC por canal" value="Fuente + gasto por canal" sub="Google Ads, Thumbtack, BNI, Melissa.com, referidos" />
        </div>
        <SectionNote>
          La columna &quot;Cold Call&quot; no es fuente: LEAD es un cliente que no ha repetido y CALL uno que solo necesita agendar. A partir de ahora, cada cliente nuevo debe registrar en GHL cómo llegó (Google, Thumbtack, BNI, Cámara de Comercio, Melissa.com, referido, otro), y el gasto se debe separar por canal. Con cuatro semanas de registro se activa el CAC por canal en esta sección.
        </SectionNote>
      </section>
    </>
  );
}

function CategoryPieCard({ title, sub, data }: { title: string; sub: string; data: { name: string; value: number; pct: number }[] }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <p className="muted small">{sub}</p>
      <CategoryPie title="" data={data} unit="clientes" />
    </div>
  );
}

const MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function fmtMonthEs(m: string) {
  const [y, mm] = m.split("-");
  return `${MONTHS_ES[Number(mm) - 1]} ${y}`;
}
