"use client";

import { useEffect, useState } from "react";
import { Check, Copy, RefreshCw, Send, Trash2 } from "lucide-react";
import {
  adminFetch,
  ApiError,
  formatDate,
  WEBHOOK_EVENT_LABEL,
  type Delivery,
  type DeliveryStatus,
  type Webhook,
} from "@/lib/admin";

const STATUS: Record<DeliveryStatus, { label: string; cls: string }> = {
  succeeded: { label: "Entregado", cls: "bg-emerald-100 text-emerald-800" },
  pending: { label: "Reintentando", cls: "bg-amber-100 text-amber-900" },
  failed: { label: "Falló", cls: "bg-rose-100 text-rose-800" },
};

function errorText(e: unknown, fallback: string) {
  return e instanceof ApiError ? e.message : fallback;
}

type Draft = { url: string; description: string; events: string[]; include_data: boolean };

// Outgoing webhooks: endpoints that receive a signed POST when a submission changes status.
export default function WebhooksPage() {
  const [hooks, setHooks] = useState<Webhook[] | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState<Draft | null>(null);
  const [revealed, setRevealed] = useState<{ id: string; secret: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function reload() {
    const res = await adminFetch<{ webhooks: Webhook[]; events: string[] }>("/admin/webhooks");
    setHooks(res.webhooks);
    setEvents(res.events);
  }

  useEffect(() => {
    adminFetch<{ webhooks: Webhook[]; events: string[] }>("/admin/webhooks").then(
      (res) => {
        setHooks(res.webhooks);
        setEvents(res.events);
      },
      (e) => setError(errorText(e, "No se pudieron cargar los webhooks")),
    );
  }, []);

  async function create() {
    if (!creating) return;
    setPending(true);
    setError("");
    try {
      const hook = await adminFetch<Webhook>("/admin/webhooks", { method: "POST", body: JSON.stringify(creating) });
      setRevealed({ id: hook.id, secret: hook.secret ?? "" });
      setCreating(null);
      await reload();
    } catch (e) {
      setError(errorText(e, "No se pudo crear el webhook"));
    } finally {
      setPending(false);
    }
  }

  if (!hooks) {
    return <p className="p-6 text-sm text-zinc-500">{error || "Cargando…"}</p>;
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6 sm:px-6">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold">Webhooks</h1>
          <p className="text-sm text-zinc-500">
            Avisa a tus sistemas (CRM, core, Slack vía Zapier o Make) cada vez que un envío cambia de estado. Cada aviso va
            firmado con el secreto del webhook.
          </p>
        </div>
        {!creating && hooks.length < 10 && (
          <button
            className="btn-primary shrink-0"
            onClick={() => setCreating({ url: "", description: "", events: [...events], include_data: false })}
          >
            Nuevo webhook
          </button>
        )}
      </div>

      {error && <p role="alert" className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      {creating && (
        <section className="card space-y-4 p-4" aria-label="Nuevo webhook">
          <HookFields draft={creating} events={events} onChange={setCreating} />
          <div className="flex gap-2">
            <button className="btn-primary" disabled={pending || !creating.url.trim() || creating.events.length === 0} onClick={create}>
              {pending ? "Creando…" : "Crear webhook"}
            </button>
            <button className="btn" onClick={() => setCreating(null)}>Cancelar</button>
          </div>
        </section>
      )}

      {hooks.length === 0 && !creating && (
        <div className="card p-8 text-center text-sm text-zinc-500">
          Todavía no hay webhooks. Crea uno con la URL HTTPS que debe recibir los avisos.
        </div>
      )}

      {hooks.map((h) => (
        <HookCard
          key={h.id}
          hook={h}
          events={events}
          secret={revealed?.id === h.id ? revealed.secret : ""}
          onSecret={(secret) => setRevealed({ id: h.id, secret })}
          onChanged={reload}
          onError={setError}
        />
      ))}

      <details className="text-sm text-zinc-600">
        <summary className="cursor-pointer font-medium text-zinc-800">Cómo verificar la firma</summary>
        <div className="mt-2 space-y-2">
          <p>
            Cada aviso trae el encabezado <code>Formsis-Signature: t=…,v1=…</code>. Calcula HMAC-SHA256 con el secreto sobre{" "}
            <code>{"`${t}.${body}`"}</code> (el body tal cual llegó) y compáralo con <code>v1</code>. Descarta avisos con{" "}
            <code>t</code> de hace más de 5 minutos y usa <code>Formsis-Delivery</code> para ignorar duplicados.
          </p>
          <p>Responde con un código 2xx en menos de 15 segundos. Si no, reintentamos hasta 8 veces durante unas 2 horas.</p>
        </div>
      </details>
    </div>
  );
}

function HookFields({ draft, events, onChange }: { draft: Draft; events: string[]; onChange: (d: Draft) => void }) {
  return (
    <>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">URL del endpoint</span>
        <input
          className="input w-full"
          type="url"
          inputMode="url"
          placeholder="https://mi-sistema.cl/webhooks/formsis"
          value={draft.url}
          onChange={(e) => onChange({ ...draft, url: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">
          Descripción <span className="font-normal text-zinc-500">(opcional)</span>
        </span>
        <input
          className="input w-full"
          maxLength={200}
          placeholder="p. ej. CRM comercial"
          value={draft.description}
          onChange={(e) => onChange({ ...draft, description: e.target.value })}
        />
      </label>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Eventos</legend>
        <div className="flex flex-wrap gap-2">
          {events.map((ev) => {
            const checked = draft.events.includes(ev);
            return (
              <label
                key={ev}
                className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm ${checked ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"}`}
              >
                <input
                  type="checkbox"
                  className="accent-zinc-900"
                  checked={checked}
                  onChange={() =>
                    onChange({ ...draft, events: checked ? draft.events.filter((x) => x !== ev) : [...draft.events, ev] })
                  }
                />
                {WEBHOOK_EVENT_LABEL[ev] ?? ev}
              </label>
            );
          })}
        </div>
      </fieldset>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 accent-zinc-900"
          checked={draft.include_data}
          onChange={(e) => onChange({ ...draft, include_data: e.target.checked })}
        />
        <span>
          Incluir las respuestas del formulario
          <span className="block text-xs text-zinc-500">
            Envía datos personales al endpoint. Los archivos no se incluyen; se revisan en el panel.
          </span>
        </span>
      </label>
    </>
  );
}

function HookCard({
  hook,
  events,
  secret,
  onSecret,
  onChanged,
  onError,
}: {
  hook: Webhook;
  events: string[];
  secret: string;
  onSecret: (s: string) => void;
  onChanged: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [editing, setEditing] = useState<Draft | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [payload, setPayload] = useState<{ id: string; text: string } | null>(null);
  const base = `/admin/webhooks/${hook.id}`;

  async function run(fn: () => Promise<unknown>, fallback: string) {
    setBusy(true);
    onError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      onError(errorText(e, fallback));
    } finally {
      setBusy(false);
    }
  }

  const loadDeliveries = () => adminFetch<Delivery[]>(`${base}/deliveries?limit=50`).then(setDeliveries);

  function toggleDeliveries() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    run(loadDeliveries, "No se pudo cargar el historial");
  }

  function sendTest() {
    run(async () => {
      await adminFetch(`${base}/test`, { method: "POST" });
      setNotice("Prueba en camino. Revisa el historial en unos segundos.");
      setOpen(true);
      // The worker sends right away; give it a moment before refreshing.
      await new Promise((r) => setTimeout(r, 1500));
      await Promise.all([loadDeliveries(), onChanged()]);
    }, "No se pudo enviar la prueba");
  }

  function save() {
    if (!editing) return;
    run(async () => {
      await adminFetch(base, { method: "PATCH", body: JSON.stringify(editing) });
      setEditing(null);
      await onChanged();
    }, "No se pudo guardar");
  }

  function setActive(active: boolean) {
    run(async () => {
      await adminFetch(base, { method: "PATCH", body: JSON.stringify({ active }) });
      await onChanged();
    }, "No se pudo cambiar el estado");
  }

  function rotate() {
    if (!confirm("El secreto actual dejará de servir de inmediato. ¿Rotar?")) return;
    run(async () => {
      const res = await adminFetch<Webhook>(`${base}/rotate-secret`, { method: "POST" });
      onSecret(res.secret ?? "");
      await onChanged();
    }, "No se pudo rotar el secreto");
  }

  function remove() {
    if (!confirm(`¿Eliminar el webhook a ${hook.url}? Se borra también su historial.`)) return;
    run(async () => {
      await adminFetch(base, { method: "DELETE" });
      await onChanged();
    }, "No se pudo eliminar");
  }

  function retry(d: Delivery) {
    run(async () => {
      await adminFetch(`${base}/deliveries/${d.id}/retry`, { method: "POST" });
      await new Promise((r) => setTimeout(r, 1500));
      await Promise.all([loadDeliveries(), onChanged()]);
    }, "No se pudo reintentar");
  }

  function showPayload(d: Delivery) {
    if (payload?.id === d.id) {
      setPayload(null);
      return;
    }
    run(async () => {
      const full = await adminFetch<Delivery>(`${base}/deliveries/${d.id}`);
      setPayload({ id: d.id, text: JSON.stringify(full.payload, null, 2) });
    }, "No se pudo cargar el contenido");
  }

  async function copySecret() {
    await navigator.clipboard.writeText(secret).catch(() => {});
    setCopied(true);
  }

  return (
    <section className="card space-y-3 p-4" aria-label={`Webhook ${hook.description || hook.url}`}>
      {editing ? (
        <>
          <HookFields draft={editing} events={events} onChange={setEditing} />
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy || !editing.url.trim() || editing.events.length === 0} onClick={save}>
              Guardar
            </button>
            <button className="btn" onClick={() => setEditing(null)}>Cancelar</button>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-sm font-medium" title={hook.url}>{hook.url}</p>
              <p className="text-sm text-zinc-500">
                {hook.description || "Sin descripción"} · Secreto <span className="font-mono">{hook.secret_hint}</span>
                {hook.include_data && " · Incluye respuestas"}
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-zinc-900" checked={hook.active} disabled={busy} onChange={(e) => setActive(e.target.checked)} />
              {hook.active ? "Activo" : "Pausado"}
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {hook.events.map((ev) => (
              <span key={ev} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">{WEBHOOK_EVENT_LABEL[ev] ?? ev}</span>
            ))}
          </div>
          <p className="text-sm text-zinc-600">
            {hook.last_delivery ? (
              <>
                Último aviso: <StatusPill status={hook.last_delivery.status} /> {WEBHOOK_EVENT_LABEL[hook.last_delivery.event] ?? hook.last_delivery.event},{" "}
                {formatDate(hook.last_delivery.at)}
              </>
            ) : (
              "Aún no ha enviado avisos."
            )}
            {hook.failing > 0 && (
              <span className="ml-2 text-rose-700">
                {hook.failing} {hook.failing === 1 ? "aviso con problemas" : "avisos con problemas"} en 7 días
              </span>
            )}
          </p>
        </>
      )}

      {secret && (
        <div role="status" className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-medium">Guarda este secreto ahora: no se volverá a mostrar.</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 font-mono text-xs">{secret}</code>
            <button className="btn !px-2" onClick={copySecret} aria-label="Copiar secreto">
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            </button>
          </div>
        </div>
      )}

      {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}

      {!editing && (
        <div className="flex flex-wrap gap-2">
          <button className="btn" disabled={busy || !hook.active} onClick={sendTest} title={hook.active ? undefined : "Activa el webhook para probarlo"}>
            <Send className="size-4" aria-hidden /> Enviar prueba
          </button>
          <button className="btn" onClick={toggleDeliveries} aria-expanded={open}>
            {open ? "Ocultar historial" : "Ver historial"}
          </button>
          <button
            className="btn"
            onClick={() => setEditing({ url: hook.url, description: hook.description, events: hook.events, include_data: hook.include_data })}
          >
            Editar
          </button>
          <button className="btn" disabled={busy} onClick={rotate}>
            <RefreshCw className="size-4" aria-hidden /> Rotar secreto
          </button>
          <button className="btn !text-rose-700" disabled={busy} onClick={remove}>
            <Trash2 className="size-4" aria-hidden /> Eliminar
          </button>
        </div>
      )}

      {open && (
        <div className="overflow-x-auto">
          {deliveries === null ? (
            <p className="text-sm text-zinc-500">Cargando…</p>
          ) : deliveries.length === 0 ? (
            <p className="text-sm text-zinc-500">Sin avisos todavía.</p>
          ) : (
            <table className="block w-full text-left text-sm sm:table">
              <thead className="hidden text-xs text-zinc-500 sm:table-header-group">
                <tr>
                  <th className="py-1 pr-3 font-medium">Evento</th>
                  <th className="py-1 pr-3 font-medium">Estado</th>
                  <th className="py-1 pr-3 font-medium">Respuesta</th>
                  <th className="py-1 pr-3 font-medium">Creado</th>
                  <th className="py-1 font-medium"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="block divide-y divide-zinc-100 sm:table-row-group">
                {deliveries.map((d) => (
                  <DeliveryRow
                    key={d.id}
                    d={d}
                    busy={busy}
                    payload={payload?.id === d.id ? payload.text : ""}
                    onRetry={() => retry(d)}
                    onPayload={() => showPayload(d)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}

function StatusPill({ status }: { status: DeliveryStatus }) {
  const s = STATUS[status];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

function DeliveryRow({
  d,
  busy,
  payload,
  onRetry,
  onPayload,
}: {
  d: Delivery;
  busy: boolean;
  payload: string;
  onRetry: () => void;
  onPayload: () => void;
}) {
  return (
    <>
      <tr className="block py-2 align-top sm:table-row sm:py-0">
        <td className="block font-medium sm:table-cell sm:py-2 sm:pr-3 sm:font-normal">{WEBHOOK_EVENT_LABEL[d.event] ?? d.event}</td>
        <td className="mt-1 block sm:mt-0 sm:table-cell sm:py-2 sm:pr-3">
          <StatusPill status={d.status} />
          <div className="mt-1 text-xs text-zinc-500">
            {d.attempts} {d.attempts === 1 ? "intento" : "intentos"}
            {d.next_attempt_at && d.attempts > 0 && <> · próximo {formatDate(d.next_attempt_at)}</>}
          </div>
        </td>
        <td className="mt-1 block text-xs sm:mt-0 sm:table-cell sm:max-w-xs sm:py-2 sm:pr-3">
          {d.last_status_code && <span className="font-mono">{d.last_status_code}</span>}
          {d.last_error && <div className="break-words text-rose-700">{d.last_error}</div>}
          {!d.last_status_code && !d.last_error && <span className="text-zinc-400">—</span>}
        </td>
        <td className="mt-1 block text-xs text-zinc-600 sm:mt-0 sm:table-cell sm:py-2 sm:pr-3">{formatDate(d.created_at)}</td>
        <td className="mt-1 block whitespace-nowrap sm:mt-0 sm:table-cell sm:py-2 sm:text-right">
          <button className="text-xs text-zinc-600 underline hover:text-zinc-900" onClick={onPayload}>
            {payload ? "Ocultar" : "Contenido"}
          </button>
          {d.status === "failed" && (
            <button className="ml-3 text-xs font-medium text-zinc-900 underline" disabled={busy} onClick={onRetry}>
              Reintentar
            </button>
          )}
        </td>
      </tr>
      {payload && (
        <tr className="block sm:table-row">
          <td colSpan={5} className="block pb-3 sm:table-cell">
            <pre className="max-h-72 overflow-auto rounded-md bg-zinc-900 p-3 text-xs text-zinc-100">{payload}</pre>
          </td>
        </tr>
      )}
    </>
  );
}
