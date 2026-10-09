import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { FormsisLogo } from "@/components/brand/logo";

// Shared look of the signed-out admin pages (login, forgotten password, set password):
// a frosted card on a light canvas in the Formsis palette (Tinta primary, Sello green accents).
export function Logo() {
  return <FormsisLogo className="h-9 w-auto" />;
}

export function Backdrop() {
  // Vibrant layered background the frosted card sits on. Decorative only.
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-40 -top-40 size-[520px] rounded-full bg-sello/20 blur-3xl" />
      <div className="absolute -right-32 top-1/3 size-[440px] rounded-full bg-zinc-300/50 blur-3xl" />
      <div className="absolute -bottom-48 left-1/3 size-[480px] rounded-full bg-sello/10 blur-3xl" />
      <div className="absolute inset-0 opacity-[0.35] [background-image:radial-gradient(rgb(148_160_173/0.5)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
    </div>
  );
}

// AuthCard centers a single frosted card on the backdrop.
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <main className="relative isolate flex min-h-screen items-center overflow-hidden bg-zinc-50 text-zinc-900">
      <Backdrop />
      <div className="relative mx-auto flex w-full justify-center px-4 py-10">
        <div className="w-full max-w-[420px] rounded-3xl border border-white/70 bg-white/65 p-7 shadow-xl shadow-zinc-900/10 backdrop-blur-xl motion-safe:animate-[ff-rise_350ms_ease-out] sm:p-9">
          <div className="mb-8">
            <Logo />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{subtitle}</p>}
          {children}
        </div>
      </div>
    </main>
  );
}

export function AuthAlert({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "success" }) {
  const styles =
    tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`mt-6 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm ${styles}`}>
      {tone === "error" && <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <span>{children}</span>
    </div>
  );
}

export const authField =
  "h-12 w-full rounded-xl border border-zinc-300 bg-white/80 px-3.5 text-base text-zinc-900 outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-zinc-500 hover:border-zinc-400 focus:border-sello-prof focus:ring-4 focus:ring-sello/25";
export const authLabel = "mb-1.5 block text-sm font-semibold text-zinc-800";
export const authButton =
  "mt-8 inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-tinta px-4 text-base font-semibold text-white shadow-lg shadow-tinta/20 transition-colors duration-200 hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sello-prof disabled:cursor-wait disabled:opacity-75";
export const authLink = "font-semibold text-sello-prof underline-offset-4 hover:underline";
