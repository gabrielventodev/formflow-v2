"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/builder/status-badge";
import { Button, Input } from "@/components/ui";
import { apiDelete, apiGet, apiPost, formsPath, type FormStatus, type FormSummary } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";

const TABS: { value: FormStatus | ""; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "draft", label: "Borradores" },
  { value: "published", label: "Publicados" },
  { value: "archived", label: "Archivados" },
];

export default function FormsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<FormStatus | "">("");
  const [forms, setForms] = useState<FormSummary[] | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");

  const load = useCallback(async () => {
    try {
      setForms(await apiGet<FormSummary[]>(`${formsPath}?status=${tab}`));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [tab]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount and tab change
    void load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const f = await apiPost<FormSummary>(formsPath, { title });
      router.push(`/admin/forms/${f.id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Formularios</h1>
          <p className="text-sm text-zinc-600">Crea, edita y publica los formularios de preonboarding.</p>
        </div>
        {!creating && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            Nuevo formulario
          </Button>
        )}
      </div>

      {creating && (
        <form onSubmit={create} className="mb-6 flex gap-2 rounded-lg border border-zinc-200 bg-white p-4">
          <Input
            autoFocus
            placeholder="Nombre del formulario, p. ej. Onboarding empresas"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Button type="submit" variant="primary" disabled={!title.trim()}>
            Crear
          </Button>
          <Button onClick={() => setCreating(false)}>Cancelar</Button>
        </form>
      )}

      <div className="mb-4 flex gap-1 border-b border-zinc-200">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              tab === t.value ? "border-zinc-900 font-medium text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-800",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {forms === null ? (
        <p className="text-sm text-zinc-500">Cargando…</p>
      ) : forms.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
          No hay formularios aquí todavía.
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
          {forms.map((f) => (
            <li key={f.id} className="flex items-center gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <Link href={`/admin/forms/${f.id}`} className="font-medium hover:underline">
                  {f.title}
                </Link>
                <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                  <StatusBadge form={f} />
                  <span>Editado {formatDate(f.updatedAt)}</span>
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => act(() => apiPost(`${formsPath}/${f.id}/duplicate`))}>
                  Duplicar
                </Button>
                {f.status === "archived" ? (
                  <Button size="sm" variant="ghost" onClick={() => act(() => apiPost(`${formsPath}/${f.id}/restore`))}>
                    Restaurar
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => act(() => apiPost(`${formsPath}/${f.id}/archive`))}>
                    Archivar
                  </Button>
                )}
                {!f.currentVersion && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => confirm(`¿Eliminar "${f.title}"?`) && act(() => apiDelete(`${formsPath}/${f.id}`))}
                  >
                    Eliminar
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
