"use client";

import { useMemo, useState } from "react";
import { ALL, WINDOW, avg, distribution, fmt1, fmtInt, fmtPct, fmtUsd, hasLabor, weekStartOf, type Filters, type Visit } from "@/lib/metrics";
import { CategoryPie, SectionNote } from "@/components/ui";

type Props = { visits: Visit[]; cutoff: string; filters: Filters };

type Row = {
  city: string; region: string; services: number; clients: number; nuevos: number; perWeek: number;
  ticket: number; marginPct: number; share: number;
};
type SortKey = keyof Row;

const DAY = 86_400_000;

export default function Zonas({ visits, cutoff, filters }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "services", dir: -1 });
  const [showAll, setShowAll] = useState(false);

  // La ciudad del filtro se resalta, no se filtra: esta sección compara ciudades entre sí.
  const scoped = useMemo(() => visits.filter((v) => filters.service === ALL || v.service_family === filters.service), [visits, filters.service]);
  const end = new Date(weekStartOf(cutoff) + "T00:00:00Z").getTime();
  const weeks = filters.period === "12w" ? WINDOW : null;
  const from = weeks ? end - WINDOW * 7 * DAY : -Infinity;

  const rows = useMemo(() => {
    const done = scoped.filter((v) => {
      const t = new Date(v.week_start + "T00:00:00Z").getTime();
      return v.status === "realizado" && t >= from && t < end;
    });
    const nWeeks = weeks ?? Math.max(1, new Set(done.map((v) => v.week_start)).size);
    const total = done.length;
    const by = new Map<string, Visit[]>();
    for (const v of done) {
      const c = v.city ?? "Sin ciudad";
      if (!by.has(c)) by.set(c, []);
      by.get(c)!.push(v);
    }
    // Margen con el pago por servicio registrado (feb 2025 – mar 2026), sin importar el periodo.
    const laborBy = new Map<string, Visit[]>();
    for (const v of scoped) {
      if (v.status !== "realizado" || !hasLabor(v)) continue;
      const c = v.city ?? "Sin ciudad";
      if (!laborBy.has(c)) laborBy.set(c, []);
      laborBy.get(c)!.push(v);
    }
    return [...by.entries()].map(([city, vs]): Row => {
      const priced = (laborBy.get(city) ?? []).filter((v) => v.price! > 0);
      const p = avg(priced.map((v) => v.price!));
      const l = avg(priced.map((v) => v.labor_cost!));
      return {
        city, region: vs[0].region ?? "Sin región", services: vs.length,
        clients: new Set(vs.map((v) => v.client_id)).size,
        nuevos: vs.filter((v) => v.is_first_visit).length,
        perWeek: vs.length / nWeeks,
        ticket: avg(vs.filter((v) => (v.price ?? 0) > 0).map((v) => v.price!)),
        marginPct: p ? (p - l) / p : 0,
        share: total ? vs.length / total : 0,
      };
    });
  }, [scoped, from, end, weeks]);

  const sorted = [...rows].sort((a, b) => {
    const x = a[sort.key], y = b[sort.key];
    return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "es")) * sort.dir;
  });
  const shown = showAll ? sorted : sorted.slice(0, 20);
  const top = [...rows].sort((a, b) => b.services - a.services).slice(0, 15);
  const regions = distribution(scoped, "region", cutoff, filters.period);
  const top5 = top.slice(0, 5).reduce((a, r) => a + r.share, 0);
  const avgMargin = avg(rows.filter((r) => r.services >= 10).map((r) => r.marginPct));

  const head = (key: SortKey, label: string) => (
    <th>
      <button className="th-sort" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }))}>
        {label}{sort.key === key ? (sort.dir === -1 ? " ↓" : " ↑") : ""}
      </button>
    </th>
  );

  return (
    <>
      <section className="grid-2">
        <div className="card">
          <h2>Dónde se concentran los servicios</h2>
          <p className="muted small">
            {fmtInt(rows.length)} ciudades con servicio en el periodo. Las 5 principales concentran el <b>{fmtPct(top5)}</b> de los servicios.
          </p>
          <ul className="bars city-bars">
            {top.map((r) => (
              <li key={r.city} className={r.city === filters.city ? "hl" : ""}>
                <span>{r.city}</span>
                <div className="mini-progress wide"><span style={{ width: `${(r.services / (top[0]?.services || 1)) * 100}%` }} /></div>
                <b>{fmtInt(r.services)}</b>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h2>Por región</h2>
          <p className="muted small">Regiones definidas en la hoja de agenda de Kiki&apos;s</p>
          <div style={{ maxWidth: 360 }}><CategoryPie title="" data={regions} /></div>
          <SectionNote>
            Norte: McKinney, Frisco, Allen, Anna, Prosper… · Oeste: Carrollton, Lewisville, The Colony, Irving… · Este / Dallas: Dallas, Plano, Richardson, Garland…
            {avgMargin ? ` Margen promedio por ciudad (con 10+ servicios): ${fmtPct(avgMargin)}*.` : ""}
          </SectionNote>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Las {fmtInt(rows.length)} ciudades</h2>
            <p className="muted small">Ordena por cualquier columna. {filters.city !== ALL && `${filters.city} aparece resaltada.`}</p>
          </div>
          {sorted.length > 20 && (
            <button className="btn-ghost" onClick={() => setShowAll((s) => !s)}>{showAll ? "Ver 20" : `Ver las ${sorted.length}`}</button>
          )}
        </div>
        <div className="table-wrap">
          <table className="goal-table sortable">
            <thead>
              <tr>
                {head("city", "Ciudad")}{head("region", "Región")}{head("services", "Servicios")}{head("perWeek", "Por semana")}
                {head("clients", "Clientes")}{head("nuevos", "Nuevos")}{head("ticket", "Ticket")}{head("marginPct", "Margen % *")}{head("share", "% del total")}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.city} className={r.city === filters.city ? "hl" : ""}>
                  <td>{r.city}</td><td className="muted">{r.region}</td><td>{fmtInt(r.services)}</td><td>{fmt1(r.perWeek)}</td>
                  <td>{fmtInt(r.clients)}</td><td>{fmtInt(r.nuevos)}</td><td>{fmtUsd(r.ticket)}</td>
                  <td>{r.marginPct ? fmtPct(r.marginPct) : "–"}</td><td>{fmtPct(r.share, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <SectionNote>
          * Margen calculado con el pago por servicio registrado de feb 2025 a mar 2026 (después solo existe la nómina semanal). Densidad = servicios por semana en la ciudad. Las ciudades con pocos servicios y margen bajo son candidatas a revisar precio mínimo o a dejar de pautar.
        </SectionNote>
      </section>
    </>
  );
}
