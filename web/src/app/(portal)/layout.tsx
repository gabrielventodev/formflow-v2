import type { Metadata } from "next";
import { getBranding } from "@/lib/branding";

// Magic-link URLs carry the applicant's access token: never leak it through the Referer header.
export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const brand = await getBranding();
  return (
    // .brand-scope swaps the portal's primary (zinc-900) for the organization's color; see globals.css.
    <div
      className="brand-scope flex min-h-screen flex-col bg-zinc-50 text-zinc-900"
      style={{ "--brand": brand.primary_color } as React.CSSProperties}
    >
      <header className="border-b border-zinc-200 bg-white">
        <div className="h-1 bg-zinc-900" aria-hidden />
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4 sm:px-6">
          {brand.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- served by our API, sized by the org
            <img src={brand.logo_url} alt={brand.name} className="h-8 w-auto max-w-48 object-contain" />
          ) : (
            <span className="font-semibold tracking-tight">{brand.name}</span>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <footer className="space-y-1 py-6 text-center text-xs text-zinc-500">
        <p>Tus datos se transmiten cifrados y solo los ve el equipo de {brand.name} que revisa tu solicitud.</p>
        {brand.support_email && (
          <p>
            ¿Dudas? Escríbenos a{" "}
            <a href={`mailto:${brand.support_email}`} className="underline">
              {brand.support_email}
            </a>
          </p>
        )}
      </footer>
    </div>
  );
}
