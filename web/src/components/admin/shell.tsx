"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { adminFetch, canManage, ROLE_LABEL, type Me, type Role } from "@/lib/admin";

const MeContext = createContext<Me | null>(null);

export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe outside AdminShell");
  return me;
}

const NAV: { href: string; label: string; match: (p: string) => boolean; managers?: boolean }[] = [
  { href: "/admin", label: "Envíos", match: (p) => p === "/admin" || p.startsWith("/admin/envios") },
  { href: "/admin/forms", label: "Formularios", match: (p) => p.startsWith("/admin/forms"), managers: true },
  { href: "/admin/equipo", label: "Equipo", match: (p) => p.startsWith("/admin/equipo") },
  { href: "/admin/actividad", label: "Actividad", match: (p) => p.startsWith("/admin/actividad"), managers: true },
  { href: "/admin/marca", label: "Marca", match: (p) => p.startsWith("/admin/marca"), managers: true },
  { href: "/admin/webhooks", label: "Webhooks", match: (p) => p.startsWith("/admin/webhooks"), managers: true },
];

// Pages reachable without a session: sign in, forgotten password, set password from a link.
const PUBLIC = ["/admin/login", "/admin/olvide", "/admin/contrasena"];

function allowed(pathname: string, role: Role): boolean {
  const item = NAV.find((n) => n.href !== "/admin" && n.match(pathname));
  return !item?.managers || canManage(role);
}

// AdminShell checks the session and renders the top bar for every /admin page except the public ones.
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (PUBLIC.some((p) => pathname.startsWith(p))) return <>{children}</>;
  return <Authenticated>{children}</Authenticated>;
}

function Authenticated({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    adminFetch<Me>("/auth/me").then(setMe, (e) => setError(e.message));
  }, []);

  async function logout() {
    await adminFetch("/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/admin/login");
  }

  if (!me) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-zinc-500">
        {error || "Cargando…"}
      </div>
    );
  }

  return (
    <MeContext.Provider value={me}>
      <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900">
        <header className="border-b border-zinc-200 bg-white">
          <div className="flex h-14 items-center gap-6 px-6">
            <Link href="/admin" className="font-semibold">FormFlow</Link>
            <nav className="flex gap-1 overflow-x-auto text-sm">
              {NAV.filter((n) => !n.managers || canManage(me.role)).map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`rounded-md px-3 py-1.5 ${n.match(pathname) ? "bg-zinc-100 font-medium" : "text-zinc-600 hover:text-zinc-900"}`}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-3 text-sm">
              <Link href="/admin/cuenta" className="hidden rounded-md px-2 py-1 text-right hover:bg-zinc-100 sm:block" title="Mi cuenta">
                <span className="block leading-tight">{me.name || me.email}</span>
                <span className="block text-xs leading-tight text-zinc-500">{ROLE_LABEL[me.role]}</span>
              </Link>
              <button onClick={logout} className="btn">Salir</button>
            </div>
          </div>
        </header>
        <div className="flex flex-1 flex-col">
          {allowed(pathname, me.role) ? (
            children
          ) : (
            <p className="p-12 text-center text-sm text-zinc-500">
              Tu rol de revisor no tiene acceso a esta sección. <Link href="/admin" className="underline">Ir a envíos</Link>
            </p>
          )}
        </div>
      </div>
    </MeContext.Provider>
  );
}
