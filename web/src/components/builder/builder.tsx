"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { FormRenderer } from "@/components/form-renderer";
import { Button, Input } from "@/components/ui";
import { ApiError, apiGet, apiPatch, apiPost, formsPath, type FormDetail, type FormVersion, type VersionInfo } from "@/lib/api";
import { FIELD_GROUPS, FIELD_TYPES, locateProblem, type FieldType, type FormSchema, type Problem } from "@/lib/form-schema";
import { cn, formatDate } from "@/lib/utils";
import { Canvas } from "./canvas";
import { Inspector } from "./inspector";
import { addField, addSection, duplicateField, removeField, removeSection, type Selection } from "./ops";
import { StatusBadge } from "./status-badge";

type Tab = "edit" | "preview" | "versions";
type SaveState = "saved" | "pending" | "saving" | "error";

export function Builder({ formId }: { formId: string }) {
  const [form, setForm] = useState<FormDetail | null>(null);
  const [schema, setSchema] = useState<FormSchema>({ sections: [] });
  const [title, setTitle] = useState("");
  const [sel, setSel] = useState<Selection>(null);
  const [tab, setTab] = useState<Tab>("edit");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [problems, setProblems] = useState<Problem[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [publishing, setPublishing] = useState(false);

  const base = `${formsPath}/${formId}`;
  const pending = useRef<{ title: string; schema: FormSchema } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const chain = useRef<Promise<void>>(Promise.resolve());

  const checkProblems = useCallback(async () => {
    const r = await apiGet<{ problems: Problem[] }>(`${base}/validate`);
    setProblems(r.problems);
  }, [base]);

  useEffect(() => {
    apiGet<FormDetail>(base)
      .then((f) => {
        setForm(f);
        setSchema(f.schema);
        setTitle(f.title);
        setSel(f.schema.sections.length ? { s: 0 } : null);
        return checkProblems();
      })
      .catch((e) => setError((e as Error).message));
  }, [base, checkProblems]);

  // Saves are serialized so an older draft can never overwrite a newer one.
  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const draft = pending.current;
    pending.current = null;
    if (!draft) return chain.current;
    chain.current = chain.current.then(async () => {
      setSaveState("saving");
      try {
        const f = await apiPatch<FormDetail>(base, { title: draft.title, schema: draft.schema });
        setForm((prev) => (prev ? { ...f, schema: prev.schema } : f));
        setSaveState(pending.current ? "pending" : "saved");
      } catch (e) {
        setSaveState("error");
        setError((e as Error).message);
        return;
      }
      await checkProblems().catch(() => {});
    });
    return chain.current;
  }, [base, checkProblems]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pending.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const change = (next: { title?: string; schema?: FormSchema }, nextSel?: Selection) => {
    const draft = { title: next.title ?? title, schema: next.schema ?? schema };
    if (next.title !== undefined) setTitle(next.title);
    if (next.schema) setSchema(next.schema);
    if (nextSel !== undefined) setSel(nextSel);
    pending.current = draft;
    setSaveState("pending");
    setNotice("");
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 700);
  };
  const changeSchema = (s: FormSchema, nextSel?: Selection) => change({ schema: s }, nextSel);

  const publish = async () => {
    setPublishing(true);
    setError("");
    try {
      await flush();
      const f = await apiPost<FormDetail>(`${base}/publish`);
      setForm((prev) => (prev ? { ...f, schema: prev.schema } : f));
      setNotice(`Versión ${f.currentVersion?.number} publicada. Los nuevos envíos usarán esta versión.`);
    } catch (e) {
      if (e instanceof ApiError && e.problems.length) {
        setProblems(e.problems);
        setTab("edit");
      }
      setError((e as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  if (!form) {
    return <main className="p-8 text-sm text-zinc-500">{error || "Cargando…"}</main>;
  }

  const archived = form.status === "archived";
  const problemPaths = new Set(problems.map((p) => p.path));
  const changed = form.hasUnpublishedChanges || saveState === "pending" || saveState === "saving";
  const canPublish = !archived && changed && problems.length === 0 && saveState !== "error";

  const addOfType = (type: FieldType) => {
    const r = addField(schema, sel, type);
    changeSchema(r.schema, r.sel);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 bg-white px-4 py-2">
        <Link href="/admin/forms" className="rounded p-1 text-zinc-500 hover:bg-zinc-100" aria-label="Volver">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <Input
          aria-label="Título del formulario"
          className="h-8 max-w-sm border-transparent font-medium hover:border-zinc-300"
          value={title}
          disabled={archived}
          onChange={(e) => change({ title: e.target.value })}
        />
        <StatusBadge form={form} />
        <span className="text-xs text-zinc-500">
          {{ saved: "Guardado", pending: "Cambios sin guardar…", saving: "Guardando…", error: "Error al guardar" }[saveState]}
        </span>
        <div className="ml-auto flex items-center gap-1 rounded-md bg-zinc-100 p-0.5">
          {(
            [
              ["edit", "Editar"],
              ["preview", "Vista previa"],
              ["versions", "Versiones"],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn("rounded px-3 py-1 text-sm", tab === t ? "bg-white font-medium shadow-sm" : "text-zinc-600")}
            >
              {label}
            </button>
          ))}
        </div>
        <Button
          variant="primary"
          onClick={publish}
          disabled={!canPublish || publishing}
          title={
            archived
              ? "Restaura el formulario para publicarlo"
              : !changed
                ? "No hay cambios sin publicar"
                : problems.length
                  ? "Corrige los problemas antes de publicar"
                  : undefined
          }
        >
          {publishing ? "Publicando…" : form.currentVersion ? "Publicar cambios" : "Publicar"}
        </Button>
      </div>

      {(error || notice || archived) && (
        <div className="space-y-2 px-4 pt-3">
          {archived && (
            <p className="rounded-md bg-zinc-100 p-3 text-sm text-zinc-700">Este formulario está archivado. Restáuralo desde la lista para editarlo.</p>
          )}
          {error && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
              <button className="ml-2 underline" onClick={() => setError("")}>
                Cerrar
              </button>
            </p>
          )}
          {notice && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        </div>
      )}

      {tab === "edit" && (
        <div className={cn("grid flex-1 grid-cols-[200px_1fr_320px] gap-4 p-4", archived && "pointer-events-none opacity-60")}>
          <aside>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Agregar campo</h2>
            <div className="space-y-4">
              {FIELD_GROUPS.map((g) => (
                <div key={g.value}>
                  <h3 className="mb-1 text-[11px] font-medium text-zinc-500">{g.label}</h3>
                  <div className="space-y-1">
                    {FIELD_TYPES.filter((t) => t.group === g.value).map((t) => (
                      <button
                        key={t.type}
                        onClick={() => addOfType(t.type)}
                        className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-left hover:border-zinc-400"
                      >
                        <span className="block text-sm font-medium">{t.label}</span>
                        <span className="block text-xs text-zinc-500">{t.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <div className="min-w-0">
            {problems.length > 0 && (
              <details className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <summary className="cursor-pointer font-medium">
                  {problems.length === 1 ? "1 cosa por revisar" : `${problems.length} cosas por revisar`} antes de publicar
                </summary>
                <ul className="mt-2 space-y-1">
                  {problems.map((p, i) => {
                    const loc = locateProblem(p.path);
                    return (
                      <li key={i}>
                        <button
                          className="text-left hover:underline"
                          onClick={() => loc.section !== undefined && setSel({ s: loc.section, f: loc.field, sub: loc.sub })}
                        >
                          {describe(schema, loc)}
                          {p.message}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </details>
            )}
            <Canvas
              schema={schema}
              sel={sel}
              problemPaths={problemPaths}
              onSelect={setSel}
              onChange={changeSchema}
              onAddSection={() => {
                const r = addSection(schema);
                changeSchema(r.schema, r.sel);
              }}
              onRemoveSection={(s) => changeSchema(removeSection(schema, s), null)}
              onRemoveField={(target) => changeSchema(removeField(schema, target), target && { s: target.s })}
              onDuplicateField={(target) => {
                const r = duplicateField(schema, target);
                changeSchema(r.schema, r.sel);
              }}
            />
          </div>

          <aside className="rounded-lg border border-zinc-200 bg-white p-4">
            <Inspector
              schema={schema}
              sel={sel}
              published={!!form.currentVersion}
              problems={problems}
              onChange={changeSchema}
              onSelect={setSel}
            />
          </aside>
        </div>
      )}

      {tab === "preview" && (
        <div className="mx-auto w-full max-w-2xl p-6">
          <p className="mb-4 text-xs text-zinc-500">Vista previa del borrador actual. Nada de lo que escribas aquí se guarda.</p>
          <div className="rounded-lg border border-zinc-200 bg-white p-6">
            <h1 className="mb-6 text-xl font-semibold">{title}</h1>
            <FormRenderer key={JSON.stringify(schema)} schema={schema} />
          </div>
        </div>
      )}

      {tab === "versions" && <Versions base={base} current={form.currentVersion} />}
    </div>
  );
}

function describe(schema: FormSchema, loc: ReturnType<typeof locateProblem>) {
  if (loc.section === undefined) return "";
  const sec = schema.sections[loc.section];
  const f = loc.field !== undefined ? sec?.fields[loc.field] : undefined;
  const sub = loc.sub !== undefined ? f?.fields?.[loc.sub] : undefined;
  const name = sub?.label || f?.label || sec?.title || `Sección ${loc.section + 1}`;
  return `${name}: `;
}

function Versions({ base, current }: { base: string; current: VersionInfo | null }) {
  const [versions, setVersions] = useState<VersionInfo[] | null>(null);
  const [open, setOpen] = useState<FormVersion | null>(null);

  useEffect(() => {
    apiGet<VersionInfo[]>(`${base}/versions`).then(setVersions);
  }, [base, current?.id]);

  if (!versions) return <p className="p-6 text-sm text-zinc-500">Cargando…</p>;
  if (versions.length === 0) {
    return <p className="p-6 text-sm text-zinc-500">Todavía no hay versiones publicadas. Al publicar se congela una versión que no cambia más.</p>;
  }
  return (
    <div className="grid flex-1 grid-cols-[260px_1fr] gap-4 p-4">
      <ul className="space-y-1">
        {versions.map((v) => (
          <li key={v.id}>
            <button
              onClick={() => apiGet<FormVersion>(`${base}/versions/${v.number}`).then(setOpen)}
              className={cn(
                "w-full rounded-md border bg-white px-3 py-2 text-left text-sm",
                open?.id === v.id ? "border-zinc-900" : "border-zinc-200 hover:border-zinc-400",
              )}
            >
              <span className="font-medium">Versión {v.number}</span>
              {v.id === current?.id && <span className="ml-2 text-xs text-emerald-700">vigente</span>}
              <span className="block text-xs text-zinc-500">{formatDate(v.publishedAt)}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        {open ? (
          <>
            <p className="mb-4 text-xs text-zinc-500">
              Versión {open.number}, solo lectura. Los envíos hechos con esta versión siempre se muestran con este esquema.
            </p>
            <FormRenderer key={open.id} schema={open.schema} />
          </>
        ) : (
          <p className="text-sm text-zinc-500">Elige una versión para verla.</p>
        )}
      </div>
    </div>
  );
}
