"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/builder/status-badge";
import { Button, Input } from "@/components/ui";
import { apiDelete, apiGet, apiPost, formsPath, type FormStatus, type FormSummary } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";

type TemplateInfo = { key: string; title: string; description: string; summary: string; sections: number; fields: number };

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
  const [templates, setTemplates] = useState<TemplateInfo[] | null>(null);
  const [usingTemplate, setUsingTemplate] = useState("");

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

  const openCreate = () => {
    setCreating(true);
    if (!templates) {
      apiGet<TemplateInfo[]>(`${formsPath}/templates`).then(setTemplates, () => setTemplates([]));
    }
  };

  const fromTemplate = async (key: string) => {
    setUsingTemplate(key);
    try {
      const f = await apiPost<FormSummary>(`${formsPath}/templates/${key}`, title.trim() ? { title: title.trim() } : {});
      router.push(`/admin/forms/${f.id}`);
    } catch (err) {
      setError((err as Error).message);
      setUsingTemplate("");
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
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Formularios</h1>
          <p className="text-sm text-zinc-600">Crea, edita y publica los formularios de preonboarding.</p>
        </div>
        {!creating && (
          <Button variant="primary" className="self-start sm:self-auto" onClick={openCreate}>
            Nuevo formulario
          </Button>
        )}
      </div>

      {creating && (
        <section className="mb-6 space-y-4 rounded-lg border border-zinc-200 bg-white p-4">
          <form onSubmit={create} className="flex flex-col gap-2 sm:flex-row">
            <Input
              autoFocus
              aria-label="Nombre del formulario"
              placeholder="Nombre del formulario, p. ej. Onboarding empresas"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Button type="submit" variant="primary" className="shrink-0 whitespace-nowrap" disabled={!title.trim()}>
              Crear en blanco
            </Button>
            <Button onClick={() => setCreating(false)}>Cancelar</Button>
          </form>
          <div>
            <h2 className="text-sm font-medium text-zinc-900">O parte de una plantilla</h2>
            <p className="mb-3 text-xs text-zinc-500">
              Se crea un borrador que puedes editar antes de publicar.{title.trim() ? ` Usará el nombre "${title.trim()}".` : ""}
            </p>
            {templates === null ? (
              <p className="text-sm text-zinc-500">Cargando plantillas…</p>
            ) : templates.length === 0 ? (
              <p className="text-sm text-zinc-500">No hay plantillas disponibles.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {templates.map((t) => (
                  <li key={t.key} className="flex flex-col rounded-lg border border-zinc-200 p-4">
                    <p className="font-medium">{t.title}</p>
                    <p className="mt-1 flex-1 text-sm text-zinc-600">{t.summary}</p>
                    <p className="mt-2 text-xs text-zinc-500">
                      {t.sections} secciones · {t.fields} campos
                    </p>
                    <Button
                      className="mt-3 self-start"
                      size="sm"
                      disabled={usingTemplate !== ""}
                      onClick={() => fromTemplate(t.key)}
                    >
                      {usingTemplate === t.key ? "Creando…" : "Usar plantilla"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-zinc-200">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm",
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
            <li key={f.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="min-w-0 flex-1">
                <Link href={`/admin/forms/${f.id}`} className="font-medium hover:underline">
                  {f.title}
                </Link>
                <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                  <StatusBadge form={f} />
                  <span>Editado {formatDate(f.updatedAt)}</span>
                </div>
              </div>
              <div className="-ml-2.5 flex flex-wrap gap-1 sm:ml-0">
                {f.status === "published" && (
                  <Link
                    href={`/admin/forms/${f.id}/enlaces`}
                    className="inline-flex h-8 items-center rounded-md px-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                  >
                    Compartir
                  </Link>
                )}
                <Link
                  href={`/admin/forms/${f.id}/aprobaciones`}
                  className="inline-flex h-8 items-center rounded-md px-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                >
                  Aprobaciones
                </Link>
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
