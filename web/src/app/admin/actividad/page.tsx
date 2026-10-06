"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ACTION_LABEL, adminFetch, formatDate, ROLE_LABEL, STATUS_LABEL, type ActivityRow, type Role } from "@/lib/admin";

const SCOPES = [
  { key: "all", label: "Todo" },
  { key: "submissions", label: "Envíos" },
  { key: "team", label: "Equipo" },
] as const;
type Scope = (typeof SCOPES)[number]["key"];

type Page = { items: ActivityRow[]; next_before: number | null };

function actor(e: ActivityRow): string {
  if (e.actor_type === "applicant") return "Solicitante";
  if (e.actor_type === "system") return "Sistema";
  return e.actor_name || "Usuario";
}

// What the event is about beyond its submission: the member, the form's flow or the approval step.
function target(e: ActivityRow): string {
  if (e.action === "form.approval_flow_updated") {
    const steps = Array.isArray(e.metadata.steps) ? (e.metadata.steps as string[]) : [];
    return `${e.metadata.form_title ?? "un formulario"}: ${steps.length ? steps.join(" → ") : "sin pasos"}`;
  }
  if (e.action === "organization.updated") {
    const parts: string[] = [];
    if (typeof e.metadata.name === "string") parts.push(`nombre «${e.metadata.name}»`);
    if (typeof e.metadata.primary_color === "string") parts.push(`color ${e.metadata.primary_color}`);
    if (typeof e.metadata.support_email === "string") parts.push(e.metadata.support_email ? `contacto ${e.metadata.support_email}` : "sin email de contacto");
    if (e.metadata.logo === "updated") parts.push("logo nuevo");
    if (e.metadata.logo === "removed") parts.push("quitó el logo");
    return parts.length ? `: ${parts.join(", ")}` : "";
  }
  if (e.action.startsWith("webhook.")) return typeof e.metadata.url === "string" ? e.metadata.url : "";
  if (e.action === "step_approved" && typeof e.metadata.step_name === "string") return e.metadata.step_name;
  const email = typeof e.metadata.email === "string" ? e.metadata.email : "";
  if (!e.action.startsWith("member.")) return "";
  const role = (r: unknown) => (typeof r === "string" && r in ROLE_LABEL ? ROLE_LABEL[r as Role].toLowerCase() : "");
  if (e.action === "member.role_changed") return `${email}: ${role(e.metadata.from_role)} → ${role(e.metadata.to_role)}`;
  if (e.action === "member.invited") return `${email} como ${role(e.metadata.role)}`;
  return email;
}

// Organization-wide audit trail: who did what and when, across every submission and the team.
export default function ActivityPage() {
  const [scope, setScope] = useState<Scope>("all");
  const [items, setItems] = useState<ActivityRow[] | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchPage = useCallback(
    (before: number | null) => {
      const q = new URLSearchParams({ scope, limit: "50" });
      if (before) q.set("before", String(before));
      return adminFetch<Page>(`/admin/activity?${q}`)
        .then((p) => {
          setItems((cur) => (before && cur ? [...cur, ...p.items] : p.items));
          setNext(p.next_before);
        }, (e) => setError(e.message))
        .finally(() => setLoading(false));
    },
    [scope],
  );

  useEffect(() => {
    fetchPage(null);
  }, [fetchPage]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">Actividad</h1>
        <p className="text-sm text-zinc-500">Historial de auditoría: quién hizo qué y cuándo. Los registros no se pueden editar ni borrar.</p>
      </div>

      <div className="flex gap-1 border-b border-zinc-200">
        {SCOPES.map((s) => (
          <button
            key={s.key}
            onClick={() => {
              if (s.key === scope) return;
              setItems(null);
              setError("");
              setScope(s.key);
            }}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${scope === s.key ? "border-zinc-900 font-medium" : "border-transparent text-zinc-500 hover:text-zinc-900"}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}

      <ol className="card divide-y divide-zinc-100">
        {items?.map((e) => (
          <li key={e.id} className="flex flex-col gap-0.5 px-4 py-3 text-sm sm:flex-row sm:items-baseline sm:gap-4">
            <time className="shrink-0 text-xs text-zinc-500 sm:w-40">{formatDate(e.created_at)}</time>
            <div className="min-w-0">
              <span className="font-medium">{actor(e)}</span> {ACTION_LABEL[e.action]?.toLowerCase() ?? e.action}{" "}
              {target(e)}
              {e.submission && (
                <>
                  {" · "}
                  <Link href={`/admin/envios/${e.submission.id}`} className="underline underline-offset-2">
                    {e.submission.applicant || "Envío"}
                  </Link>
                  <span className="text-zinc-500"> en {e.submission.form_title}</span>
                </>
              )}
              {e.from_status && e.to_status && (
                <span className="ml-2 text-xs text-zinc-500">
                  {STATUS_LABEL[e.from_status]} → {STATUS_LABEL[e.to_status]}
                </span>
              )}
              {typeof e.metadata.comment === "string" && <div className="text-xs italic text-zinc-600">“{e.metadata.comment}”</div>}
            </div>
          </li>
        ))}
        {items?.length === 0 && <li className="px-4 py-12 text-center text-sm text-zinc-500">Todavía no hay actividad.</li>}
        {!items && !error && <li className="px-4 py-12 text-center text-sm text-zinc-500">Cargando…</li>}
      </ol>

      {next && (
        <div className="text-center">
          <button className="btn" disabled={loading} onClick={() => {
              setLoading(true);
              fetchPage(next);
            }}>
            {loading ? "Cargando…" : "Ver más"}
          </button>
        </div>
      )}
    </div>
  );
}
