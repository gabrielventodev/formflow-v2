import type { Metadata } from "next";
import { Figtree, IBM_Plex_Mono, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

// Formsis type: Figtree for the interface, Schibsted Grotesk for headings, IBM Plex Mono for data (RUT, keys, amounts).
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

const schibsted = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Formsis",
  description: "Del formulario a la aprobación. Onboarding de empresas y personas con verificación y panel de revisión.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${figtree.variable} ${schibsted.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
