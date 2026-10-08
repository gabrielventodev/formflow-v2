"use client";

import { Check, Copy, Link2, Mail, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Input, Label, Textarea } from "@/components/ui";
import { apiDelete, apiGet, apiPost, formsPath, type FormDetail } from "@/lib/api";
import { formatDate } from "@/lib/utils";

type FormLink = {
  id: string;
  kind: "public" | "invite";
  token: string;
  url: string;
  inviteeEmail: string | null;
  expiresAt: string | null;
  createdAt: string;
  submissions: number;
};

const linksPath = "/api/v1/admin/links";

/** Share a published form: one public link, or personal invitations sent by email. */
export function LinksManager({ formId }: { formId: string }) {
  const [form, setForm] = useState<FormDetail | null>(null);
  const [links, setLinks] = useState<FormLink[]>([]);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [expires, setExpires] = useState("");
  const [sent, setSent] = useState("");
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    try {
      const [f, l] = await Promise.all([
        apiGet<FormDetail>(`${formsPath}/${formId}`),
        apiGet<FormLink[]>(`${linksPath}?formId=${formId}`),
      ]);
      setForm(f);
      setLinks(l);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [formId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    void load();
  }, [load]);

  const expiresAt = expires ? new Date(`${expires}T23:59:59`).toISOString() : null;

  const createPublic = async () => {
    setError("");
    try {
      await apiPost(linksPath, { formId, kind: "public", expiresAt });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSent("");
    try {
      await apiPost(linksPath, { formId, kind: "invite", inviteeEmail: email, inviteeName: name, message, expiresAt });
      setSent(email);
      setEmail("");
      setName("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("¿Desactivar este enlace? Quienes ya empezaron pueden seguir con su enlace privado.")) return;
    try {
      await apiDelete(`${linksPath}/${id}`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const copy = async (l: FormLink) => {
    await navigator.clipboard.writeText(l.url);
    setCopied(l.id);
    setTimeout(() => setCopied(""), 1500);
  };

  const published = form?.status === "published";

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <Link href={`/admin/forms/${formId}`} className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Volver al formulario
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Compartir {form ? `“${form.title}”` : ""}</h1>
        <p className="text-sm text-zinc-600">Las personas completan el formulario sin crear cuenta. Cada una recibe un enlace privado para continuar.</p>
      </div>

      {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {form && !published && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Publica el formulario para poder compartirlo.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="flex items-center gap-2 font-medium">
            <Link2 className="h-4 w-4" /> Enlace público
          </h2>
          <p className="text-sm text-zinc-600">Para publicar en tu web o enviar por WhatsApp. Cualquiera con el enlace puede empezar una solicitud.</p>
          <div>
            <Label htmlFor="expires" hint="(opcional)">
              Vence el
            </Label>
            <Input id="expires" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
          </div>
          <Button variant="primary" onClick={createPublic} disabled={!published}>
            Crear enlace público
          </Button>
        </section>

        <form onSubmit={invite} className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="flex items-center gap-2 font-medium">
            <Mail className="h-4 w-4" /> Invitar por email
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="inv-name">Nombre</Label>
              <Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="inv-email">Email</Label>
              <Input id="inv-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="inv-msg" hint="(opcional)">
              Mensaje
            </Label>
            <Textarea id="inv-msg" value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <Button type="submit" variant="primary" disabled={!published}>
            Enviar invitación
          </Button>
          {sent && <p className="text-sm text-emerald-700">Invitación enviada a {sent}.</p>}
        </form>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white">
        <h2 className="border-b border-zinc-100 px-5 py-3 font-medium">Enlaces activos</h2>
        {links.length === 0 ? (
          <p className="px-5 py-6 text-sm text-zinc-500">Todavía no hay enlaces.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {links.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-sm sm:px-5">
                <Badge tone={l.kind === "public" ? "blue" : "zinc"}>{l.kind === "public" ? "Público" : "Invitación"}</Badge>
                <div className="order-last min-w-0 flex-1 basis-full sm:order-none sm:basis-0">
                  <p className="truncate font-mono text-xs">{l.url}</p>
                  <p className="text-xs text-zinc-500">
                    {l.inviteeEmail && `${l.inviteeEmail} · `}
                    {l.submissions} {l.submissions === 1 ? "solicitud" : "solicitudes"} · creado {formatDate(l.createdAt)}
                    {l.expiresAt && ` · vence ${formatDate(l.expiresAt)}`}
                  </p>
                </div>
                <Button size="sm" className="ml-auto sm:ml-0" onClick={() => copy(l)}>
                  {copied === l.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied === l.id ? "Copiado" : "Copiar"}
                </Button>
                <Button size="sm" variant="danger" onClick={() => remove(l.id)} aria-label="Desactivar enlace">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
