"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch, ApiError, canManage, formatDate, ROLE_LABEL, type Member, type Role } from "@/lib/admin";
import { useMe } from "@/components/admin/shell";

const ROLE_HELP: Record<Role, string> = {
  owner: "Todo, incluido gestionar a otros propietarios",
  admin: "Formularios, enlaces, revisión, equipo y actividad",
  reviewer: "Solo revisa envíos",
};

export default function TeamPage() {
  const me = useMe();
  const manager = canManage(me.role);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ text: string; link?: string } | null>(null);
  const [inviting, setInviting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    adminFetch<Member[]>("/admin/team").then(setMembers, (e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  // An owner manages anyone; an admin manages everyone but owners. Nobody changes their own role or access.
  const editable = (m: Member) => manager && m.id !== me.id && (me.role === "owner" || m.role !== "owner");
  const roles: Role[] = me.role === "owner" ? ["owner", "admin", "reviewer"] : ["admin", "reviewer"];

  async function patch(m: Member, body: Partial<Pick<Member, "role" | "active">>, done: string) {
    setBusy(m.id);
    setError("");
    setNotice(null);
    try {
      const updated = await adminFetch<Member>(`/admin/team/${m.id}`, { method: "PATCH", body: JSON.stringify(body) });
      setMembers((list) => list?.map((x) => (x.id === m.id ? updated : x)) ?? null);
      setNotice({ text: done });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo guardar");
    } finally {
      setBusy(null);
    }
  }

  async function sendLink(m: Member) {
    setBusy(m.id);
    setError("");
    setNotice(null);
    try {
      const res = await adminFetch<{ invite_url: string; purpose: string }>(`/admin/team/${m.id}/invite`, { method: "POST" });
      setNotice({
        text: `Enviamos a ${m.email} un enlace para ${res.purpose === "invite" ? "crear" : "cambiar"} su contraseña. Si el correo no llega, compártele este enlace:`,
        link: res.invite_url,
      });
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo enviar el enlace");
    } finally {
      setBusy(null);
    }
  }

  function toggleActive(m: Member) {
    if (m.active && !confirm(`¿Desactivar a ${m.name || m.email}? Se cerrarán sus sesiones y sus envíos abiertos quedarán sin asignar.`)) return;
    patch(m, { active: !m.active }, m.active ? `${m.email} ya no puede entrar al panel.` : `${m.email} puede volver a entrar.`);
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Equipo</h1>
          <p className="text-sm text-zinc-500">Quiénes pueden entrar al panel y qué puede hacer cada uno.</p>
        </div>
        {manager && !inviting && (
          <button className="btn-primary" onClick={() => { setInviting(true); setNotice(null); }}>
            Invitar miembro
          </button>
        )}
      </div>

      {inviting && (
        <InviteForm
          roles={roles}
          onCancel={() => setInviting(false)}
          onDone={(member, link) => {
            setInviting(false);
            setMembers((list) => [...(list ?? []), member]);
            setNotice({ text: `Invitamos a ${member.email}. Si el correo no llega, compártele este enlace (vence en 7 días):`, link });
          }}
        />
      )}

      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      {notice && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {notice.text}
          {notice.link && <CopyLink url={notice.link} />}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="block w-full text-sm sm:table">
          <thead className="hidden border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 sm:table-header-group">
            <tr>
              <th className="px-4 py-3 font-medium">Miembro</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Último acceso</th>
              {manager && <th className="px-4 py-3 font-medium"><span className="sr-only">Acciones</span></th>}
            </tr>
          </thead>
          <tbody className="block sm:table-row-group">
            {members?.map((m) => (
              <tr key={m.id} className={`block border-b border-zinc-100 px-4 py-3 last:border-0 sm:table-row sm:p-0 ${m.active ? "" : "text-zinc-400"}`}>
                <td className="block sm:table-cell sm:px-4 sm:py-3">
                  <div className="font-medium">
                    {m.name || m.email}
                    {m.id === me.id && <span className="ml-1.5 text-xs font-normal text-zinc-500">(tú)</span>}
                  </div>
                  {m.name && <div className="text-xs text-zinc-500">{m.email}</div>}
                  <div className="mt-1 flex gap-1.5">
                    {m.pending && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">Invitación pendiente</span>}
                    {!m.active && <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">Desactivado</span>}
                  </div>
                </td>
                <td className="mt-2 block sm:mt-0 sm:table-cell sm:px-4 sm:py-3">
                  {editable(m) && m.active ? (
                    <select
                      aria-label={`Rol de ${m.name || m.email}`}
                      value={m.role}
                      disabled={busy === m.id}
                      onChange={(e) => {
                        const role = e.target.value as Role;
                        patch(m, { role }, `${m.email} ahora es ${ROLE_LABEL[role].toLowerCase()}.`);
                      }}
                      className="input"
                    >
                      {(roles.includes(m.role) ? roles : [m.role, ...roles]).map((r) => (
                        <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                      ))}
                    </select>
                  ) : (
                    <span title={ROLE_HELP[m.role]}>{ROLE_LABEL[m.role]}</span>
                  )}
                </td>
                <td className="mt-2 block text-xs text-zinc-600 sm:mt-0 sm:table-cell sm:whitespace-nowrap sm:px-4 sm:py-3 sm:text-sm">
                  <span className="sm:hidden">Último acceso: </span>
                  {m.last_login_at ? formatDate(m.last_login_at) : "Nunca"}</td>
                {manager && (
                  <td className="block sm:table-cell sm:px-4 sm:py-3">
                    {editable(m) && (
                      <div className="mt-3 flex flex-wrap gap-2 sm:mt-0 sm:flex-nowrap sm:justify-end">
                        {m.active && (
                          <button className="btn" disabled={busy === m.id} onClick={() => sendLink(m)}>
                            {m.pending ? "Reenviar invitación" : "Enviar enlace de contraseña"}
                          </button>
                        )}
                        <button
                          className={m.active ? "btn !text-rose-700" : "btn"}
                          disabled={busy === m.id}
                          onClick={() => toggleActive(m)}
                        >
                          {m.active ? "Desactivar" : "Reactivar"}
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {!members && !error && (
              <tr className="block sm:table-row">
                <td colSpan={4} className="block px-4 py-12 sm:table-cell text-center text-zinc-500">Cargando…</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        {(["owner", "admin", "reviewer"] as Role[]).map((r) => (
          <div key={r} className="card px-4 py-3">
            <dt className="font-medium">{ROLE_LABEL[r]}</dt>
            <dd className="text-zinc-500">{ROLE_HELP[r]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function InviteForm({
  roles,
  onCancel,
  onDone,
}: {
  roles: Role[];
  onCancel: () => void;
  onDone: (m: Member, link: string) => void;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError("");
    try {
      const res = await adminFetch<{ member: Member; invite_url: string }>("/admin/team", {
        method: "POST",
        body: JSON.stringify({ email: form.get("email"), name: form.get("name"), role: form.get("role") }),
      });
      onDone(res.member, res.invite_url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo invitar");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-3 p-4">
      <h2 className="font-medium">Invitar miembro</h2>
      <p className="text-sm text-zinc-500">Le enviaremos un correo con un enlace para crear su contraseña.</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-700">Email</span>
          <input name="email" type="email" required autoFocus className="input w-full" placeholder="persona@empresa.com" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-700">Nombre <span className="font-normal text-zinc-500">(opcional)</span></span>
          <input name="name" className="input w-full" maxLength={200} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-700">Rol</span>
          <select name="role" defaultValue="reviewer" className="input w-full">
            {roles.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
        </label>
      </div>
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Invitando…" : "Enviar invitación"}</button>
        <button type="button" className="btn" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <code className="max-w-full truncate rounded bg-white px-2 py-1 text-xs text-zinc-700">{url}</code>
      <button
        className="btn !py-1 text-xs"
        onClick={() => navigator.clipboard.writeText(url).then(() => setCopied(true), () => {})}
      >
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}
