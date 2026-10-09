"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { adminFetch, ApiError } from "@/lib/admin";
import { AuthAlert, AuthCard, authButton, authField, authLabel, authLink } from "@/components/admin/auth-layout";

type TokenInfo = { purpose: "invite" | "reset"; email: string; name: string };

const MIN = 8;

// Landing page of invitation and password-reset emails: /admin/contrasena?token=...
function SetPassword() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [info, setInfo] = useState<TokenInfo | null>(null);
  const [tokenError, setTokenError] = useState("");
  const invalid = token ? tokenError : "Falta el enlace. Ábrelo desde el correo que recibiste.";
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!token) return;
    adminFetch<TokenInfo>(`/auth/password/token?token=${encodeURIComponent(token)}`).then(setInfo, (e) =>
      setTokenError(e instanceof ApiError ? e.message : "No se pudo validar el enlace"),
    );
  }, [token]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password.length < MIN) return setError(`La contraseña debe tener al menos ${MIN} caracteres.`);
    if (password !== form.get("confirm")) return setError("Las contraseñas no coinciden.");
    setPending(true);
    setError("");
    try {
      await adminFetch("/auth/password/reset", { method: "POST", body: JSON.stringify({ token, password }) });
      router.replace("/admin");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar la contraseña");
      setPending(false);
    }
  }

  if (invalid) {
    return (
      <AuthCard title="Enlace no válido">
        <AuthAlert>{invalid}</AuthAlert>
        <p className="mt-6 text-center text-sm text-zinc-600">
          <Link href="/admin/olvide" className={authLink}>Pedir un enlace nuevo</Link>
        </p>
      </AuthCard>
    );
  }
  if (!info) {
    return <AuthCard title="Validando enlace…">{null}</AuthCard>;
  }

  const invite = info.purpose === "invite";
  return (
    <AuthCard
      title={invite ? `Te damos la bienvenida${info.name ? `, ${info.name}` : ""}` : "Crea una nueva contraseña"}
      subtitle={
        invite ? (
          <>Crea tu contraseña para entrar al panel con <strong>{info.email}</strong>.</>
        ) : (
          <>Para la cuenta <strong>{info.email}</strong>. Se cerrarán tus otras sesiones.</>
        )
      }
    >
      <form onSubmit={onSubmit} aria-busy={pending}>
        {error && <AuthAlert>{error}</AuthAlert>}
        <input type="email" name="username" value={info.email} autoComplete="username" readOnly hidden />
        <div className="mt-7 space-y-5">
          <div>
            <label htmlFor="password" className={authLabel}>Contraseña nueva</label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={show ? "text" : "password"}
                required
                minLength={MIN}
                autoFocus
                autoComplete="new-password"
                aria-describedby="password-hint"
                className={`${authField} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={show}
                className="absolute right-1.5 top-1 grid size-10 cursor-pointer place-items-center rounded-lg text-zinc-600 hover:bg-zinc-100"
              >
                {show ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
              </button>
            </div>
            <p id="password-hint" className="mt-1.5 text-xs text-zinc-600">Mínimo {MIN} caracteres.</p>
          </div>
          <div>
            <label htmlFor="confirm" className={authLabel}>Repite la contraseña</label>
            <input id="confirm" name="confirm" type={show ? "text" : "password"} required autoComplete="new-password" className={authField} />
          </div>
        </div>
        <button type="submit" disabled={pending} className={authButton}>
          {pending && <LoaderCircle className="size-[18px] animate-spin motion-reduce:animate-none" aria-hidden />}
          {invite ? "Crear contraseña y entrar" : "Guardar y entrar"}
        </button>
      </form>
    </AuthCard>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense>
      <SetPassword />
    </Suspense>
  );
}
