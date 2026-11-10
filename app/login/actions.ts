"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const MESSAGES: Record<string, string> = {
  "Invalid login credentials": "Correo o contraseña incorrectos.",
  "Email not confirmed": "El correo de este usuario no está confirmado. En Supabase → Authentication → Users, confirma el usuario.",
  "Email logins are disabled": "El acceso con correo está desactivado en Supabase (Authentication → Sign In / Providers → Email).",
};

export async function signIn(_: { error?: string } | undefined, formData: FormData) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return { error: "Faltan las variables de Supabase en Vercel (NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)." };
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: String(formData.get("email") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
    });
    if (error) {
      return { error: MESSAGES[error.message] ?? `Supabase respondió: ${error.message}` };
    }
  } catch (e) {
    return { error: `No se pudo conectar con Supabase: ${e instanceof Error ? e.message : String(e)}. Revisa que NEXT_PUBLIC_SUPABASE_URL sea el Project URL (https://xxxx.supabase.co).` };
  }
  redirect("/");
}
