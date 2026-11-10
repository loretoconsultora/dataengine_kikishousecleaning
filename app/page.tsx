import Dashboard from "@/components/Dashboard";
import { loadData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const d = await loadData();
  if ("error" in d) return <EmptyState message={`No se pudieron leer los datos: ${d.error}`} />;
  if (!d.visits.length) {
    return <EmptyState message="La base de datos todavía no tiene información. Carga los datos en Supabase para ver el tablero." />;
  }
  return <Dashboard visits={d.visits} marketing={d.marketing} ops={d.ops} thumbtack={d.thumbtack} cutoff={d.cutoff} userEmail={d.userEmail} />;
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
