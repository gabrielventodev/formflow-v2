import type { Metadata } from "next";

// Magic-link URLs carry the applicant's access token: never leak it through the Referer header.
export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4 sm:px-6">
          <span className="font-semibold tracking-tight">FormFlow</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <footer className="py-6 text-center text-xs text-zinc-400">Tus datos se transmiten cifrados y solo los ve el equipo que revisa tu solicitud.</footer>
    </div>
  );
}
