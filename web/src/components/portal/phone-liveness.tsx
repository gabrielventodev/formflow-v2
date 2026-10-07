"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { LivenessCamera } from "@/components/portal/liveness-field";
import { ApiError, phone, type HandoffInfo } from "@/lib/portal-api";

type State =
  | { kind: "loading" }
  | { kind: "invalid"; message: string }
  | { kind: "ready"; info: HandoffInfo }
  | { kind: "done" };

/**
 * Phone screen of a liveness handoff: only the camera check, nothing else of the application.
 * When it's done the person goes back to the computer, which shows the result.
 */
export function PhoneLiveness({ token }: { token: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    phone
      .info(token)
      .then((info) => setState(info.completed ? { kind: "done" } : { kind: "ready", info }))
      .catch((e) =>
        setState({
          kind: "invalid",
          message: e instanceof ApiError ? e.message : "No pudimos abrir la verificación. Revisa tu conexión e intenta de nuevo.",
        }),
      );
  }, [token]);

  if (state.kind === "loading") {
    return (
      <div className="flex justify-center py-16 text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (state.kind === "invalid") {
    return (
      <Card icon={<XCircle className="h-10 w-10 text-zinc-400" />} title="No pudimos abrir la verificación">
        {state.message}
      </Card>
    );
  }
  if (state.kind === "done") {
    return (
      <Card icon={<CheckCircle2 className="h-10 w-10 text-emerald-600" />} title="¡Listo! Ya puedes cerrar esta página">
        Vuelve al computador: ahí verás el resultado y podrás terminar tu solicitud.
      </Card>
    );
  }

  const { info } = state;
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-500">{info.form.title}</p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900">{info.field.label}</h1>
        {info.field.help && <p className="mt-1 text-sm text-zinc-600">{info.field.help}</p>}
      </div>
      <LivenessCamera
        disabled={info.attemptsLeft === 0}
        start={() => phone.challenge(token)}
        finish={(id, frames) => phone.finish(token, id, frames)}
        onResult={(r) => r.completed && setState({ kind: "done" })}
      />
      {info.attemptsLeft === 0 && <p className="text-sm text-red-700">No te quedan intentos.</p>}
    </div>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-zinc-200 bg-white px-6 py-10 text-center">
      {icon}
      <h1 className="text-lg font-semibold text-zinc-900">{title}</h1>
      <p className="text-sm text-zinc-600">{children}</p>
    </div>
  );
}
