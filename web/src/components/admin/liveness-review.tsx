"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { formatDate, type LivenessRow } from "@/lib/admin";

const DECISION: Record<LivenessRow["decision"], { label: string; className: string; help: string }> = {
  pass: { label: "Persona real", className: "bg-emerald-100 text-emerald-800", help: "Siguió el desafío y el análisis de textura indica una cara real." },
  review: {
    label: "Revisar",
    className: "bg-amber-100 text-amber-800",
    help: "Siguió el desafío, pero el análisis de textura quedó en zona gris. Mira los fotogramas antes de aprobar.",
  },
  fail: { label: "Sospechoso", className: "bg-rose-100 text-rose-800", help: "Parece una foto o una pantalla, o cambió la persona durante el desafío." },
  retry: { label: "Incompleto", className: "bg-zinc-100 text-zinc-700", help: "No se pudo verificar (sin cara, poca luz o no siguió una instrucción)." },
  expired: { label: "Expirado", className: "bg-zinc-100 text-zinc-700", help: "Se acabó el tiempo antes de enviar los fotogramas." },
  error: { label: "Error", className: "bg-zinc-100 text-zinc-700", help: "El servicio de verificación no respondió." },
};

const REASON: Record<string, string> = {
  no_face: "No se vio una cara",
  multiple_faces: "Más de una persona en la imagen",
  face_too_small: "Cara muy lejos de la cámara",
  too_dark: "Poca luz",
  too_bright: "Demasiada luz o contraluz",
  blurry: "Imagen borrosa",
  challenge_not_completed: "No siguió alguna instrucción",
  spoof_suspected: "Parece una foto impresa o una pantalla",
  passive_uncertain: "Análisis de textura no concluyente",
  face_changed: "Cambió la persona durante el desafío",
};

const STEP: Record<string, string> = {
  center: "De frente",
  left: "Gira a su izquierda",
  right: "Gira a su derecha",
  closer: "Se acerca",
};

const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${Math.round(v * 100)}%`);

/** Liveness attempts of one field, newest first; the latest completed one is open by default. */
export function LivenessReview({ attempts }: { attempts: LivenessRow[] }) {
  const { id: submissionId } = useParams<{ id: string }>();
  if (attempts.length === 0) return <span className="text-zinc-400">Sin verificación</span>;
  const sorted = [...attempts].reverse();
  const main = sorted.find((a) => a.decision === "pass" || a.decision === "review") ?? sorted[0];
  const others = sorted.filter((a) => a !== main);
  return (
    <div className="flex flex-col gap-3">
      <Attempt submissionId={submissionId} attempt={main} />
      {others.length > 0 && (
        <details className="text-xs text-zinc-500">
          <summary className="cursor-pointer">Otros intentos ({others.length})</summary>
          <div className="mt-3 flex flex-col gap-4">
            {others.map((a) => (
              <Attempt key={a.id} submissionId={submissionId} attempt={a} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function Attempt({ submissionId, attempt: a }: { submissionId: string; attempt: LivenessRow }) {
  const [zoom, setZoom] = useState<number | null>(null);
  const d = DECISION[a.decision];
  const frameUrl = (n: number) => `/api/v1/admin/submissions/${submissionId}/liveness/${a.id}/frames/${n}`;
  const stepResults = a.result?.steps ?? [];
  const frames = a.result?.frames ?? [];
  // One representative frame per step: the one that met the step, else the first taken.
  const shown = a.steps.map((step, i) => {
    const hit = stepResults.find((s) => s.index === i)?.frame;
    const first = a.frame_steps.findIndex((s) => s === i);
    return { step, ok: stepResults.find((s) => s.index === i)?.ok ?? false, frame: hit ?? (first >= 0 ? first : null) };
  });

  return (
    <div className="flex flex-col gap-2 text-sm text-zinc-800">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${d.className}`}>{d.label}</span>
        <span className="text-xs text-zinc-500">{formatDate(a.completed_at ?? a.created_at)}</span>
      </div>
      <p className="text-xs text-zinc-600">{d.help}</p>
      {a.reasons.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-zinc-600">
          {a.reasons.map((r) => (
            <li key={r}>{REASON[r] ?? r}</li>
          ))}
        </ul>
      )}
      {a.frame_steps.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:max-w-md">
          {shown.map((s, i) => (
            <figure key={i} className="flex flex-col gap-1">
              {s.frame !== null ? (
                <button type="button" onClick={() => setZoom(s.frame)} className="overflow-hidden rounded border border-zinc-200">
                  {/* eslint-disable-next-line @next/next/no-img-element -- authenticated API image */}
                  <img src={frameUrl(s.frame)} alt={`Paso ${i + 1}: ${STEP[s.step] ?? s.step}`} className="aspect-[3/4] w-full -scale-x-100 object-cover" />
                </button>
              ) : (
                <div className="grid aspect-[3/4] place-items-center rounded border border-dashed border-zinc-200 text-xs text-zinc-400">Sin imagen</div>
              )}
              <figcaption className="text-xs">
                <span className={s.ok ? "text-emerald-700" : "text-rose-700"}>{s.ok ? "✓" : "✗"}</span> {STEP[s.step] ?? s.step}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      {a.result?.scores && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:max-w-md">
          <dt className="text-zinc-500">Textura de piel real</dt>
          <dd>{pct(a.result.scores.passive)}</dd>
          <dt className="text-zinc-500">Misma persona en todo el desafío</dt>
          <dd>{pct(a.result.scores.consistency)}</dd>
          <dt className="text-zinc-500">Fotogramas</dt>
          <dd>
            {frames.filter((f) => f.issues.length === 0).length} útiles de {a.frame_steps.length}
          </dd>
        </dl>
      )}
      {zoom !== null && (
        <div role="dialog" aria-modal className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setZoom(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- authenticated API image */}
          <img src={frameUrl(zoom)} alt="Fotograma ampliado" className="max-h-[85vh] -scale-x-100 rounded-lg" />
        </div>
      )}
    </div>
  );
}
