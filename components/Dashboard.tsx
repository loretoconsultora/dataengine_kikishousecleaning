"use client";

import { useEffect, useMemo, useState } from "react";
import { ALL, WINDOW, applyFilters, type Filters, type Visit, type WeekMarketing } from "@/lib/metrics";
import { GLOSSARY } from "@/lib/glossary";
import Resumen from "@/components/sections/Resumen";
import Retencion from "@/components/sections/Retencion";
import Monetizacion from "@/components/sections/Monetizacion";
import Zonas from "@/components/sections/Zonas";

const SECTIONS = [
  { id: "resumen", label: "Resumen", ready: true, desc: "La meta de 100 clientes por semana" },
  { id: "adquisicion", label: "Adquisición" },
  { id: "retencion", label: "Retención", ready: true, desc: "Quién regresa, quién se va y cuánto vale cada cliente" },
  { id: "monetizacion", label: "Monetización", ready: true, desc: "Ticket, propinas, add-ons y margen por servicio" },
  { id: "zonas", label: "Zonas", ready: true, desc: "Volumen, ticket y margen en las ciudades que atiende Kiki's" },
  { id: "operacion", label: "Operación y capacidad" },
  { id: "escenarios", label: "Escenarios" },
  { id: "mercado", label: "Análisis de mercado" },
] as { id: string; label: string; ready?: boolean; desc?: string }[];

type Props = { visits: Visit[]; marketing: WeekMarketing[]; cutoff: string; userEmail: string };

export default function Dashboard({ visits, marketing, cutoff, userEmail }: Props) {
  const [filters, setFilters] = useState<Filters>({ city: ALL, service: ALL, period: "12w" });
  const [section, setSection] = useState("resumen");
  const [glossaryOpen, setGlossaryOpen] = useState(false);

  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (SECTIONS.some((s) => s.id === h && s.ready)) setSection(h);
  }, []);
  const go = (id: string) => {
    setSection(id);
    history.replaceState(null, "", `#${id}`);
    window.scrollTo({ top: 0 });
  };

  const cities = useMemo(() => uniqueSorted(visits.map((v) => v.city)), [visits]);
  const services = useMemo(() => uniqueSorted(visits.map((v) => v.service_family)), [visits]);
  const filtered = useMemo(() => applyFilters(visits, filters), [visits, filters]);
  const current = SECTIONS.find((s) => s.id === section)!;
  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLSelectElement>) => setFilters((f) => ({ ...f, [k]: e.target.value }));

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
          {SECTIONS.map((s) =>
            s.ready ? (
              <button key={s.id} className={s.id === section ? "nav-item active" : "nav-item"} onClick={() => go(s.id)} aria-current={s.id === section ? "page" : undefined}>
                {s.label}
              </button>
            ) : (
              <span key={s.id} className="nav-item disabled" aria-disabled="true">
                {s.label}
                <span className="soon">Próximamente</span>
              </span>
            )
          )}
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
            <h1>{current.label}</h1>
            <p className="muted small">
              {current.desc} · datos al {new Date(cutoff + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
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
            {section !== "retencion" && (
              <div className="seg" role="group" aria-label="Periodo">
                <button aria-pressed={filters.period === "12w"} onClick={() => setFilters((f) => ({ ...f, period: "12w" }))}>{WINDOW} semanas</button>
                <button aria-pressed={filters.period === "all"} onClick={() => setFilters((f) => ({ ...f, period: "all" }))}>Histórico</button>
              </div>
            )}
            <button className="btn-ghost" onClick={() => setGlossaryOpen(true)}>Glosario</button>
          </div>
        </header>

        {section === "resumen" && <Resumen visits={visits} filtered={filtered} marketing={marketing} cutoff={cutoff} filters={filters} setFilters={setFilters} />}
        {section === "retencion" && <Retencion visits={visits} cutoff={cutoff} filters={filters} />}
        {section === "monetizacion" && <Monetizacion filtered={filtered} marketing={marketing} cutoff={cutoff} filters={filters} />}
        {section === "zonas" && <Zonas visits={visits} cutoff={cutoff} filters={filters} />}
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

function uniqueSorted(xs: (string | null)[]) {
  return [...new Set(xs.filter((x): x is string => !!x && !x.startsWith("Sin ")))].sort((a, b) => a.localeCompare(b, "es"));
}
