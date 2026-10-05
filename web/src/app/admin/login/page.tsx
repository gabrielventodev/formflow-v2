"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus_Jakarta_Sans } from "next/font/google";
import {
  ArrowRight,
  CircleAlert,
  Eye,
  EyeOff,
  FileCheck2,
  Inbox,
  LayoutTemplate,
  LoaderCircle,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { adminFetch, ApiError } from "@/lib/admin";

// Design system from UI UX Pro Max ("B2B SaaS onboarding compliance admin login"):
// glassmorphism on a light canvas, trust blue primary, Plus Jakarta Sans, subtle motion.
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

const HIGHLIGHTS = [
  { icon: Inbox, title: "Bandeja de envíos", text: "Cada solicitud con sus datos y documentos en un solo lugar." },
  { icon: FileCheck2, title: "Observaciones por campo", text: "Pide correcciones puntuales y el solicitante recibe un enlace nuevo." },
  { icon: LayoutTemplate, title: "Formularios propios", text: "Crea y versiona tus formularios sin tocar código." },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="grid size-10 place-items-center rounded-xl bg-blue-600 text-sm font-bold text-white shadow-lg shadow-blue-600/30"
      >
        FF
      </span>
      <span className="text-lg font-bold tracking-tight text-slate-900">FormFlow</span>
    </div>
  );
}

function Backdrop() {
  // Vibrant layered background the frosted card sits on. Decorative only.
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-40 -top-40 size-[520px] rounded-full bg-blue-400/40 blur-3xl" />
      <div className="absolute -right-32 top-1/3 size-[440px] rounded-full bg-sky-300/40 blur-3xl" />
      <div className="absolute -bottom-48 left-1/3 size-[480px] rounded-full bg-orange-300/30 blur-3xl" />
      <div className="absolute inset-0 opacity-[0.35] [background-image:radial-gradient(rgb(148_163_184/0.5)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
    </div>
  );
}

function Intro() {
  return (
    <section className="hidden max-w-md lg:block">
      <Logo />
      <h2 className="mt-12 text-4xl font-bold leading-[1.15] tracking-tight text-balance text-slate-900">
        Aprueba nuevos clientes sin perseguir correos ni archivos sueltos.
      </h2>
      <p className="mt-4 text-base leading-relaxed text-slate-600">
        El panel donde tu equipo revisa, observa y aprueba cada solicitud de preonboarding.
      </p>
      <ul className="mt-10 space-y-3">
        {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
          <li
            key={title}
            className="flex gap-4 rounded-2xl border border-white/60 bg-white/40 p-4 shadow-sm backdrop-blur-md"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-600/10 text-blue-700">
              <Icon className="size-5" aria-hidden />
            </span>
            <div>
              <p className="font-semibold text-slate-900">{title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);

  // Move focus to the error so keyboard and screen reader users land on it.
  useEffect(() => {
    if (error) alertRef.current?.focus();
  }, [error]);

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
    "flex h-12 items-center gap-2.5 rounded-xl border bg-white/80 px-3.5 transition-[border-color,box-shadow] duration-200 focus-within:border-blue-600 focus-within:ring-4 focus-within:ring-blue-600/15";
  const fieldBorder = error ? "border-red-400" : "border-slate-300 hover:border-slate-400";
  const inputCls = "h-full w-full bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-500";

  return (
    <form
      onSubmit={onSubmit}
      aria-busy={pending}
      className="w-full max-w-[420px] rounded-3xl border border-white/70 bg-white/65 p-7 shadow-xl shadow-slate-900/10 backdrop-blur-xl motion-safe:animate-[ff-rise_350ms_ease-out] sm:p-9"
    >
      <div className="mb-8 lg:hidden">
        <Logo />
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inicia sesión</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">Ingresa al panel de revisión con tu cuenta de equipo.</p>

      {error && (
        <div
          ref={alertRef}
          role="alert"
          tabIndex={-1}
          className="mt-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800 outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-7 space-y-5">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-slate-800">
            Correo electrónico
          </label>
          <div className={`${fieldBox} ${fieldBorder}`}>
            <Mail className="size-[18px] shrink-0 text-slate-500" aria-hidden />
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
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-slate-800">
            Contraseña
          </label>
          <div className={`${fieldBox} ${fieldBorder} pr-1.5`}>
            <Lock className="size-[18px] shrink-0 text-slate-500" aria-hidden />
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
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-pressed={showPassword}
              className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-lg text-slate-600 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              {showPassword ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
            </button>
          </div>
          {capsLock && (
            <p id="caps-hint" className="mt-1.5 text-xs font-medium text-amber-800">
              Bloq Mayús está activado.
            </p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="group mt-8 inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-base font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors duration-200 hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-75"
      >
        {pending ? (
          <>
            <LoaderCircle className="size-[18px] animate-spin motion-reduce:animate-none" aria-hidden />
            Ingresando…
          </>
        ) : (
          <>
            Ingresar
            <ArrowRight
              className="size-[18px] transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
              aria-hidden
            />
          </>
        )}
      </button>

      <p className="mt-6 text-center text-sm leading-relaxed text-slate-600">
        ¿Olvidaste tu contraseña? Pide a un propietario de tu organización que la restablezca.
      </p>

      <p className="mt-6 flex items-center justify-center gap-1.5 border-t border-slate-200/80 pt-5 text-xs text-slate-600">
        <ShieldCheck className="size-4 text-blue-700" aria-hidden />
        Acceso exclusivo para el equipo de tu organización.
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className={`${jakarta.className} relative isolate flex min-h-screen items-center overflow-hidden bg-slate-50 text-slate-900`}>
      <Backdrop />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-16 px-4 py-10 sm:px-8 lg:grid-cols-[1fr_auto] lg:px-12">
        <Intro />
        <div className="flex justify-center">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
