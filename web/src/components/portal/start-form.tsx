"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Input } from "@/components/ui";
import { ApiError, portal, type LinkInfo } from "@/lib/portal-api";

/** Landing of a form link: asks for name and email, creates the draft and moves to its magic link. */
export function StartForm({ linkToken }: { linkToken: string }) {
  const router = useRouter();
  const [link, setLink] = useState<LinkInfo | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");

  useEffect(() => {
    portal
      .link(linkToken)
      .then((l) => {
        setLink(l);
        if (l.inviteeEmail) setEmail(l.inviteeEmail);
      })
      .catch((e) => setError(e instanceof ApiError ? e : new ApiError(0, "No pudimos abrir el formulario.")));
  }, [linkToken]);

  if (error) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold">{error.status === 404 ? "Enlace no encontrado" : "Formulario no disponible"}</h1>
        <p className="mt-2 text-sm text-zinc-600">
          {error.status === 404 ? "Revisa que el enlace esté completo o pide uno nuevo a quien te lo envió." : error.message}
        </p>
      </div>
    );
  }
  if (!link) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-zinc-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando…
      </div>
    );
  }

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");
    setStartError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError("Ingresa un email válido");
      return;
    }
    setStarting(true);
    try {
      const res = await portal.start(linkToken, email.trim(), name.trim());
      router.replace(`/s/${res.accessToken}`);
    } catch (err) {
      setStarting(false);
      if (err instanceof ApiError && err.errors.email) setEmailError(err.errors.email);
      else setStartError(err instanceof ApiError ? err.message : "No pudimos empezar. Intenta de nuevo.");
    }
  };

  const steps = link.schema.sections.length;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{link.form.title}</h1>
        {link.form.description && <p className="whitespace-pre-line text-zinc-600">{link.form.description}</p>}
        <p className="text-sm text-zinc-500">
          {steps === 1 ? "1 paso" : `${steps} pasos`} · puedes guardar y continuar después
        </p>
      </div>

      <form onSubmit={start} className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-zinc-800">
            Tu nombre
          </label>
          <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-zinc-800">
            Tu email <span className="text-red-600">*</span>
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            disabled={!!link.inviteeEmail}
            onChange={(e) => setEmail(e.target.value)}
          />
          <p className="mt-1 text-xs text-zinc-500">Te enviaremos un enlace privado para continuar cuando quieras.</p>
          {emailError && <p className="mt-1 text-xs text-red-600">{emailError}</p>}
        </div>
        {startError && <p className="text-sm text-red-600">{startError}</p>}
        <Button type="submit" variant="primary" className="w-full" disabled={starting}>
          {starting && <Loader2 className="h-4 w-4 animate-spin" />}
          Comenzar
        </Button>
      </form>

      <p className="text-center text-sm text-zinc-500">
        ¿Ya habías empezado?{" "}
        <Link href="/retomar" className="font-medium text-zinc-900 underline">
          Recupera tu enlace
        </Link>
      </p>
    </div>
  );
}
