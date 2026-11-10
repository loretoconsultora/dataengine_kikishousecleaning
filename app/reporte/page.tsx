import { loadData } from "@/lib/data";
import { computeFindings } from "@/lib/findings";
import Report from "@/components/Report";

export const dynamic = "force-dynamic";

// El nombre del PDF al guardar se toma del título: lleva la fecha de descarga (hora de México).
export async function generateMetadata() {
  const date = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
  return { title: `Reporte Data Engine Kikis ${date}` };
}

export default async function ReportePage() {
  const d = await loadData();
  if ("error" in d) return <main className="login"><p className="muted">No se pudieron leer los datos: {d.error}</p></main>;
  const f = computeFindings(d.visits, d.marketing, d.ops, d.cutoff);
  return <Report f={f} />;
}
