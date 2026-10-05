"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { adminFetch, ApiError } from "@/lib/admin";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError("");
    try {
      await adminFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      const next = params.get("next");
      router.replace(next?.startsWith("/admin") ? next : "/admin");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
      <div>
        <h1 className="text-xl font-semibold">FormFlow</h1>
        <p className="text-sm text-zinc-500">Ingresa al panel de revisión</p>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input name="email" type="email" required autoComplete="username" autoFocus className="input" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Contraseña
        <input name="password" type="password" required autoComplete="current-password" className="input" />
      </label>
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
