"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ACTION_LABEL,
  adminFetch,
  formatBytes,
  formatDate,
  STATUS_LABEL,
  type CommentRow,
  type Facets,
  type FileRow,
  type SchemaField,
  type Status,
  type SubmissionDetail,
} from "@/lib/admin";
import { StatusBadge } from "@/components/admin/status-badge";
import { useMe } from "@/components/admin/shell";
import { SignatureView } from "@/components/signature-pad";
import { formatAnswer, isDisplay, type Field } from "@/lib/form-schema";

// Types whose stored value needs formatting to read well (codes, amounts, objects).
const FORMATTED = new Set(["currency", "country", "address", "datetime", "scale"]);

const ACTION_BUTTON: Record<string, { label: string; className: string }> = {
  in_review: { label: "Tomar para revisión", className: "btn" },
  changes_requested: { label: "Pedir correcciones", className: "btn" },
  approved: { label: "Aprobar", className: "btn-primary !bg-emerald-600 hover:!bg-emerald-700 !text-white" },
  rejected: { label: "Rechazar", className: "btn !text-rose-700" },
};

function buttonFor(from: Status, to: Status) {
  if (to === "in_review" && (from === "approved" || from === "rejected")) return { label: "Reabrir revisión", className: "btn" };
  if (to === "in_review" && from === "changes_requested") return { label: "Retirar observación", className: "btn" };
  return ACTION_BUTTON[to];
}

// Answers may be stored flat ({key: value}) or grouped by section ({section: {key: value}}).
function lookup(data: Record<string, unknown>, sectionKey: string, key: string): unknown {
  if (key in data) return data[key];
  const sec = data[sectionKey];
  if (sec && typeof sec === "object" && !Array.isArray(sec)) return (sec as Record<string, unknown>)[key];
  return undefined;
}

function optionLabel(field: SchemaField, v: unknown): string {
  const opt = field.options?.find((o) => (typeof o === "string" ? o === v : o.value === v));
  if (opt && typeof opt !== "string") return opt.label;
  return String(v);
}

function Value({ field, value, files }: { field: SchemaField; value: unknown; files: FileRow[] }) {
  if (field.type === "file") {
    const own = files.filter((f) => f.field_key === field.key);
    if (own.length === 0) return <Empty />;
    return <FileList files={own} />;
  }
  if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) return <Empty />;
  if (field.type === "repeater" && Array.isArray(value)) {
    const cols = field.fields ?? [];
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-zinc-500">
            <tr>{cols.map((c) => <th key={c.key} className="py-1 pr-4 font-medium">{c.label ?? c.key}</th>)}</tr>
          </thead>
          <tbody>
            {value.map((row, i) => (
              <tr key={i} className="border-t border-zinc-100">
                {cols.map((c) => (
                  <td key={c.key} className="py-1 pr-4 align-top">
                    <Value field={c} value={(row as Record<string, unknown>)?.[c.key]} files={files.filter((f) => f.field_key === `${field.key}.${i}.${c.key}`)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (field.type === "signature" && typeof value === "string") {
    return <SignatureView path={value} className="max-w-72 rounded border border-zinc-200 bg-white text-zinc-900" />;
  }
  if (FORMATTED.has(field.type)) return <>{formatAnswer(field as Field, value) || String(value)}</>;
  if (typeof value === "boolean") return <>{value ? "Sí" : "No"}</>;
  if (Array.isArray(value)) return <>{value.map((v) => optionLabel(field, v)).join(", ")}</>;
  if (typeof value === "object") return <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(value, null, 2)}</pre>;
  if (field.type === "date" && typeof value === "string") {
    const d = new Date(value + "T00:00:00");
    return <>{isNaN(d.getTime()) ? value : d.toLocaleDateString("es")}</>;
  }
  if (field.options) return <>{optionLabel(field, value)}</>;
  return <span className="whitespace-pre-wrap">{String(value)}</span>;
}

function Empty() {
  return <span className="text-zinc-400">Sin respuesta</span>;
}

function FileList({ files }: { files: FileRow[] }) {
  const { id } = useParams<{ id: string }>();
  return (
    <ul className="flex flex-col gap-1">
      {files.map((f) => {
        const url = `/api/v1/admin/submissions/${id}/files/${f.id}`;
        const preview = f.mime_type === "application/pdf" || (f.mime_type.startsWith("image/") && f.mime_type !== "image/svg+xml");
        return (
          <li key={f.id} className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs uppercase text-zinc-600">
              {f.filename.split(".").pop()}
            </span>
            <span className="font-medium">{f.filename}</span>
            <span className="text-xs text-zinc-500">{formatBytes(f.size_bytes)}</span>
            {preview && <a href={`${url}?inline=1`} target="_blank" rel="noreferrer" className="text-xs underline">Ver</a>}
            <a href={url} className="text-xs underline">Descargar</a>
          </li>
        );
      })}
    </ul>
  );
}

export default function SubmissionPage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [reviewers, setReviewers] = useState<Facets["reviewers"]>([]);
  const [error, setError] = useState("");
  const [action, setAction] = useState<Status | null>(null);
  const [observing, setObserving] = useState<string | null>(null);

  const load = useCallback(() => {
    adminFetch<SubmissionDetail>(`/admin/submissions/${id}`).then(
      (d) => {
        setDetail(d);
        setError("");
      },
      (e) => setError(e.message),
    );
  }, [id]);

  useEffect(load, [load]);
  useEffect(() => {
    adminFetch<Facets>("/admin/submissions/facets").then((f) => setReviewers(f.reviewers), () => {});
  }, []);

  const fieldLabels = useMemo(() => {
    const m = new Map<string, string>();
    for (const sec of detail?.schema.sections ?? []) for (const f of sec.fields ?? []) m.set(f.key, f.label ?? f.key);
    return m;
  }, [detail]);

  if (error && !detail) return <p className="px-6 py-6 text-sm text-rose-600">{error}</p>;
  if (!detail) return <p className="px-6 py-6 text-sm text-zinc-500">Cargando…</p>;

  const s = detail.submission;
  const commentsByField = new Map<string, CommentRow[]>();
  const generalComments: CommentRow[] = [];
  for (const c of detail.comments) {
    if (c.field_key) commentsByField.set(c.field_key, [...(commentsByField.get(c.field_key) ?? []), c]);
    else generalComments.push(c);
  }
  const schemaKeys = new Set([...fieldLabels.keys(), ...(detail.schema.sections ?? []).map((sec) => sec.key)]);
  const extraKeys = Object.keys(detail.data ?? {}).filter((k) => !schemaKeys.has(k));
  const orphanFiles = detail.files.filter((f) => !fieldLabels.has(f.field_key.split(".")[0]));

  async function assign(userId: string) {
    try {
      await adminFetch(`/admin/submissions/${id}/assignee`, { method: "PUT", body: JSON.stringify({ user_id: userId || null }) });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function resolve(commentId: string) {
    try {
      await adminFetch(`/admin/submissions/${id}/comments/${commentId}/resolve`, { method: "POST" });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
      <div>
        <Link href="/admin" className="text-sm text-zinc-500 hover:underline">← Envíos</Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{s.applicant_name || s.applicant_email}</h1>
            <StatusBadge status={s.status} />
          </div>
          <p className="text-sm text-zinc-500">
            {s.applicant_email} · {s.form_title} v{s.version_number} · enviado {formatDate(s.submitted_at)}
            {s.decided_at && <> · decidido {formatDate(s.decided_at)}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-zinc-500">
            Revisor
            <select value={s.assigned_to?.id ?? ""} onChange={(e) => assign(e.target.value)} className="input">
              <option value="">Sin asignar</option>
              {reviewers.map((r) => (
                <option key={r.id} value={r.id}>{r.id === me.id ? `Yo (${r.name || r.email})` : r.name || r.email}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {detail.allowed_transitions.length > 0 && (
        <div className="card flex flex-wrap items-center gap-2 p-3">
          <span className="mr-2 text-sm text-zinc-500">Acciones:</span>
          {detail.allowed_transitions.map((to) => {
            const b = buttonFor(s.status, to);
            return (
              <button key={to} onClick={() => setAction(to)} className={b.className}>
                {b.label}
              </button>
            );
          })}
        </div>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          {(detail.schema.sections ?? []).map((sec) => (
            <section key={sec.key} className="card">
              <h2 className="border-b border-zinc-200 px-5 py-3 font-medium">{sec.title || sec.key}</h2>
              <dl className="divide-y divide-zinc-100">
                {(sec.fields ?? []).filter((f) => !isDisplay(f.type)).map((f) => {
                  const fieldComments = commentsByField.get(f.key) ?? [];
                  const open = fieldComments.some((c) => !c.resolved_at);
                  return (
                    <div key={f.key} className={`group grid gap-1 px-5 py-3 sm:grid-cols-[200px_1fr] ${open ? "bg-amber-50/60" : ""}`}>
                      <dt className="text-sm text-zinc-500">
                        {f.label ?? f.key}
                        <button
                          onClick={() => setObserving(observing === f.key ? null : f.key)}
                          className="ml-2 text-xs text-zinc-400 underline opacity-0 group-hover:opacity-100 focus:opacity-100"
                        >
                          Observar
                        </button>
                      </dt>
                      <dd className="flex flex-col gap-2 text-sm">
                        <Value field={f} value={lookup(detail.data, sec.key, f.key)} files={detail.files} />
                        {fieldComments.map((c) => (
                          <Comment key={c.id} c={c} onResolve={resolve} />
                        ))}
                        {observing === f.key && (
                          <CommentBox
                            placeholder={`Observación sobre "${f.label ?? f.key}"`}
                            fieldKey={f.key}
                            submissionId={id}
                            onDone={() => {
                              setObserving(null);
                              load();
                            }}
                          />
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          ))}

          {(extraKeys.length > 0 || orphanFiles.length > 0) && (
            <section className="card">
              <h2 className="border-b border-zinc-200 px-5 py-3 font-medium">Otros datos</h2>
              <div className="flex flex-col gap-3 px-5 py-3 text-sm">
                {extraKeys.map((k) => (
                  <div key={k} className="grid gap-1 sm:grid-cols-[200px_1fr]">
                    <span className="text-zinc-500">{k}</span>
                    <Value field={{ key: k, type: "text" }} value={detail.data[k]} files={[]} />
                  </div>
                ))}
                {orphanFiles.length > 0 && <FileList files={orphanFiles} />}
              </div>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          <section className="card">
            <h2 className="border-b border-zinc-200 px-4 py-3 font-medium">Comentarios</h2>
            <div className="flex flex-col gap-3 p-4">
              {generalComments.length === 0 && <p className="text-sm text-zinc-500">Sin comentarios generales.</p>}
              {generalComments.map((c) => (
                <Comment key={c.id} c={c} />
              ))}
              <CommentBox placeholder="Escribe un comentario interno o para el solicitante" submissionId={id} onDone={load} />
            </div>
          </section>

          <section className="card">
            <h2 className="border-b border-zinc-200 px-4 py-3 font-medium">Historial</h2>
            <ol className="flex flex-col gap-3 p-4 text-sm">
              {detail.events.length === 0 && <li className="text-zinc-500">Sin eventos todavía.</li>}
              {[...detail.events].reverse().map((e) => (
                <li key={e.id} className="flex flex-col gap-0.5 border-l-2 border-zinc-200 pl-3">
                  <span>
                    <span className="font-medium">
                      {e.actor_type === "applicant" ? "Solicitante" : e.actor_type === "system" ? "Sistema" : e.actor_name || "Usuario"}
                    </span>{" "}
                    {ACTION_LABEL[e.action]?.toLowerCase() ?? e.action}
                    {e.action === "assigned" && <> a {reviewerName(reviewers, e.metadata.assigned_to)}</>}
                  </span>
                  {e.from_status && e.to_status && (
                    <span className="text-xs text-zinc-500">
                      {STATUS_LABEL[e.from_status]} → {STATUS_LABEL[e.to_status]}
                    </span>
                  )}
                  {typeof e.metadata.comment === "string" && <span className="text-xs italic text-zinc-600">“{e.metadata.comment}”</span>}
                  <time className="text-xs text-zinc-400">{formatDate(e.created_at)}</time>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>

      {action && (
        <TransitionDialog
          submissionId={id}
          from={s.status}
          to={action}
          fields={[...fieldLabels.entries()]}
          onClose={() => setAction(null)}
          onDone={() => {
            setAction(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function reviewerName(reviewers: Facets["reviewers"], id: unknown): string {
  if (!id) return "nadie";
  const r = reviewers.find((r) => r.id === id);
  return r ? r.name || r.email : "otro usuario";
}

function Comment({ c, onResolve }: { c: CommentRow; onResolve?: (id: string) => void }) {
  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${c.resolved_at ? "border-zinc-200 opacity-60" : c.field_key ? "border-amber-300" : "border-zinc-200"}`}>
      <p className="whitespace-pre-wrap">{c.body}</p>
      <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
        <span>{c.author.name || c.author.email}</span>·<span>{formatDate(c.created_at)}</span>
        {c.resolved_at ? (
          <span className="ml-auto">Resuelto</span>
        ) : (
          onResolve && (
            <button onClick={() => onResolve(c.id)} className="ml-auto underline">
              Marcar resuelto
            </button>
          )
        )}
      </div>
    </div>
  );
}

function CommentBox({ submissionId, fieldKey, placeholder, onDone }: { submissionId: string; fieldKey?: string; placeholder: string; onDone: () => void }) {
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setPending(true);
    try {
      await adminFetch(`/admin/submissions/${submissionId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body, field_key: fieldKey ?? "" }),
      });
      setBody("");
      setError("");
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder={placeholder} className="input" autoFocus={!!fieldKey} />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button type="submit" disabled={pending || !body.trim()} className="btn self-end">
        {pending ? "Guardando…" : "Comentar"}
      </button>
    </form>
  );
}

function TransitionDialog({
  submissionId,
  from,
  to,
  fields,
  onClose,
  onDone,
}: {
  submissionId: string;
  from: Status;
  to: Status;
  fields: [string, string][];
  onClose: () => void;
  onDone: () => void;
}) {
  const [comment, setComment] = useState("");
  const [observations, setObservations] = useState<{ field_key: string; body: string }[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const b = buttonFor(from, to);
  const needsComment = to === "rejected";
  const isChanges = to === "changes_requested";
  const validObs = observations.filter((o) => o.field_key && o.body.trim());
  const canSubmit = !pending && (!needsComment || comment.trim()) && (!isChanges || comment.trim() || validObs.length > 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await adminFetch(`/admin/submissions/${submissionId}/transition`, {
        method: "POST",
        body: JSON.stringify({ to, from, comment, field_comments: validObs }),
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="card flex w-full max-w-lg flex-col gap-4 p-6 shadow-xl">
        <h2 className="text-lg font-semibold">{b.label}</h2>
        <p className="text-sm text-zinc-500">
          El envío pasará de <strong>{STATUS_LABEL[from]}</strong> a <strong>{STATUS_LABEL[to]}</strong>.
          {isChanges && " El solicitante podrá corregir los campos observados y reenviar."}
        </p>

        {isChanges && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Campos a corregir</span>
            {observations.map((o, i) => (
              <div key={i} className="flex flex-col gap-1 rounded-md border border-zinc-200 p-2">
                <div className="flex gap-2">
                  <select
                    value={o.field_key}
                    onChange={(e) => setObservations(observations.map((x, j) => (j === i ? { ...x, field_key: e.target.value } : x)))}
                    className="input flex-1"
                  >
                    <option value="">Elige un campo</option>
                    {fields.map(([k, label]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setObservations(observations.filter((_, j) => j !== i))} className="btn" aria-label="Quitar">
                    ✕
                  </button>
                </div>
                <input
                  value={o.body}
                  onChange={(e) => setObservations(observations.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))}
                  placeholder="Qué debe corregir"
                  className="input"
                />
              </div>
            ))}
            <button type="button" onClick={() => setObservations([...observations, { field_key: "", body: "" }])} className="btn self-start">
              + Agregar campo
            </button>
          </div>
        )}

        <label className="flex flex-col gap-1 text-sm">
          {needsComment ? "Motivo del rechazo" : isChanges ? "Mensaje general (opcional si observas campos)" : "Comentario (opcional)"}
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className="input" autoFocus={!isChanges} />
        </label>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn">Cancelar</button>
          <button type="submit" disabled={!canSubmit} className="btn-primary">
            {pending ? "Guardando…" : "Confirmar"}
          </button>
        </div>
      </form>
    </div>
  );
}
