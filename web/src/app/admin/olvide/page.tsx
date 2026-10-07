"use client";

import { useState } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { adminFetch, ApiError } from "@/lib/admin";
import { AuthAlert, AuthCard, authButton, authField, authLabel, authLink } from "@/components/admin/auth-layout";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    setPending(true);
    setError("");
    try {
      await adminFetch("/auth/password/forgot", { method: "POST", body: JSON.stringify({ email }) });
      setSent(email);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo enviar el enlace");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthCard
      title="Recupera tu contraseña"
      subtitle="Te enviaremos un enlace para crear una nueva. Vence en una hora."
    >
      {sent ? (
        <AuthAlert tone="success">
          Si {sent} tiene una cuenta activa, te llegará un correo con el enlace en unos minutos. Revisa también la carpeta de spam.
        </AuthAlert>
      ) : (
        <form onSubmit={onSubmit} aria-busy={pending}>
          {error && <AuthAlert>{error}</AuthAlert>}
          <div className="mt-7">
            <label htmlFor="email" className={authLabel}>Correo electrónico</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoFocus
              autoComplete="username"
              inputMode="email"
              spellCheck={false}
              placeholder="tu@empresa.com"
              className={authField}
            />
          </div>
          <button type="submit" disabled={pending} className={authButton}>
            {pending && <LoaderCircle className="size-[18px] animate-spin motion-reduce:animate-none" aria-hidden />}
            Enviar enlace
          </button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-slate-600">
        <Link href="/admin/login" className={authLink}>Volver a iniciar sesión</Link>
      </p>
    </AuthCard>
  );
}
