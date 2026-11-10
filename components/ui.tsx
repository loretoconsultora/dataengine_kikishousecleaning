"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { fmt1, fmtInt, fmtPct } from "@/lib/metrics";

export const PALETTE = ["#2E68F5", "#151C25", "#8FB0FA", "#F2A541", "#3FB68B", "#E5677A", "#8B6FE8", "#B9C4D3", "#5BC0DE"];
export const C_NEW = "#2E68F5";
export const C_REC = "#151C25";
export const AXIS = { fontSize: 12, fill: "#7B8592" };
export const tooltipStyle = { borderRadius: 12, border: "1px solid #E3E9F1", boxShadow: "0 8px 24px -12px rgba(21,28,37,.2)", fontSize: 13 };

export function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={accent ? "stat accent" : "stat"}>
      <span>{label}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}

export function MixPie({ data, total, unit = "por semana" }: { data: { name: string; value: number; color: string }[]; total: number; unit?: string }) {
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
        <div className="pie-center"><strong>{Number.isInteger(total) ? fmtInt(total) : fmt1(total)}</strong><span>{unit}</span></div>
      </div>
      <ul className="legend">
        {data.map((d) => (
          <li key={d.name}>
            <span className="dot" style={{ background: d.color }} />
            <span>{d.name}</span>
            <b>{fmtPct(sum ? d.value / sum : 0)}</b>
            <span className="muted">{Number.isInteger(d.value) ? fmtInt(d.value) : fmt1(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CategoryPie({ title, data, unit = "servicios" }: { title: string; data: { name: string; value: number; pct: number }[]; unit?: string }) {
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
              <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [fmtInt(Number(v ?? 0)) + " " + unit, String(n)]} />
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
        <p className="muted small">Sin datos con estos filtros.</p>
      )}
    </div>
  );
}

export function SectionNote({ children }: { children: React.ReactNode }) {
  return <p className="muted small note">{children}</p>;
}
