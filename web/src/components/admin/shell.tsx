"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { adminFetch, type Me } from "@/lib/admin";

const MeContext = createContext<Me | null>(null);

export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe outside AdminShell");
  return me;
}

const NAV = [
  { href: "/admin", label: "Envíos", match: (p: string) => p === "/admin" || p.startsWith("/admin/envios") },
  { href: "/admin/forms", label: "Formularios", match: (p: string) => p.startsWith("/admin/forms") },
];

const ROLE_LABEL = { owner: "Propietario", admin: "Administrador", reviewer: "Revisor" };

// AdminShell checks the session and renders the top bar for every /admin page except login.
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin/login")) return <>{children}</>;
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
            <nav className="flex gap-1 text-sm">
              {NAV.map((n) => (
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
              <span className="hidden text-right sm:block">
                <span className="block leading-tight">{me.name || me.email}</span>
                <span className="block text-xs leading-tight text-zinc-500">{ROLE_LABEL[me.role]}</span>
              </span>
              <button onClick={logout} className="btn">Salir</button>
            </div>
          </div>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </div>
    </MeContext.Provider>
  );
}
