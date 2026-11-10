"use client";

import { useMemo } from "react";
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ALL, WINDOW, avg, fmtInt, fmtPct, fmtUsd, fmtWeek, hasLabor, weekStartOf, type Filters, type Visit, type WeekMarketing } from "@/lib/metrics";
import { PRICE_LIST, listPrice, listRow } from "@/lib/prices";
import { AXIS, SectionNote, Stat, tooltipStyle } from "@/components/ui";

type Props = { filtered: Visit[]; marketing: WeekMarketing[]; cutoff: string; filters: Filters };

const ADDONS: { key: keyof Visit; label: string }[] = [
  { key: "addon_laundry", label: "Lavandería" },
  { key: "addon_baseboards", label: "Zoclos (baseboards)" },
  { key: "addon_windows", label: "Ventanas" },
  { key: "addon_oven", label: "Horno" },
  { key: "addon_fridge", label: "Refrigerador" },
  { key: "addon_cabinets", label: "Gabinetes" },
];

const DAY = 86_400_000;
// Visitas por mes según la frecuencia contratada (52 semanas ÷ 12 meses).
const RECENT_DAYS = 120;
const VISITS_PER_MONTH: Record<string, number> = { Semanal: 4.33, Quincenal: 2.17, Mensual: 1 };

export default function Monetizacion({ filtered, marketing, cutoff, filters }: Props) {
  const end = new Date(weekStartOf(cutoff) + "T00:00:00Z").getTime();
  const from = filters.period === "12w" ? end - WINDOW * 7 * DAY : -Infinity;
  const done = useMemo(
    () => filtered.filter((v) => {
      const t = new Date(v.week_start + "T00:00:00Z").getTime();
      return v.status === "realizado" && t >= from && t < end;
    }),
    [filtered, from, end]
  );
  const priced = done.filter((v) => (v.price ?? 0) > 0);
  // Pago por servicio confiable solo existe de feb 2025 a ~mar 2026 (después se registra la nómina semanal).
  const withLabor = useMemo(() => filtered.filter((v) => v.status === "realizado" && hasLabor(v)), [filtered]);
  const laborRange = withLabor.length
    ? `${fmtMonthLong(withLabor.reduce((a, v) => (v.visit_date < a ? v.visit_date : a), "9999"))} a ${fmtMonthLong(withLabor.reduce((a, v) => (v.visit_date > a ? v.visit_date : a), ""))}`
    : "";

  const ticket = avg(priced.map((v) => v.price!));
  // Propinas negativas en el Excel son descuentos: no cuentan como propina.
  const tipOf = (v: Visit) => Math.max(0, v.tip ?? 0);
  const tip = avg(priced.map(tipOf));
  const tipPct = ticket ? tip / ticket : 0;
  // Margen del periodo con la nómina semanal de la hoja KPI (global, no se separa por ciudad ni servicio).
  const wk = marketing.filter((m) => {
    const t = new Date(m.week_start + "T00:00:00Z").getTime();
    return t >= from && t < end && (m.sales ?? 0) > 0 && (m.labor ?? 0) > 0;
  });
  const sumSales = wk.reduce((a, m) => a + (m.sales ?? 0), 0);
  const sumLabor = wk.reduce((a, m) => a + (m.labor ?? 0), 0);
  const marginPct = sumSales ? 1 - sumLabor / sumSales : 0;
  const margin = ticket * marginPct;
  const isFiltered = filters.city !== ALL || filters.service !== ALL;
  const withAddon = done.filter((v) => ADDONS.some((a) => v[a.key])).length;

  // ---- tendencia semanal ----
  const weekly = useMemo(() => {
    const m = new Map<string, { p: number[]; t: number[] }>();
    for (const v of priced) {
      if (!m.has(v.week_start)) m.set(v.week_start, { p: [], t: [] });
      m.get(v.week_start)!.p.push(v.price!);
      m.get(v.week_start)!.t.push(tipOf(v));
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-WINDOW).map(([w, x]) => ({
      label: fmtWeek(w), ticket: Math.round(avg(x.p)), propina: Math.round(avg(x.t)),
    }));
  }, [priced]);

  // Kiki's sube precios gradualmente; la lista vigente tiene ~90-180 días. Lo comparable con la lista es lo cobrado reciente.
  const recentStd = useMemo(() => {
    const since = new Date(cutoff + "T00:00:00Z").getTime() - RECENT_DAYS * DAY;
    return filtered.filter((v) => v.status === "realizado" && v.service_family === "Standard" && (v.price ?? 0) > 0 && new Date(v.visit_date + "T00:00:00Z").getTime() >= since);
  }, [filtered, cutoff]);

  // ---- precio y margen por tamaño de casa (Standard) ----
  const bySize = useMemo(() => {
    return PRICE_LIST.map((row) => {
      const rs = recentStd.filter((v) => listRow(v.bedrooms, v.bathrooms) === row);
      const recent = avg(rs.map((v) => v.price!));
      const recentList = avg(rs.map((v) => listPrice(row, v.frequency)));
      const vs = withLabor.filter((v) => v.service_family === "Standard" && listRow(v.bedrooms, v.bathrooms) === row);
      const price = avg(vs.map((v) => v.price!));
      const labor = avg(vs.map((v) => v.labor_cost!));
      const list = avg(vs.map((v) => listPrice(row, v.frequency)));
      return {
        label: row.label, hours: row.hours, n: vs.length, price, labor, list: rs.length ? recentList : list,
        nRecent: rs.length, recent,
        gap: rs.length && recentList ? recent / recentList - 1 : null,
        marginHour: vs.length ? (price - labor) / row.hours : 0,
        marginPct: price ? (price - labor) / price : 0,
      };
    });
  }, [withLabor, recentStd]);
  const chartSize = bySize.filter((r) => r.n >= 3).map((r) => ({
    label: r.label.replace(" / ", "/"), "Precio real": Math.round(r.price), "Cobrado últimos 120 días": r.nRecent ? Math.round(r.recent) : null, "Precio de lista": Math.round(r.list),
    "Margen por hora": Math.round(r.marginHour),
  }));

  // ---- por frecuencia ----
  const byFreq = useMemo(() => {
    const groups = new Map<string, Visit[]>();
    for (const v of withLabor) {
      const f = v.frequency ?? "Sin dato";
      if (!groups.has(f)) groups.set(f, []);
      groups.get(f)!.push(v);
    }
    return [...groups.entries()].map(([f, vs]) => {
      const p = avg(vs.map((v) => v.price!));
      const l = avg(vs.map((v) => v.labor_cost!));
      return { f, n: vs.length, price: p, labor: l, margin: p - l, pct: p ? (p - l) / p : 0, tip: avg(vs.map(tipOf)), perMonth: (p - l) * (VISITS_PER_MONTH[f] ?? 1) };
    }).sort((a, b) => b.n - a.n);
  }, [withLabor]);

  return (
    <>
      <section className="card">
        <div className="card-head">
          <div>
            <h2>Cuánto deja cada servicio</h2>
            <p className="muted small">{filters.period === "12w" ? `Últimas ${WINDOW} semanas completas` : "Histórico"} · {fmtInt(done.length)} servicios realizados</p>
          </div>
        </div>
        <div className="kpi-grid four">
          <Stat label="Ticket promedio" value={fmtUsd(ticket)} sub="precio sin propina" />
          <Stat label="Propina promedio" value={fmtUsd(tip)} sub={`${fmtPct(tipPct, 1)} del ticket`} />
          <Stat label="Margen de contribución" value={fmtPct(marginPct)} sub={`≈ ${fmtUsd(margin)} por servicio · nómina ${fmtPct(1 - marginPct)}`} accent />
          <Stat label="Servicios con add-on" value={fmtPct(done.length ? withAddon / done.length : 0)} sub="según la descripción del servicio" />
        </div>
        <SectionNote>
          Margen de contribución = ventas − nómina de limpiadoras, con los totales semanales de la hoja KPI. No incluye insumos, pauta ni gastos fijos.
          {isFiltered && " Este margen es global: la nómina semanal no se puede separar por ciudad ni servicio."}
        </SectionNote>
      </section>

      <section className="card">
        <h2>¿El precio por tamaño de casa es lineal?</h2>
        <p className="muted small">
          Servicio Standard. Precio real y margen por hora con el pago por servicio registrado ({laborRange}); lo cobrado en los últimos 120 días contra la lista vigente
        </p>
        <div className="chart">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartSize} margin={{ top: 10, right: 8, left: -6, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#E3E9F1" />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval={0} />
              <YAxis yAxisId="p" tick={AXIS} tickLine={false} axisLine={false} unit="$" />
              <YAxis yAxisId="h" orientation="right" tick={AXIS} tickLine={false} axisLine={false} unit="$/h" />
              <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [`USD ${v}`, String(n)]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="p" dataKey="Precio real" fill="#151C25" radius={[6, 6, 0, 0]} />
              <Bar yAxisId="p" dataKey="Cobrado últimos 120 días" fill="#2E68F5" radius={[6, 6, 0, 0]} />
              <Bar yAxisId="p" dataKey="Precio de lista" fill="#C8D3E3" radius={[6, 6, 0, 0]} />
              <Line yAxisId="h" dataKey="Margen por hora" stroke="#2E68F5" strokeWidth={3} dot={{ r: 4, fill: "#fff", strokeWidth: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="table-wrap">
          <table className="goal-table">
            <thead><tr><th>Tamaño</th><th>Servicios</th><th>Precio real</th><th>Pago limpiadora</th><th>Margen %</th><th>Margen por hora</th><th>Cobrado últimos 120 días</th><th>Precio de lista</th><th>Diferencia actual</th></tr></thead>
            <tbody>
              {bySize.filter((r) => r.n > 0).map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td>{fmtInt(r.n)}</td>
                  <td>{fmtUsd(r.price)}</td>
                  <td>{fmtUsd(r.labor)}</td>
                  <td>{fmtPct(r.marginPct)}</td>
                  <td><b>{fmtUsd(r.marginHour)}</b></td>
                  <td>{r.nRecent ? `${fmtUsd(r.recent)} (${fmtInt(r.nRecent)})` : "–"}</td>
                  <td>{fmtUsd(r.list)}</td>
                  <td className={r.gap === null ? "" : r.gap < -0.03 ? "down" : r.gap > 0.03 ? "up" : ""}>{r.gap === null ? "–" : `${r.gap > 0 ? "+" : ""}${fmtPct(r.gap)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <SectionNote>
          Kiki&apos;s sube precios de forma gradual y la lista vigente tiene entre 90 y 180 días, así que solo lo cobrado en los últimos 120 días se compara con ella (entre paréntesis, servicios). Si el margen por hora baja en las casas grandes, el precio no está creciendo al ritmo del trabajo.
        </SectionNote>
      </section>

      <section className="grid-2">
        <div className="card">
          <h2>¿Cuánto se cobra por servicio cada semana?</h2>
          <p className="muted small">
            Cada barra es una semana: en negro el precio promedio por servicio y en azul la propina promedio que se suma encima. Últimas {WINDOW} semanas.
          </p>
          <div className="chart">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={weekly} margin={{ top: 10, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#E3E9F1" />
                <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [`USD ${v}`, String(n)]} />
                <Bar dataKey="ticket" name="Ticket" stackId="a" fill="#151C25" />
                <Bar dataKey="propina" name="Propina" stackId="a" fill="#2E68F5" radius={[6, 6, 0, 0]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <SectionNote>
            El precio es estable; la propina es baja e irregular ({fmtPct(tipPct, 1)} del ticket). Un cobro con tarjeta que sugiera propina al pagar suele subirla.
          </SectionNote>
        </div>
        <div className="card">
          <h2>¿Qué frecuencia deja más?</h2>
          <p className="muted small">Por servicio y por cliente al mes. Margen = precio − pago a la limpiadora ({laborRange}).</p>
          <div className="table-wrap">
            <table className="goal-table">
              <thead><tr><th>Frecuencia</th><th>Servicios</th><th>Precio</th><th>Margen por servicio</th><th>Propina</th><th>Margen por cliente al mes</th></tr></thead>
              <tbody>
                {byFreq.map((r) => (
                  <tr key={r.f}><td>{r.f}</td><td>{fmtInt(r.n)}</td><td>{fmtUsd(r.price)}</td><td>{fmtUsd(r.margin)} <span className="muted">({fmtPct(r.pct)})</span></td><td>{fmtUsd(r.tip)}</td><td><b>{VISITS_PER_MONTH[r.f] ? fmtUsd(r.perMonth) : "–"}</b></td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <SectionNote>
            Por servicio, el cliente semanal paga menos; pero hace unas 4 visitas al mes, así que deja más margen por cliente.
            Pasar clientes de mensual a quincenal es una de las palancas más rentables. Margen por cliente al mes = margen por servicio × visitas al mes (semanal 4.33, quincenal 2.17, mensual 1).
          </SectionNote>
          <h3 style={{ marginTop: 20 }}>Add-ons</h3>
          <ul className="bars">
            {ADDONS.map((a) => {
              const n = done.filter((v) => v[a.key]).length;
              const p = done.length ? n / done.length : 0;
              return (
                <li key={a.label}>
                  <span>{a.label}</span>
                  <div className="mini-progress wide"><span style={{ width: `${Math.min(100, p * 400)}%` }} /></div>
                  <b>{fmtPct(p, 1)}</b>
                </li>
              );
            })}
          </ul>
          <SectionNote>Detectados en la descripción libre del servicio; el registro real de add-ons empieza con el sistema de reservas. Barra a escala 0–25%.</SectionNote>
        </div>
      </section>
    </>
  );
}

function fmtMonthLong(d: string) {
  return new Date(d.slice(0, 7) + "-01T00:00:00Z").toLocaleDateString("es-MX", { month: "short", year: "numeric", timeZone: "UTC" });
}
