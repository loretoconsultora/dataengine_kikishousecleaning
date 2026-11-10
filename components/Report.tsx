"use client";

import { useEffect, useState } from "react";
import { fmt1, fmtInt, fmtPct, fmtUsd } from "@/lib/metrics";
import type { Findings } from "@/lib/findings";

const longDate = (d: Date) => d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Mexico_City" });
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
            <li>Lo cobrado está entre <b>{pct(Math.abs(m.gapMax))} y {pct(Math.abs(m.gapMin))}</b> por debajo de la lista vigente, y la brecha es mayor en las casas grandes.</li>
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
          <li>Hay <b>{fmtInt(se.oddWeeks)}</b> semanas atípicas (±25% contra las 4 previas) por validar con Oscar (clima, festivos u otros eventos).</li>
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
        <h2>Pendientes de validación</h2>
        <ul>
          <li>El <b>{pct(f.quality.noSource)}</b> de los clientes no tiene una fuente identificable. Sin ese dato no se puede calcular el CAC por fuente (Google, Thumbtack, networking, Melissa.com).</li>
          <li>Familias de servicio, frecuencia "única" (DND) y columna de pago son clasificaciones provisionales, en espera de las respuestas del documento de consultas.</li>
          <li>El margen por tamaño de casa usa el pago por servicio registrado de febrero 2025 a marzo 2026; después, el Excel registra la nómina semanal.</li>
        </ul>
      </section>

      <footer className="report-foot">Data Engine · Kiki&apos;s House Cleaning · Victoranza Agency × Loreto Consultora · Confidencial</footer>
    </div>
  );
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
