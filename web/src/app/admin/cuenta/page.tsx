"use client";

import { useState } from "react";
import { adminFetch, ApiError, ROLE_LABEL } from "@/lib/admin";
import { useMe } from "@/components/admin/shell";

const MIN = 8;

export default function AccountPage() {
  const me = useMe();
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const password = String(form.get("password") ?? "");
    setDone(false);
    if (password.length < MIN) return setError(`La contraseña nueva debe tener al menos ${MIN} caracteres.`);
    if (password !== form.get("confirm")) return setError("Las contraseñas nuevas no coinciden.");
    setPending(true);
    setError("");
    try {
      await adminFetch("/auth/me/password", {
        method: "PUT",
        body: JSON.stringify({ current_password: form.get("current"), password }),
      });
      formEl.reset();
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cambiar la contraseña");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 px-4 py-6 sm:px-6">
      <h1 className="text-xl font-semibold">Mi cuenta</h1>
      <dl className="card grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 p-4 text-sm">
        <dt className="text-zinc-500">Nombre</dt>
        <dd>{me.name || "—"}</dd>
        <dt className="text-zinc-500">Email</dt>
        <dd>{me.email}</dd>
        <dt className="text-zinc-500">Rol</dt>
        <dd>{ROLE_LABEL[me.role]}</dd>
      </dl>

      <form onSubmit={onSubmit} className="card space-y-3 p-4">
        <h2 className="font-medium">Cambiar contraseña</h2>
        <p className="text-sm text-zinc-500">Se cerrarán tus sesiones en otros dispositivos; esta sigue abierta.</p>
        <input type="email" name="username" value={me.email} autoComplete="username" readOnly hidden />
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-700">Contraseña actual</span>
          <input name="current" type="password" required autoComplete="current-password" className="input w-full" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-700">Contraseña nueva <span className="font-normal text-zinc-500">(mínimo {MIN} caracteres)</span></span>
          <input name="password" type="password" required minLength={MIN} autoComplete="new-password" className="input w-full" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-700">Repite la contraseña nueva</span>
          <input name="confirm" type="password" required autoComplete="new-password" className="input w-full" />
        </label>
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        {done && <p role="status" className="text-sm text-emerald-700">Listo, tu contraseña cambió.</p>}
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Guardando…" : "Cambiar contraseña"}</button>
      </form>
    </div>
  );
}
