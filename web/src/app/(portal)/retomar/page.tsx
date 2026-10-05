"use client";

import { Loader2, MailCheck } from "lucide-react";
import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { ApiError, portal } from "@/lib/portal-api";

export default function ResumePage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSending(true);
    try {
      await portal.resume(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos enviar el enlace.");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <MailCheck className="mx-auto h-8 w-8 text-emerald-600" />
        <h1 className="mt-3 text-lg font-semibold">Revisa tu email</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Si tienes solicitudes pendientes con <strong>{email}</strong>, te enviamos un enlace nuevo para continuar. Los enlaces anteriores dejan de funcionar.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Continuar una solicitud</h1>
      <p className="text-sm text-zinc-600">Escribe el email con el que empezaste y te enviaremos un enlace nuevo.</p>
      <form onSubmit={send} className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <label htmlFor="email" className="block text-sm font-medium text-zinc-800">
          Email
        </label>
        <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" variant="primary" className="w-full" disabled={sending}>
          {sending && <Loader2 className="h-4 w-4 animate-spin" />}
          Enviarme el enlace
        </Button>
      </form>
    </div>
  );
}
