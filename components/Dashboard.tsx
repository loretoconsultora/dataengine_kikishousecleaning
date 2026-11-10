"use client";

import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  ALL, WINDOW, applyFilters, avg, distribution, fmt1, fmtInt, fmtPct, fmtUsd, fmtWeek, lastWeeks, marketingAvg,
  scheduledAhead, weeklyClients, type Filters, type Visit, type WeekMarketing,
} from "@/lib/metrics";
import { GLOSSARY } from "@/lib/glossary";

const PALETTE = ["#2E68F5", "#151C25", "#8FB0FA", "#F2A541", "#3FB68B", "#E5677A", "#8B6FE8", "#B9C4D3", "#5BC0DE"];
const C_NEW = "#2E68F5";
const C_REC = "#151C25";

const SECTIONS = [
  { id: "resumen", label: "Resumen", ready: true },
  { id: "adquisicion", label: "Adquisición" },
  { id: "retencion", label: "Retención" },
  { id: "monetizacion", label: "Monetización" },
  { id: "zonas", label: "Zonas" },
  { id: "operacion", label: "Operación y capacidad" },
  { id: "escenarios", label: "Escenarios" },
  { id: "mercado", label: "Análisis de mercado" },
];

type Props = { visits: Visit[]; marketing: WeekMarketing[]; cutoff: string; userEmail: string };

export default function Dashboard({ visits, marketing, cutoff, userEmail }: Props) {
  const [filters, setFilters] = useState<Filters>({ city: ALL, service: ALL, period: "12w" });
  const [goal, setGoal] = useState(100);
  const [glossaryOpen, setGlossaryOpen] = useState(false);

  const cities = useMemo(() => uniqueSorted(visits.map((v) => v.city)), [visits]);
  const services = useMemo(() => uniqueSorted(visits.map((v) => v.service_family)), [visits]);
  const filtered = useMemo(() => applyFilters(visits, filters), [visits, filters]);
  const isFiltered = filters.city !== ALL || filters.service !== ALL;

  // ---- clientes por semana ----
  const weeks = useMemo(() => lastWeeks(weeklyClients(filtered, cutoff), cutoff), [filtered, cutoff]);
  const globalWeeks = useMemo(() => lastWeeks(weeklyClients(visits, cutoff), cutoff), [visits, cutoff]);
  const now = {
    clients: avg(weeks.map((w) => w.clients)),
    nuevos: avg(weeks.map((w) => w.nuevos)),
    recurrentes: avg(weeks.map((w) => w.recurrentes)),
  };
  const shareNew = now.clients ? now.nuevos / now.clients : 0;
  const [newShareInput, setNewShareInput] = useState<number | null>(null);
  const targetShare = newShareInput ?? Math.round(shareNew * 100) / 100;
  const target = { nuevos: goal * targetShare, recurrentes: goal * (1 - targetShare) };
  const lastWeek = weeks[weeks.length - 1];

  // ---- pauta, CAC y ROAS (pauta global: no se separa por ciudad ni servicio) ----
  const spend = marketingAvg(marketing, globalWeeks.map((w) => w.week));
  const globalNew = avg(globalWeeks.map((w) => w.nuevos));
  const globalTargetNew = goal * targetShare;
  const cac = globalNew ? spend / globalNew : 0;
  const cacTarget = globalTargetNew ? spend / globalTargetNew : 0;
  const roas = spend ? avg(globalWeeks.map((w) => w.ingresosNuevos)) / spend : 0;

  // ---- distribuciones y agenda ----
  const pieNewRec = [
    { name: "Recurrentes", value: now.recurrentes, color: C_REC },
    { name: "Nuevos", value: now.nuevos, color: C_NEW },
  ];
  const pieGoal = [
    { name: "Recurrentes", value: target.recurrentes, color: C_REC },
    { name: "Nuevos", value: target.nuevos, color: C_NEW },
  ];
  const sizes = useMemo(() => distribution(filtered, "size_bucket", cutoff, filters.period), [filtered, cutoff, filters.period]);
  const families = useMemo(() => distribution(filtered, "service_family", cutoff, filters.period), [filtered, cutoff, filters.period]);
  const freqs = useMemo(() => distribution(filtered, "frequency", cutoff, filters.period), [filtered, cutoff, filters.period]);
  const sources = useMemo(() => distribution(filtered, "client_source", cutoff, filters.period), [filtered, cutoff, filters.period]);
  const ahead = useMemo(() => scheduledAhead(filtered, cutoff), [filtered, cutoff]);
  const aheadAvg = avg(ahead.slice(0, 7).map((a) => a.clients));

  const chartWeeks = weeks.map((w) => ({ ...w, label: fmtWeek(w.week) }));
  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="side-brand">
          <span className="brand-mark" aria-hidden="true">DE</span>
          <div>
            <b>Data Engine</b>
            <span>Kiki&apos;s House Cleaning</span>
          </div>
        </div>
        <nav aria-label="Secciones">
          {SECTIONS.map((s) => (
            <a key={s.id} className={s.ready ? "nav-item active" : "nav-item disabled"} aria-disabled={!s.ready}>
              {s.label}
              {!s.ready && <span className="soon">Próximamente</span>}
            </a>
          ))}
        </nav>
        <div className="side-foot">
          <span className="muted small">{userEmail}</span>
          <form action="/auth/signout" method="post">
            <button className="btn-link">Cerrar sesión</button>
          </form>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <h1>Resumen</h1>
            <p className="muted small">
              Datos al {new Date(cutoff + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })} ·
              promedios de las últimas {WINDOW} semanas completas
            </p>
          </div>
          <div className="filters">
            <label>
              Ciudad
              <select value={filters.city} onChange={set("city")}>
                <option value={ALL}>Todas</option>
                {cities.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label>
              Tipo de servicio
              <select value={filters.service} onChange={set("service")}>
                <option value={ALL}>Todos</option>
                {services.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <button className="btn-ghost" onClick={() => setGlossaryOpen(true)}>Glosario</button>
          </div>
        </header>

        {/* ---- Métrica principal ---- */}
        <section className="card hero">
          <div className="hero-main">
            <span className="eyebrow">Clientes distintos por semana</span>
            <div className="hero-figure">
              <strong>{fmt1(now.clients)}</strong>
              <span>de {goal}</span>
            </div>
            <div className="progress" role="progressbar" aria-valuenow={Math.round((now.clients / goal) * 100)} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${Math.min(100, (now.clients / goal) * 100)}%` }} />
            </div>
            <p className="muted small">
              {fmtPct(now.clients / goal)} de la meta · faltan {fmt1(Math.max(0, goal - now.clients))} clientes por semana
              {isFiltered && " (con los filtros aplicados)"}
            </p>
          </div>
          <div className="hero-side">
            <Stat label="Recurrentes" value={fmt1(now.recurrentes)} sub={fmtPct(1 - shareNew)} />
            <Stat label="Nuevos" value={fmt1(now.nuevos)} sub={fmtPct(shareNew)} />
            <Stat label="Última semana" value={fmtInt(lastWeek?.clients ?? 0)} sub={lastWeek ? `semana del ${fmtWeek(lastWeek.week)}` : ""} />
          </div>
        </section>

        {/* ---- Hoy vs meta ---- */}
        <section className="grid-2">
          <div className="card">
            <h2>Hoy</h2>
            <p className="muted small">Mezcla de clientes por semana</p>
            <MixPie data={pieNewRec} total={now.clients} />
          </div>
          <div className="card">
            <div className="card-head">
              <div>
                <h2>Meta</h2>
                <p className="muted small">Ajusta la meta y la mezcla para ver cuántos nuevos y recurrentes se necesitan</p>
              </div>
            </div>
            <div className="goal-controls">
              <label>
                Clientes por semana
                <input type="number" min={1} value={goal} onChange={(e) => setGoal(Math.max(1, Number(e.target.value) || 1))} />
              </label>
              <label className="grow">
                % de nuevos: <b>{fmtPct(targetShare)}</b>
                <input type="range" min={0.05} max={0.6} step={0.01} value={targetShare} onChange={(e) => setNewShareInput(Number(e.target.value))} />
              </label>
              {newShareInput !== null && (
                <button className="btn-link" onClick={() => setNewShareInput(null)}>Usar mezcla actual</button>
              )}
            </div>
            <MixPie data={pieGoal} total={goal} />
          </div>
        </section>

        <section className="card">
          <h2>Del punto de partida a la meta</h2>
          <div className="table-wrap">
            <table className="goal-table">
              <thead>
                <tr><th>Grupo</th><th>Hoy (prom.)</th><th>Meta</th><th>Incremento</th><th>Última semana</th><th>Cumplimiento</th></tr>
              </thead>
              <tbody>
                <GoalRow name="Recurrentes" color={C_REC} now={now.recurrentes} goal={target.recurrentes} last={lastWeek?.recurrentes ?? 0} />
                <GoalRow name="Nuevos" color={C_NEW} now={now.nuevos} goal={target.nuevos} last={lastWeek?.nuevos ?? 0} />
                <GoalRow name="Total" now={now.clients} goal={goal} last={lastWeek?.clients ?? 0} strong />
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid-2">
          <div className="card">
            <h2>Clientes por semana</h2>
            <p className="muted small">Últimas {WINDOW} semanas completas, contra la meta</p>
            <div className="chart">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartWeeks} margin={{ top: 16, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#E3E9F1" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#7B8592" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#7B8592" }} tickLine={false} axisLine={false} domain={[0, Math.ceil((Math.max(goal, ...chartWeeks.map((w) => w.clients)) * 1.1) / 10) * 10]} allowDecimals={false} />
                  <Tooltip cursor={{ fill: "#F3F7FF" }} contentStyle={tooltipStyle} />
                  <ReferenceLine y={goal} stroke="#2E68F5" strokeDasharray="5 5" label={{ value: `Meta ${goal}`, position: "insideTopRight", fill: "#2E68F5", fontSize: 12 }} />
                  <Bar dataKey="recurrentes" name="Recurrentes" stackId="a" fill={C_REC} />
                  <Bar dataKey="nuevos" name="Nuevos" stackId="a" fill={C_NEW} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h2>Pauta y costo de adquisición</h2>
            <p className="muted small">El presupuesto de pauta se mantiene igual; lo que cambia es cuántos clientes trae cada dólar</p>
            <div className="kpi-grid">
              <Stat label="Pauta semanal promedio" value={fmtUsd(spend)} />
              <Stat label="CAC actual" value={fmtUsd(cac)} sub={`${fmt1(globalNew)} nuevos por semana`} />
              <Stat label="CAC objetivo" value={fmtUsd(cacTarget)} sub={`para ${fmt1(globalTargetNew)} nuevos por semana`} accent />
              <Stat label="ROAS (primer servicio)" value={`${fmt1(roas)}x`} sub="ingreso del primer servicio ÷ pauta" />
            </div>
            <p className="muted small note">
              Reducción de CAC necesaria: <b>{cac ? fmtPct(1 - cacTarget / cac) : "–"}</b>.
              {isFiltered && " La pauta es global, así que el CAC y el ROAS no cambian con los filtros."}
            </p>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>Composición de los servicios</h2>
              <p className="muted small">Porcentaje de servicios realizados {filters.city !== ALL && `en ${filters.city}`}</p>
            </div>
            <div className="seg" role="group" aria-label="Periodo">
              <button aria-pressed={filters.period === "12w"} onClick={() => setFilters((f) => ({ ...f, period: "12w" }))}>Últimas 12 semanas</button>
              <button aria-pressed={filters.period === "all"} onClick={() => setFilters((f) => ({ ...f, period: "all" }))}>Histórico</button>
            </div>
          </div>
          <div className="pie-grid">
            <CategoryPie title="Tamaño de casa" data={sizes} />
            <CategoryPie title="Tipo de servicio" data={families} />
            <CategoryPie title="Frecuencia" data={freqs} />
            <CategoryPie title="Fuente del cliente" data={sources} />
          </div>
          <p className="muted small note">Tipo de servicio, frecuencia y fuente son clasificaciones provisionales, pendientes de validar con Kiki&apos;s.</p>
        </section>

        <section className="card">
          <h2>Agendados por adelantado</h2>
          <p className="muted small">
            Clientes distintos que ya tienen servicio agendado. Promedio de las próximas 7 semanas: <b>{fmt1(aheadAvg)}</b>
            {now.clients ? ` (${fmtPct(aheadAvg / now.clients)} del promedio semanal actual)` : ""}
          </p>
          <div className="chart">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={ahead.map((a) => ({ ...a, label: fmtWeek(a.week) }))} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#E3E9F1" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#7B8592" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#7B8592" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: "#F3F7FF" }} contentStyle={tooltipStyle} />
                <Bar dataKey="clients" name="Clientes agendados" fill="#8FB0FA" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </main>

      {glossaryOpen && (
        <div className="drawer-backdrop" onClick={() => setGlossaryOpen(false)}>
          <aside className="drawer" role="dialog" aria-modal="true" aria-label="Glosario" onClick={(e) => e.stopPropagation()}>
            <div className="card-head">
              <h2>Glosario de indicadores</h2>
              <button className="btn-ghost" onClick={() => setGlossaryOpen(false)}>Cerrar</button>
            </div>
            <dl className="glossary">
              {GLOSSARY.map((g) => (
                <div key={g.term}>
                  <dt>{g.term}</dt>
                  <dd>
                    {g.definition}
                    {g.formula && <code>{g.formula}</code>}
                  </dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      )}
    </div>
  );
}

const tooltipStyle = { borderRadius: 12, border: "1px solid #E3E9F1", boxShadow: "0 8px 24px -12px rgba(21,28,37,.2)", fontSize: 13 };

function uniqueSorted(xs: (string | null)[]) {
  return [...new Set(xs.filter((x): x is string => !!x && !x.startsWith("Sin ")))].sort((a, b) => a.localeCompare(b, "es"));
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={accent ? "stat accent" : "stat"}>
      <span>{label}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}

function GoalRow({ name, color, now, goal, last, strong }: { name: string; color?: string; now: number; goal: number; last: number; strong?: boolean }) {
  const inc = now ? goal / now - 1 : 0;
  const done = goal ? last / goal : 0;
  return (
    <tr className={strong ? "strong" : ""}>
      <td>{color && <span className="dot" style={{ background: color }} />}{name}</td>
      <td>{fmt1(now)}</td>
      <td>{fmt1(goal)}</td>
      <td className={inc > 0 ? "up" : ""}>{inc > 0 ? "+" : ""}{fmtPct(inc)}</td>
      <td>{fmtInt(last)}</td>
      <td>
        <div className="mini-progress"><span style={{ width: `${Math.min(100, done * 100)}%` }} /></div>
        {fmtPct(done)}
      </td>
    </tr>
  );
}

function MixPie({ data, total }: { data: { name: string; value: number; color: string }[]; total: number }) {
  const sum = data.reduce((a, b) => a + b.value, 0);
  return (
    <div className="mix">
      <div className="pie-box">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={2} stroke="none" isAnimationActive={false}>
              {data.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pie-center"><strong>{fmt1(total)}</strong><span>por semana</span></div>
      </div>
      <ul className="legend">
        {data.map((d) => (
          <li key={d.name}>
            <span className="dot" style={{ background: d.color }} />
            <span>{d.name}</span>
            <b>{fmtPct(sum ? d.value / sum : 0)}</b>
            <span className="muted">{fmt1(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CategoryPie({ title, data }: { title: string; data: { name: string; value: number; pct: number }[] }) {
  // Las categorías pequeñas se agrupan en "Otras" para que el pastel se lea.
  const top = data.slice(0, 6);
  const rest = data.slice(6);
  const shown = rest.length
    ? [...top, { name: "Otras", value: rest.reduce((a, b) => a + b.value, 0), pct: rest.reduce((a, b) => a + b.pct, 0) }]
    : top;
  return (
    <div className="cat-pie">
      <h3>{title}</h3>
      {shown.length ? (
        <>
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie data={shown} dataKey="value" nameKey="name" innerRadius={42} outerRadius={72} paddingAngle={1.5} stroke="none" isAnimationActive={false}>
                {shown.map((d, i) => <Cell key={d.name} fill={PALETTE[i % PALETTE.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [fmtInt(Number(v ?? 0)) + " servicios", String(n)]} />
            </PieChart>
          </ResponsiveContainer>
          <ul className="legend compact">
            {shown.map((d, i) => (
              <li key={d.name}>
                <span className="dot" style={{ background: PALETTE[i % PALETTE.length] }} />
                <span>{d.name}</span>
                <b>{fmtPct(d.pct)}</b>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="muted small">Sin servicios con estos filtros.</p>
      )}
    </div>
  );
}
