import { createClient } from "@/lib/supabase/server";
import Dashboard from "@/components/Dashboard";
import type { Visit, WeekMarketing } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const VISIT_COLS =
  "visit_id,visit_date,week_start,status,client_id,is_first_visit,client_first_date,client_source,city,region,service_family,frequency,size_bucket,bedrooms,bathrooms,price,tip,total,labor_cost,addon_laundry,addon_baseboards,addon_windows,addon_oven,addon_fridge,addon_cabinets";

export default async function Home() {
  const supabase = await createClient();

  // Supabase devuelve como máximo 1,000 filas por consulta: se pagina.
  const visits: Visit[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("visits")
      .select(VISIT_COLS)
      .order("visit_id")
      .range(from, from + 999);
    if (error) return <EmptyState message={`No se pudieron leer los datos: ${error.message}`} />;
    visits.push(...((data ?? []) as Visit[]));
    if (!data || data.length < 1000) break;
  }

  const { data: marketing } = await supabase.from("weekly_marketing").select("*");
  const { data: meta } = await supabase.from("meta").select("key,value");
  const cutoff = meta?.find((m) => m.key === "data_cutoff")?.value ?? new Date().toISOString().slice(0, 10);
  const { data: { user } } = await supabase.auth.getUser();

  if (!visits.length) {
    return <EmptyState message="La base de datos todavía no tiene información. Carga los datos en Supabase para ver el tablero." />;
  }

  return (
    <Dashboard
      visits={visits}
      marketing={(marketing ?? []) as WeekMarketing[]}
      cutoff={cutoff}
      userEmail={user?.email ?? ""}
    />
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <main className="login">
      <div className="card login-card">
        <span className="brand-mark" aria-hidden="true">DE</span>
        <h1>Data Engine</h1>
        <p className="muted">{message}</p>
        <form action="/auth/signout" method="post">
          <button className="btn-ghost">Cerrar sesión</button>
        </form>
      </div>
    </main>
  );
}
