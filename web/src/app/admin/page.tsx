"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { adminFetch, formatDate, type Facets, type SubmissionList } from "@/lib/admin";
import { StatusBadge } from "@/components/admin/status-badge";

type Tab = { key: string; label: string; status?: string; assigned?: string; count: (c: SubmissionList["counts"]) => number | undefined };

const TABS: Tab[] = [
  { key: "pending", label: "Por revisar", status: "submitted,in_review", count: (c) => (c.submitted ?? 0) + (c.in_review ?? 0) },
  { key: "mine", label: "Asignados a mí", status: "submitted,in_review", assigned: "me", count: (c) => c.mine },
  { key: "changes", label: "Observados", status: "changes_requested", count: (c) => c.changes_requested },
  { key: "approved", label: "Aprobados", status: "approved", count: (c) => c.approved },
  { key: "rejected", label: "Rechazados", status: "rejected", count: (c) => c.rejected },
  { key: "all", label: "Todos", count: () => undefined },
];

function Inbox() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [list, setList] = useState<SubmissionList | null>(null);
  const [facets, setFacets] = useState<Facets>({ forms: [], reviewers: [] });
  const [error, setError] = useState("");
  const [search, setSearch] = useState(params.get("q") ?? "");

  const tab = TABS.find((t) => t.key === params.get("tab")) ?? TABS[0];
  const page = Number(params.get("page") ?? "1");

  // Query sent to the API: the tab sets status/assigned unless the user picked an explicit reviewer.
  const apiQuery = useMemo(() => {
    const q = new URLSearchParams();
    if (tab.status) q.set("status", tab.status);
    const assigned = params.get("assigned") || tab.assigned;
    if (assigned) q.set("assigned", assigned);
    for (const k of ["form_id", "q", "from", "to", "sort"]) {
      const v = params.get(k);
      if (v) q.set(k, v);
    }
    return q;
  }, [params, tab]);

  useEffect(() => {
    adminFetch<Facets>("/admin/submissions/facets").then(setFacets, () => {});
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(apiQuery);
    q.set("page", String(page));
    adminFetch<SubmissionList>(`/admin/submissions?${q}`).then(
      (l) => {
        setList(l);
        setError("");
      },
      (e) => setError(e.message),
    );
  }, [apiQuery, page]);

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in changes)) next.delete("page");
    router.replace(`${pathname}?${next}`, { scroll: false });
  }

  // Debounce the free-text search into the URL.
  useEffect(() => {
    if (search === (params.get("q") ?? "")) return;
    const t = setTimeout(() => update({ q: search.trim() || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const pages = list ? Math.max(1, Math.ceil(list.total / list.page_size)) : 1;
  const hasFilters = ["form_id", "q", "from", "to", "assigned"].some((k) => params.get(k));

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Envíos</h1>
          <p className="text-sm text-zinc-500">Revisa, observa y aprueba los formularios recibidos.</p>
        </div>
        <a href={`/api/v1/admin/submissions/export.csv?${apiQuery}`} className="btn">
          Exportar CSV
        </a>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-zinc-200">
        {TABS.map((t) => {
          const n = list ? t.count(list.counts) : undefined;
          const active = t.key === tab.key;
          return (
            <button
              key={t.key}
              onClick={() => update({ tab: t.key === "pending" ? null : t.key })}
              className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm ${active ? "border-zinc-900 font-medium" : "border-transparent text-zinc-500 hover:text-zinc-900"}`}
            >
              {t.label}
              {n !== undefined && <span className="rounded-full bg-zinc-100 px-1.5 text-xs text-zinc-600">{n}</span>}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap sm:items-center">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, email o ID"
          className="input col-span-2 w-full sm:w-72"
        />
        <select value={params.get("form_id") ?? ""} onChange={(e) => update({ form_id: e.target.value || null })} className="input col-span-2 min-w-0 sm:col-span-1">
          <option value="">Todos los formularios</option>
          {facets.forms.map((f) => (
            <option key={f.id} value={f.id}>{f.title}</option>
          ))}
        </select>
        <select value={params.get("assigned") ?? ""} onChange={(e) => update({ assigned: e.target.value || null })} className="input min-w-0">
          <option value="">Cualquier revisor</option>
          <option value="none">Sin asignar</option>
          {facets.reviewers.map((r) => (
            <option key={r.id} value={r.id}>{r.name || r.email}</option>
          ))}
        </select>
        <label className="flex min-w-0 flex-col gap-1 text-xs max-sm:order-last text-zinc-500 sm:flex-row sm:items-center sm:text-sm">
          Desde
          <input type="date" value={params.get("from") ?? ""} onChange={(e) => update({ from: e.target.value || null })} className="input min-w-0" />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs max-sm:order-last text-zinc-500 sm:flex-row sm:items-center sm:text-sm">
          Hasta
          <input type="date" value={params.get("to") ?? ""} onChange={(e) => update({ to: e.target.value || null })} className="input min-w-0" />
        </label>
        <select value={params.get("sort") ?? ""} onChange={(e) => update({ sort: e.target.value || null })} className="input min-w-0">
          <option value="">Más recientes</option>
          <option value="oldest">Más antiguos</option>
        </select>
        {hasFilters && (
          <button
            onClick={() => {
              setSearch("");
              update({ form_id: null, q: null, from: null, to: null, assigned: null });
            }}
            className="justify-self-start text-sm text-zinc-500 underline max-sm:order-last"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="card overflow-x-auto">
        <table className="block w-full text-sm sm:table">
          <thead className="hidden border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 sm:table-header-group">
            <tr>
              <th className="px-4 py-3 font-medium">Solicitante</th>
              <th className="px-4 py-3 font-medium">Formulario</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Revisor</th>
              <th className="px-4 py-3 font-medium">Enviado</th>
            </tr>
          </thead>
          <tbody className="block sm:table-row-group">
            {list?.items.map((s) => (
              <tr
                key={s.id}
                onClick={() => router.push(`/admin/envios/${s.id}`)}
                className="block cursor-pointer border-b border-zinc-100 px-4 py-3 last:border-0 hover:bg-zinc-50 sm:table-row sm:p-0"
              >
                <td className="block sm:table-cell sm:px-4 sm:py-3">
                  <Link href={`/admin/envios/${s.id}`} className="font-medium" onClick={(e) => e.stopPropagation()}>
                    {s.applicant_name || s.applicant_email}
                  </Link>
                  {s.applicant_name && <div className="text-xs text-zinc-500">{s.applicant_email}</div>}
                </td>
                <td className="mt-1 block text-zinc-600 sm:mt-0 sm:table-cell sm:px-4 sm:py-3 sm:text-zinc-900">
                  {s.form_title} <span className="text-xs text-zinc-400">v{s.version_number}</span>
                </td>
                <td className="mt-2 block sm:mt-0 sm:table-cell sm:px-4 sm:py-3">
                  <StatusBadge status={s.status} />
                  {s.approval_step && (
                    <div className="mt-1 whitespace-nowrap text-xs text-zinc-500">
                      Paso {s.approval_step.index + 1}/{s.approval_step.total}: {s.approval_step.name}
                    </div>
                  )}
                </td>
                <td className="mt-2 inline-block text-xs text-zinc-500 sm:mt-0 sm:table-cell sm:px-4 sm:py-3 sm:text-sm sm:text-zinc-600">
                  <span className="sm:hidden">Revisor: </span>
                  {s.assigned_to ? s.assigned_to.name || s.assigned_to.email : "—"}
                </td>
                <td className="ml-3 inline-block whitespace-nowrap text-xs text-zinc-500 sm:ml-0 sm:table-cell sm:px-4 sm:py-3 sm:text-sm sm:text-zinc-600">
                  <span className="sm:hidden">· </span>
                  {formatDate(s.submitted_at ?? s.created_at)}</td>
              </tr>
            ))}
            {list && list.items.length === 0 && (
              <tr className="block sm:table-row">
                <td colSpan={5} className="block px-4 py-12 sm:table-cell text-center text-zinc-500">
                  No hay envíos {hasFilters ? "con estos filtros" : "en esta bandeja"}.
                </td>
              </tr>
            )}
            {!list && !error && (
              <tr className="block sm:table-row">
                <td colSpan={5} className="block px-4 py-12 sm:table-cell text-center text-zinc-500">Cargando…</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {list && list.total > list.page_size && (
        <div className="flex items-center justify-between text-sm text-zinc-500">
          <span>
            {(page - 1) * list.page_size + 1}–{Math.min(page * list.page_size, list.total)} de {list.total}
          </span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => update({ page: String(page - 1) })} className="btn">Anterior</button>
            <button disabled={page >= pages} onClick={() => update({ page: String(page + 1) })} className="btn">Siguiente</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense>
      <Inbox />
    </Suspense>
  );
}
