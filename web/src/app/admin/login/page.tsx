"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CircleAlert,
  Eye,
  EyeOff,
  Inbox,
  LayoutTemplate,
  LoaderCircle,
  Lock,
  Mail,
  MessageSquareWarning,
  ShieldCheck,
} from "lucide-react";
import { adminFetch, ApiError } from "@/lib/admin";

const HIGHLIGHTS = [
  { icon: Inbox, title: "Bandeja de envíos", text: "Revisa cada solicitud con sus datos y documentos en un solo lugar." },
  { icon: MessageSquareWarning, title: "Observaciones claras", text: "Pide correcciones campo por campo y el solicitante recibe un enlace nuevo." },
  { icon: LayoutTemplate, title: "Formularios propios", text: "Crea y versiona tus formularios sin tocar código." },
];

function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`grid size-9 place-items-center rounded-lg text-sm font-bold ${inverted ? "bg-white text-zinc-950" : "bg-zinc-950 text-white"}`}
        aria-hidden
      >
        FF
      </span>
      <span className={`text-lg font-semibold tracking-tight ${inverted ? "text-white" : "text-zinc-950"}`}>FormFlow</span>
    </div>
  );
}

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-zinc-950 px-12 py-10 text-white lg:flex lg:flex-col">
      {/* Subtle grid + glow, purely decorative */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:40px_40px]"
      />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-32 size-[480px] rounded-full bg-indigo-500/25 blur-3xl" />

      <div className="relative">
        <Logo inverted />
      </div>

      <div className="relative my-auto max-w-md py-12">
        <h2 className="text-3xl font-semibold leading-tight tracking-tight text-balance">
          Aprueba nuevos clientes sin perseguir correos ni archivos sueltos.
        </h2>
        <ul className="mt-10 space-y-6">
          {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15">
                <Icon className="size-5 text-indigo-200" aria-hidden />
              </span>
              <div>
                <p className="font-medium">{title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-zinc-400">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative flex items-center gap-2 text-xs text-zinc-500">
        <ShieldCheck className="size-4" aria-hidden />
        Acceso exclusivo para el equipo de tu organización.
      </p>
    </aside>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

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

  function trackCapsLock(e: React.KeyboardEvent<HTMLInputElement>) {
    setCapsLock(e.getModifierState("CapsLock"));
  }

  const fieldBox =
    "flex h-11 items-center gap-2.5 rounded-lg border bg-white px-3 transition-colors focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/15";
  const fieldBorder = error ? "border-rose-300" : "border-zinc-300 hover:border-zinc-400";

  return (
    <form onSubmit={onSubmit} aria-busy={pending} className="w-full max-w-sm">
      <div className="mb-10 lg:hidden">
        <Logo />
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Inicia sesión</h1>
      <p className="mt-1.5 text-sm text-zinc-500">Ingresa al panel de revisión con tu cuenta de equipo.</p>

      {error && (
        <div
          role="alert"
          className="mt-6 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-8 space-y-5">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-zinc-800">
            Correo electrónico
          </label>
          <div className={`${fieldBox} ${fieldBorder}`}>
            <Mail className="size-4 shrink-0 text-zinc-400" aria-hidden />
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="username"
              autoFocus
              inputMode="email"
              spellCheck={false}
              placeholder="tu@empresa.com"
              aria-invalid={!!error}
              className="h-full w-full bg-transparent text-[15px] text-zinc-950 outline-none placeholder:text-zinc-400"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-zinc-800">
            Contraseña
          </label>
          <div className={`${fieldBox} ${fieldBorder} pr-1`}>
            <Lock className="size-4 shrink-0 text-zinc-400" aria-hidden />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              aria-invalid={!!error}
              aria-describedby={capsLock ? "caps-hint" : undefined}
              onKeyDown={trackCapsLock}
              onKeyUp={trackCapsLock}
              onBlur={() => setCapsLock(false)}
              className="h-full w-full bg-transparent text-[15px] text-zinc-950 outline-none placeholder:text-zinc-400"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-pressed={showPassword}
              className="grid size-9 shrink-0 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 focus-visible:outline-2 focus-visible:outline-indigo-500"
            >
              {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            </button>
          </div>
          {capsLock && (
            <p id="caps-hint" className="mt-1.5 text-xs text-amber-700">
              Bloq Mayús está activado.
            </p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="group mt-8 inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 text-[15px] font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? (
          <>
            <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
            Ingresando…
          </>
        ) : (
          <>
            Ingresar
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
          </>
        )}
      </button>

      <p className="mt-6 text-center text-xs leading-relaxed text-zinc-500">
        ¿Olvidaste tu contraseña? Pide a un propietario de tu organización que la restablezca.
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-white font-sans text-zinc-950 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <BrandPanel />
      <section className="flex items-center justify-center px-6 py-12 sm:px-10">
        <Suspense>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
