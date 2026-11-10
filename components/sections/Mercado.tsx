"use client";

import { useMemo } from "react";
import { avg, fmtInt, fmtPct, fmtUsd, lastWeeks, marketingAvg, weekStartOf, weeklyClients, type Visit, type WeekMarketing } from "@/lib/metrics";
import { MARKET, MARKET_UPDATED, SOURCES, dfwMarketEstimate, type SourceKey } from "@/lib/market";
import { SectionNote, Stat } from "@/components/ui";

type Props = { visits: Visit[]; marketing: WeekMarketing[]; cutoff: string };

const Src = ({ k }: { k: SourceKey }) => (
  <a className="src" href={SOURCES[k].url} target="_blank" rel="noopener noreferrer">{SOURCES[k].label}</a>
);

export default function Mercado({ visits, marketing, cutoff }: Props) {
  const est = dfwMarketEstimate();
  const k = useMemo(() => {
    const end = new Date(weekStartOf(cutoff) + "T00:00:00Z");
    const start = new Date(end); start.setUTCFullYear(start.getUTCFullYear() - 1);
    const year = visits.filter((v) => v.status === "realizado" && v.week_start >= start.toISOString().slice(0, 10) && v.week_start < end.toISOString().slice(0, 10));
    const revenue = year.reduce((a, v) => a + (v.price ?? 0), 0);
    const clients = new Set(year.map((v) => v.client_id)).size;
    const weeks = lastWeeks(weeklyClients(visits, cutoff), cutoff);
    const recent = visits.filter((v) => v.status === "realizado" && weeks.some((w) => w.week === v.week_start) && (v.price ?? 0) > 0);
    const ticket = avg(recent.map((v) => v.price!));
    const nuevos = avg(weeks.map((w) => w.nuevos));
    const spend = marketingAvg(marketing, weeks.map((w) => w.week));
    return { revenue, clients, ticket, cac: nuevos ? spend / nuevos : 0 };
  }, [visits, marketing, cutoff]);

  const share = est.total ? k.revenue / est.total : 0;
  const scaleMax = 760;
  const pos = (v: number) => `${Math.min(100, (v / scaleMax) * 100)}%`;
  // Costo por cliente implícito en Google: CPL ÷ tasa de cierre
  const googleCac = (close: number) => MARKET.googleCpl / close;
  const updated = new Date(MARKET_UPDATED + "T12:00:00Z").toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <>
      <section className="card hero">
        <div className="hero-main">
          <span className="eyebrow">Mercado de limpieza residencial en Dallas-Fort Worth (estimado)</span>
          <div className="hero-figure">
            <strong>{fmtUsd(est.total / 1e6)}M</strong>
            <span>al año</span>
          </div>
          <p className="muted small">
            {fmtInt(MARKET.dfwHouseholds)} hogares × {fmtPct(MARKET.usShareUsing)} que contrata limpieza × {fmtUsd(est.spendPerHousehold)} de gasto anual promedio por hogar.
            Estimación propia con datos nacionales aplicados a DFW.
          </p>
        </div>
        <div className="hero-side">
          <Stat label="Ingreso de Kiki's (12 meses)" value={fmtUsd(k.revenue)} sub="servicios, sin propinas" />
          <Stat label="Participación estimada" value={fmtPct(share, 2)} sub="del mercado de DFW" accent />
          <Stat label="Clientes atendidos (12 meses)" value={fmtInt(k.clients)} sub={`de ~${fmtInt(est.households / 1000)} mil hogares que contratan`} />
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <h2>Un mercado que sigue creciendo</h2>
          <ul className="method">
            <li>En EE. UU. el servicio de limpieza residencial facturó <b>USD 17,200 millones</b> en 2025 y se proyecta que crezca <b>{fmtPct(MARKET.usGrowth2026, 1)}</b> en 2026. <Src k="issa" /></li>
            <li>El <b>{fmtPct(MARKET.usShareUsing)}</b> de los hogares contrata limpieza, el doble que en 2012 ({fmtPct(MARKET.usShare2012)}). Hay unas {fmtInt(MARKET.usCompanies)} empresas en el país. <Src k="issa" /></li>
            <li>DFW tiene <b>{fmtInt(MARKET.dfwHouseholds)} hogares</b> con un ingreso mediano de <b>{fmtUsd(MARKET.dfwMedianIncome)}</b>. <Src k="acs" /></li>
            <li>La región sumó <b>{fmtInt(MARKET.regionAdded2025)} habitantes</b> en 2025. Collin County, donde están McKinney, Frisco, Plano, Allen, Celina, Anna y Prosper, creció más que ningún otro condado (+{fmtInt(MARKET.collinAdded2025)}); Celina sola sumó {fmtInt(MARKET.celinaAdded2025)}. <Src k="nctcog" /></li>
          </ul>
          <SectionNote>Kiki&apos;s ya opera en las ciudades que más crecen de la región. Con una participación de {fmtPct(share, 2)}, el crecimiento no depende de quitarle clientes a nadie: depende de captar y retener mejor.</SectionNote>
        </div>
        <div className="card">
          <h2>Contra quién compite</h2>
          <ul className="method">
            <li>En sus zonas principales operan franquicias nacionales: <b>Molly Maid</b> (McKinney, Frisco, Allen) <Src k="mollymaid" />, <b>MaidPro</b> (Frisco) <Src k="maidpro" /> y <b>The Cleaning Authority</b> (Plano, Frisco) <Src k="tca" />, además de cientos de independientes.</li>
            <li>El cliente elige por <b>calidad ({fmtPct(MARKET.chooseQuality)})</b>, precio ({fmtPct(MARKET.choosePrice)}) y reseñas ({fmtPct(MARKET.chooseReviews)}). <Src k="jobber" /></li>
            <li>El <b>{fmtPct(MARKET.pricesRaised)}</b> de las empresas de limpieza subió precios en los últimos 12 meses, sobre todo por inflación y costo de mano de obra. <Src k="jobber" /></li>
          </ul>
          <SectionNote>La diferenciación que el cliente valora (calidad y reseñas) es justo lo que construyen el check-in de 24 horas y la solicitud de reseñas del sistema.</SectionNote>
        </div>
      </section>

      <section className="card">
        <h2>¿Dónde está el precio de Kiki&apos;s frente al mercado?</h2>
        <p className="muted small">Rangos de precio por servicio en Dallas-Fort Worth (2026) y el ticket promedio de Kiki&apos;s en las últimas 12 semanas</p>
        <div className="range-chart">
          {MARKET.prices.map((p) => (
            <div className="range-row" key={p.label}>
              <span className="range-label">{p.label} <span className="range-text-m">{fmtUsd(p.min)} – {fmtUsd(p.max)}</span><Src k={p.src} /></span>
              <div className="range-track">
                <span className="range-bar" style={{ left: pos(p.min), width: `calc(${pos(p.max)} - ${pos(p.min)})` }} />
                <em className="range-text" style={{ left: `calc(${pos(p.max)} + 10px)` }}>{fmtUsd(p.min)} – {fmtUsd(p.max)}</em>
                <span className="range-marker" style={{ left: pos(k.ticket) }} title={`Ticket Kiki's ${fmtUsd(k.ticket)}`} />
              </div>
            </div>
          ))}
          <div className="range-legend"><span className="range-marker static" /> Ticket promedio de Kiki&apos;s: <b>{fmtUsd(k.ticket)}</b></div>
        </div>
        <div className="kpi-grid four" style={{ marginTop: 18 }}>
          <Stat label="Tarifa por hora en Dallas" value={`USD ${MARKET.hourlyMin}–${MARKET.hourlyMax}`} sub="por limpiadora" />
          <Stat label="Tarifa por hora de Kiki's" value="USD 55" sub="lista vigente: 3 h por USD 165" />
          <Stat label="Pago promedio en limpieza (DFW)" value={`USD ${MARKET.cleaningWageDfw}/h`} sub="ocupaciones de limpieza, BLS" />
          <Stat label="Costo por hora de Kiki's" value="≈ USD 17/h" sub="ver Operación y capacidad" />
        </div>
        <SectionNote>
          Fuentes: <Src k="belong" /> · <Src k="thumbtack" /> · <Src k="dallasMaids" /> · <Src k="bls" />.
          El ticket de Kiki&apos;s está en la parte media del mercado y su tarifa por hora en la parte baja del rango. Como lo cobrado está 15–35% por debajo de su propia lista, hay espacio para acercarse a la lista sin salir del rango del mercado, sobre todo en casas grandes.
        </SectionNote>
      </section>

      <section className="grid-2">
        <div className="card">
          <h2>Costo de conseguir clientes</h2>
          <ul className="method">
            <li>En Google Ads, la categoría de limpieza tiene un costo por lead de <b>{fmtUsd(MARKET.googleCpl)}</b> y una conversión de {fmtPct(MARKET.googleConv, 1)}, de las mejores de los servicios para el hogar (promedio: {fmtUsd(MARKET.homeServicesCpl)}). <Src k="webtonic" /></li>
            <li>El costo por lead subió para el {fmtPct(MARKET.cplIncreaseShare)} de los negocios, {fmtPct(MARKET.cplIncrease, 1)} en promedio en un año. <Src k="webtonic" /></li>
            <li>Thumbtack cobra por lead aunque no se cierre el trabajo; el precio varía por servicio y zona. <Src k="pipelineon" /></li>
          </ul>
          <div className="kpi-grid" style={{ marginTop: 14 }}>
            <Stat label="Cliente desde Google, cierre 20%" value={fmtUsd(googleCac(0.2))} sub="USD 47 por lead ÷ 20%" />
            <Stat label="Cliente desde Google, cierre 35%" value={fmtUsd(googleCac(0.35))} sub="la meta de cierre de la propuesta" accent />
          </div>
          <SectionNote>
            El CAC actual de Kiki&apos;s es {fmtUsd(k.cac)} (toda la pauta ÷ todos los nuevos). Llegar a USD 80 solo con anuncios pagados no es realista: requiere subir la tasa de cierre y que una parte de los nuevos llegue sin costo de pauta (referidos y reactivación).
          </SectionNote>
        </div>
        <div className="card">
          <h2>Oportunidades</h2>
          <ul className="method">
            <li><b>Referidos y recompra:</b> en el sector, el {fmtPct(MARKET.leadsFromRepeat)} de los leads viene de clientes que repiten y el {fmtPct(MARKET.leadsFromReferrals)} de referidos. Son los canales que bajan el CAC combinado. <Src k="jobber" /></li>
            <li><b>Organizing:</b> el promedio nacional de un organizador es USD {MARKET.organizerHourlyUS}/h; un clóset cuesta USD {fmtInt(MARKET.organizerCloset[0])}–{fmtInt(MARKET.organizerCloset[1])} y una casa completa USD {fmtInt(MARKET.organizerWholeHome[0])}–{fmtInt(MARKET.organizerWholeHome[1])}. Kiki&apos;s ya lo vende a ~USD 55/h; empaquetarlo por proyecto (clóset, cochera, alacena) lo vuelve más fácil de comprar. <Src k="taskrabbit" /></li>
            <li><b>Zonas en crecimiento:</b> Collin County concentra el crecimiento de la región y ahí está el núcleo de clientes de Kiki&apos;s. <Src k="nctcog" /></li>
            <li><b>Precio:</b> más de la mitad del sector subió precios en el último año; Kiki&apos;s puede acercar lo cobrado a su lista con argumentos de calidad. <Src k="jobber" /></li>
          </ul>
        </div>
      </section>

      <section className="card">
        <h2>Fuentes</h2>
        <p className="muted small">Investigación al {updated}. Las cifras nacionales se usan como referencia cuando no hay dato específico de DFW.</p>
        <ul className="sources">
          {(Object.keys(SOURCES) as SourceKey[]).map((key) => (
            <li key={key}><a href={SOURCES[key].url} target="_blank" rel="noopener noreferrer">{SOURCES[key].label}</a></li>
          ))}
        </ul>
      </section>
    </>
  );
}
