"use client";

import { useEffect, useState } from "react";
import { fmt1, fmtInt, fmtPct, fmtUsd } from "@/lib/metrics";
import type { Findings } from "@/lib/findings";

const longDate = (d: Date) => d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Mexico_City" });
const signed = (v: number) => `${v > 0 ? "+" : ""}${fmtPct(v)}`;
const pct = (v: number | null | undefined, d = 0) => (v === null || v === undefined ? "–" : fmtPct(v, d));

export default function Report({ f }: { f: Findings }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  const s = f.start, r = f.retention, m = f.money, z = f.zones, se = f.season, o = f.ops;
  const cutoffLong = new Date(f.cutoff + "T12:00:00Z").toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="report">
      <div className="report-actions no-print">
        <a href="/" className="btn-ghost">Volver al tablero</a>
        <button className="btn-primary" onClick={() => window.print()}>Descargar PDF</button>
        <span className="muted small">En la ventana de impresión elige "Guardar como PDF". El archivo lleva la fecha de hoy.</span>
      </div>

      <header className="report-head">
        <span className="brand-mark" aria-hidden="true">DE</span>
        <div>
          <p className="eyebrow">Data Engine · Kiki&apos;s House Cleaning</p>
          <h1>Reporte de hallazgos</h1>
          <p className="muted">
            Generado el {now ? longDate(now) : "…"} · datos al {cutoffLong} · promedios de las últimas 12 semanas completas
          </p>
          <p className="muted small">Preparado por Victoranza Agency y Loreto Consultora</p>
        </div>
      </header>

      <section className="report-sec">
        <h2>Punto de partida y meta</h2>
        <div className="report-kpis">
          <Kpi label="Clientes por semana" value={fmt1(s.clients)} sub={`${pct(s.clients / f.goal)} de la meta de ${f.goal}`} />
          <Kpi label="Recurrentes / nuevos" value={`${fmt1(s.recurrentes)} / ${fmt1(s.nuevos)}`} sub={`${pct(1 - s.shareNew)} / ${pct(s.shareNew)}`} />
          <Kpi label="CAC actual → objetivo" value={`${fmtUsd(s.cac)} → ${fmtUsd(s.cacTarget)}`} sub={`con la misma pauta de ${fmtUsd(s.spend)}/sem`} />
        </div>
        <ul>
          <li>Para llegar a {f.goal} clientes por semana con la mezcla actual se necesitan <b>{fmt1(s.goalRec)} recurrentes (+{pct(s.goalRec / s.recurrentes - 1)})</b> y <b>{fmt1(s.goalNew)} nuevos (+{pct(s.goalNew / s.nuevos - 1)})</b>.</li>
          <li>Sin aumentar la pauta, el CAC tiene que bajar <b>{pct(1 - s.cacTarget / s.cac)}</b>: de {fmtUsd(s.cac)} a {fmtUsd(s.cacTarget)} por cliente nuevo. El ROAS del primer servicio hoy es {fmt1(s.roas)}x.</li>
        </ul>
      </section>

      <section className="report-sec">
        <h2>Adquisición</h2>
        <ul>
          {f.acq.perHundred !== null && <li>Cada USD 100 extra de pauta trae unos <b>{fmt1(f.acq.perHundred)} clientes nuevos</b> por semana: un cliente extra cuesta cerca de <b>{fmtUsd(f.acq.marginalCac ?? 0)}</b>, más que el CAC promedio. La pauta explica el {pct(f.acq.r2)} de la variación semanal; el resto depende de temporada, referidos y cierre.</li>}
          {f.acq.stdConv !== null && f.acq.moConv !== null && <li>Un cliente que entra con Standard regresa en 90 días en el <b>{pct(f.acq.stdConv)}</b> de los casos; uno de Move Out, en el <b>{pct(f.acq.moConv)}</b>. En promedio regresa el {pct(f.acq.conv)}.</li>}
          <li>Hay <b>{fmtInt(f.acq.pool)} clientes</b> de los últimos 90 días con una sola visita y sin servicio agendado ({fmtInt(f.acq.poolMoveOut)} son Move Out): es la bolsa de segunda visita.</li>
          <li>La columna &quot;Cold Call&quot; no registra la fuente del cliente, así que el CAC por canal se activa cuando se registre la fuente en GHL y el gasto por canal.</li>
        </ul>
        <p className="report-take"><b>Para la meta:</b> más pauta sola encarece cada cliente. El margen está en cerrar mejor los leads y en convertir la primera visita en la segunda.</p>
      </section>

      <section className="report-sec">
        <h2>Retención: el hallazgo más fuerte</h2>
        <ul>
          <li>Solo el <b>{pct(r.repeatRate)}</b> de los clientes regresa alguna vez. El {pct(r.oneTimePct)} ({fmtInt(r.oneTime)} clientes) contrató una sola vez.</li>
          <li>Al mes 1 sigue el <b>{pct(r.m1)}</b> de cada cohorte, y al mes 6 el <b>{pct(r.m6)}</b>. La caída casi completa ocurre entre el primer servicio y el segundo.</li>
          <li><b>{fmtInt(r.lost)}</b> clientes están perdidos (más de 120 días sin servicio) y <b>{fmtInt(r.atRisk)}</b> están en riesgo.</li>
          <li>Un cliente que repite vale <b>{fmtUsd(r.ltvRepeat)}</b>, {fmt1(r.ltv ? r.ltvRepeat / r.ltv : 0)} veces el promedio ({fmtUsd(r.ltv)}). El 10% de clientes que más compra genera el <b>{pct(r.top10)}</b> del ingreso.</li>
        </ul>
        <p className="report-take"><b>Para la meta de {f.goal}:</b> la palanca más barata no es conseguir más clientes nuevos, sino convertir el primer servicio en el segundo. Eso es justo lo que atacan el check-in de 24 horas y el seguimiento post-servicio de la propuesta.</p>
      </section>

      <section className="report-sec">
        <h2>Monetización: el precio no es lineal</h2>
        <ul>
          {m.smallHour !== null && m.largeHour !== null && (
            <li>El margen por hora baja conforme crece la casa: <b>{fmtUsd(m.smallHour)}/h</b> en 1 recámara contra <b>{fmtUsd(m.largeHour)}/h</b> en 5 recámaras.</li>
          )}
          {m.gapMin !== null && m.gapMax !== null && (
            <li>En los últimos 120 días, lo cobrado en Standard va de <b>{signed(m.gapMin)} a {signed(m.gapMax)}</b> contra la lista vigente, según el tamaño de la casa. Kiki&apos;s sube precios de forma gradual, así que los clientes antiguos suelen pagar tarifas anteriores.</li>
          )}
          <li>El margen de contribución de las últimas 12 semanas es del <b>{pct(m.marginPct)}</b>. El ticket promedio es de {fmtUsd(m.ticket)} y la propina de {fmtUsd(m.tip)} ({pct(m.tipPct, 1)}).</li>
          <li>Los add-ons casi no aparecen: solo el <b>{pct(m.addonPct)}</b> de los servicios menciona alguno. Hay espacio para venderlos.</li>
        </ul>
        <p className="report-take"><b>Para la meta:</b> ajustar el precio de las casas grandes y ofrecer add-ons de forma natural en la reserva sube el ingreso por cliente sin necesitar más clientes.</p>
      </section>

      <section className="report-sec">
        <h2>Zonas</h2>
        <ul>
          <li>El servicio se concentra en {z.cities.slice(0, 3).map((c, i) => `${c.name} (${pct(c.pct)})`).join(", ")}. Las 5 primeras ciudades suman el <b>{pct(z.top5)}</b>, de {fmtInt(z.totalCities)} ciudades atendidas en las últimas 12 semanas.</li>
          <li>Por región: {z.regions.filter((x) => !x.name.startsWith("Sin")).map((x) => `${x.name} ${pct(x.pct)}`).join(", ")}.</li>
        </ul>
        <p className="report-take"><b>Para la meta:</b> crecer donde ya hay densidad (rutas cortas) es más rentable que abrir zonas lejanas donde la competencia cobra menos.</p>
      </section>

      <section className="report-sec">
        <h2>Estacionalidad</h2>
        <ul>
          {se.yoyAvg !== null && <li>Año contra año, los clientes por semana crecieron en promedio <b>{se.yoyAvg >= 0 ? "+" : ""}{pct(se.yoyAvg)}</b> (meses comparables: {se.yoyMonths}).</li>}
          {se.best && se.worst && <li>El mes más fuerte es <b>{se.best.label}</b> ({pct(se.best.index! - 1)} sobre el promedio) y el más débil <b>{se.worst.label}</b> ({pct(se.worst.index! - 1)}).</li>}
          {se.peak && <li>El día con más servicios es el <b>{se.peak.day.toLowerCase()}</b> ({pct(se.peak.pct)} de la semana).</li>}
          <li>Hay <b>{fmtInt(se.oddWeeks)}</b> semanas atípicas (±25% contra las 4 previas); las de Thanksgiving y fin de año son festivos.</li>
          {f.patterns.map((p) => <li key={p.claim}>{p.claim}: <b>{p.verdict.toLowerCase()}</b> ({p.lift! > 0 ? "+" : ""}{pct(p.lift)}).</li>)}
        </ul>
      </section>

      {o.hasData && (
        <section className="report-sec">
          <h2>Operación y capacidad</h2>
          <ul>
            <li>Hoy trabajan en promedio <b>{fmt1(o.cleaners)} limpiadoras</b> por semana, con unas {fmt1(o.hoursPerCleaner)} horas cada una ({fmt1(o.hoursPerClient)} horas por cliente).</li>
            <li>Para {f.goal} clientes por semana se necesitan unas <b>{fmtInt(o.plan.hoursNeeded)} horas</b> de trabajo: <b>{fmt1(o.plan.cleanersNeeded)} limpiadoras</b> al ritmo actual ({fmtInt(o.plan.extraCleaners)} más que hoy).</li>
            <li>La nómina semanal pasaría de {fmtUsd(o.payroll)} a unos {fmtUsd(o.plan.payrollNeeded)}, con el mismo costo por hora ({fmtUsd(o.costPerHour)}).</li>
          </ul>
          <p className="report-take"><b>Para la meta:</b> el reclutamiento tiene que avanzar al mismo ritmo que las ventas; si no, la capacidad se vuelve el cuello de botella.</p>
        </section>
      )}

      <section className="report-sec">
        <h2>Escenarios a diciembre 2027</h2>
        <ul>
          {f.scenarios.rows.map((r) => (
            <li key={r.label}><b>{r.label}</b> ({r.desc.charAt(0).toLowerCase() + r.desc.slice(1)}): {fmt1(r.dec ?? 0)} clientes por semana en diciembre 2027{r.reached ? `; llega a ${f.goal} en ${monthEs(r.reached)}` : `; no llega a ${f.goal} en el horizonte`}.</li>
          ))}
          <li>Hoy se va el {pct(f.scenarios.churn, 1)} de la base recurrente cada semana y por cada 10 clientes nuevos llegan unas {fmt1(f.scenarios.secondVisit * 10)} segundas visitas (incluye regresos después de 90 días): son las dos palancas que más mueven la proyección.</li>
        </ul>
        <p className="report-take"><b>Para la meta:</b> {f.scenarios.rows[2]?.reached ? `los ${f.goal} clientes por semana son alcanzables en 2027 con el sistema de adquisición y retención` : `ni siquiera el escenario del sistema llega a ${f.goal} en 2027 con estos supuestos`}{f.scenarios.rows[1]?.reached ? "." : "; con solo más pauta, no."}</p>
      </section>

      <section className="report-sec">
        <h2>Mercado</h2>
        <ul>
          <li>El mercado de limpieza residencial en Dallas-Fort Worth vale unos <b>{fmtUsd(f.market.total / 1e6)} millones al año</b> (estimación propia: 3.0 millones de hogares × 16% que contrata × gasto promedio nacional). Kiki&apos;s facturó {fmtUsd(f.market.yearRevenue)} en servicios en las últimas 52 semanas: una participación de <b>{pct(f.market.share, 2)}</b>.</li>
          <li>Collin County fue el condado que más creció de la región en 2025 (+64,703 habitantes); ahí está el núcleo de clientes de Kiki&apos;s.</li>
          <li>El ticket de Kiki&apos;s ({fmtUsd(m.ticket)}) está en la parte media del rango de DFW (USD 140–300 por limpieza estándar) y su tarifa de USD 55/h en la parte baja del rango de Dallas (USD 50–75).</li>
          <li>En Google Ads un lead de limpieza cuesta unos USD 47: con 35% de cierre, un cliente nuevo cuesta {fmtUsd(f.market.googleCac35)}; con 20%, {fmtUsd(f.market.googleCac20)}. El CAC de USD 80 solo es alcanzable sumando referidos y reactivación, que en el sector generan la mayoría de los leads.</li>
        </ul>
        <p className="report-take"><b>Para la meta:</b> con menos de 0.2% del mercado, el crecimiento no depende de ganar la guerra de precios sino de retener, pedir reseñas y activar referidos.</p>
      </section>

      <section className="report-sec">
        <h2>Pendientes de validación</h2>
        <ul>
          <li>El <b>{pct(f.quality.noSource)}</b> de los clientes no tiene una fuente identificable. Sin ese dato no se puede calcular el CAC por fuente (Google, Thumbtack, networking, Melissa.com).</li>
          <li>No existe registro de cancelaciones y reagendas. Empieza a registrarse a partir de esta semana para medir la tasa de cancelación.</li>
          <li>El margen por tamaño de casa usa el pago por servicio registrado de febrero 2025 a marzo 2026; después, el Excel registra la nómina semanal.</li>
        </ul>
      </section>

      <footer className="report-foot">Data Engine · Kiki&apos;s House Cleaning · Victoranza Agency × Loreto Consultora · Confidencial</footer>
    </div>
  );
}

const MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function monthEs(d: string) {
  return `${MONTHS_ES[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="report-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </div>
  );
}
