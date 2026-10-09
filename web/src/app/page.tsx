import Link from "next/link";
import { apiGet } from "@/lib/api";
import { FormsisLogo } from "@/components/brand/logo";

export const dynamic = "force-dynamic";

type Health = { status: string; db: string };

async function getHealth(): Promise<Health | null> {
  try {
    return await apiGet<Health>("/api/v1/health");
  } catch {
    return null;
  }
}

export default async function Home() {
  const health = await getHealth();
  const ok = health?.status === "ok";

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <h1>
        <FormsisLogo className="h-12 w-auto" />
      </h1>
      <p className="font-display text-3xl font-bold tracking-tight">Del formulario a la aprobación.</p>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        Preonboarding con formularios configurables, portal de llenado y panel de aprobación.
      </p>
      <div className="flex items-center gap-2 text-sm">
        <span className={`h-2.5 w-2.5 rounded-full ${ok ? "bg-sello" : "bg-red-500"}`} />
        {ok ? "API y base de datos conectadas" : "No se pudo conectar con la API"}
      </div>
      <Link href="/admin/forms" className="w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
        Ir a formularios
      </Link>
    </main>
  );
}
