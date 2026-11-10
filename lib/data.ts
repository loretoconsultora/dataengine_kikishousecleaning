import { createClient } from "@/lib/supabase/server";
import type { Visit, WeekMarketing, WeekOps } from "@/lib/metrics";

const VISIT_COLS =
  "visit_id,visit_date,week_start,status,client_id,is_first_visit,client_first_date,client_source,city,region,service_family,frequency,size_bucket,bedrooms,bathrooms,price,tip,total,labor_cost,addon_laundry,addon_baseboards,addon_windows,addon_oven,addon_fridge,addon_cabinets";

export async function loadData() {
  const supabase = await createClient();
  const visits: Visit[] = [];
  // Supabase devuelve como máximo 1,000 filas por consulta: se pagina.
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("visits").select(VISIT_COLS).order("visit_id").range(from, from + 999);
    if (error) return { error: error.message } as const;
    visits.push(...((data ?? []) as Visit[]));
    if (!data || data.length < 1000) break;
  }
  const { data: marketing } = await supabase.from("weekly_marketing").select("*");
  const { data: ops } = await supabase.from("weekly_ops").select("*");
  const { data: meta } = await supabase.from("meta").select("key,value");
  const cutoff = meta?.find((m) => m.key === "data_cutoff")?.value ?? new Date().toISOString().slice(0, 10);
  const { data: { user } } = await supabase.auth.getUser();
  return {
    visits,
    marketing: (marketing ?? []) as WeekMarketing[],
    ops: (ops ?? []) as WeekOps[],
    cutoff,
    userEmail: user?.email ?? "",
  } as const;
}
