import { apiGet } from "@/lib/api";

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
      <h1 className="text-4xl font-semibold tracking-tight">FormFlow</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        Preonboarding con formularios configurables, portal de llenado y panel de aprobación.
      </p>
      <div className="flex items-center gap-2 text-sm">
        <span className={`h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} />
        {ok ? "API y base de datos conectadas" : "No se pudo conectar con la API"}
      </div>
    </main>
  );
}
