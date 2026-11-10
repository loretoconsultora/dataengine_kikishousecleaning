"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, undefined);
  return (
    <main className="login">
      <form action={action} className="card login-card">
        <span className="brand-mark" aria-hidden="true">DE</span>
        <h1>Data Engine</h1>
        <p className="muted">Kiki&apos;s House Cleaning</p>
        <label>
          Correo
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Contraseña
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {state?.error && <p className="form-error" role="alert">{state.error}</p>}
        <button className="btn-primary" disabled={pending}>{pending ? "Entrando…" : "Entrar"}</button>
      </form>
    </main>
  );
}
