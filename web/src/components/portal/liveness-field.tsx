"use client";

import { ArrowLeft, ArrowRight, Camera, CheckCircle2, Loader2, ScanFace, ZoomIn } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui";
import type { Field } from "@/lib/form-schema";
import {
  ApiError,
  livenessCompleted,
  portal,
  type LivenessAttempt,
  type LivenessResult,
  type LivenessStep,
} from "@/lib/portal-api";
import { cn } from "@/lib/utils";

/** What the applicant is asked to do on each step. The preview is mirrored, so "your left" moves left on screen. */
const STEP_TEXT: Record<LivenessStep, { text: string; icon: ReactNode }> = {
  center: { text: "Mira de frente a la cámara", icon: <ScanFace className="h-6 w-6" /> },
  left: { text: "Gira la cabeza hacia tu izquierda", icon: <ArrowLeft className="h-6 w-6" /> },
  right: { text: "Gira la cabeza hacia tu derecha", icon: <ArrowRight className="h-6 w-6" /> },
  closer: { text: "Acerca tu cara a la cámara", icon: <ZoomIn className="h-6 w-6" /> },
};

/** Messages for the applicant. Signs of a spoof get a neutral message on purpose. */
const REASON_TEXT: Record<string, string> = {
  no_face: "No vimos tu cara. Ubícala dentro del óvalo.",
  multiple_faces: "Vimos a más de una persona. Asegúrate de estar solo frente a la cámara.",
  face_too_small: "Tu cara se ve muy lejos. Acércate un poco a la cámara.",
  too_dark: "Hay poca luz. Busca un lugar más iluminado.",
  too_bright: "Hay demasiada luz detrás o sobre ti. Evita los contraluces.",
  blurry: "La imagen salió borrosa. Mantén la cámara quieta.",
  challenge_not_completed: "No alcanzamos a ver el movimiento que pedimos. Hazlo con calma cuando aparezca cada instrucción.",
};
const GENERIC_RETRY = "No pudimos confirmar la verificación. Inténtalo de nuevo de frente a la cámara y con buena luz.";

// Time to react to each instruction before frames are taken.
const REACTION_MS = 900;
const MAX_WIDTH = 640;

type Phase =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "running"; step: LivenessStep; index: number; total: number }
  | { kind: "checking" }
  | { kind: "failed"; message: string; attemptsLeft?: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Liveness field of the filling portal: opens the front camera, walks the applicant through a
 * random challenge from the server, takes a few frames per step and sends them to be checked.
 */
export function LivenessField({
  token,
  field,
  attempts,
  disabled,
  onFinished,
}: {
  token: string;
  field: Field;
  attempts: LivenessAttempt[];
  disabled?: boolean;
  onFinished: (attempt: LivenessAttempt) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const done = attempts.some((a) => livenessCompleted(a.decision));

  const stopCamera = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };
  useEffect(() => stopCamera, []);

  const capture = (): Promise<Blob | null> => {
    const v = video.current;
    if (!v || !v.videoWidth) return Promise.resolve(null);
    const scale = Math.min(1, MAX_WIDTH / v.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    // Unmirrored: the server expects what the camera sees.
    canvas.getContext("2d")?.drawImage(v, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  };

  const run = async () => {
    setPhase({ kind: "starting" });
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
    } catch {
      setPhase({ kind: "failed", message: "No pudimos acceder a tu cámara. Revisa que el navegador tenga permiso para usarla." });
      return;
    }
    const v = video.current;
    if (v) {
      v.srcObject = stream.current;
      await v.play().catch(() => undefined);
      // Let exposure settle before the challenge starts.
      await sleep(800);
    }

    let result: LivenessResult;
    try {
      const ch = await portal.livenessChallenge(token, field.key);
      const frames: { step: number; blob: Blob }[] = [];
      const gap = (ch.stepMs - REACTION_MS) / ch.framesPerStep;
      for (let i = 0; i < ch.steps.length; i++) {
        setPhase({ kind: "running", step: ch.steps[i], index: i, total: ch.steps.length });
        await sleep(REACTION_MS);
        for (let k = 0; k < ch.framesPerStep; k++) {
          const blob = await capture();
          if (blob) frames.push({ step: i, blob });
          await sleep(gap);
        }
      }
      stopCamera();
      setPhase({ kind: "checking" });
      result = await portal.livenessFinish(token, ch.id, frames);
    } catch (e) {
      stopCamera();
      setPhase({ kind: "failed", message: e instanceof ApiError ? e.message : "No pudimos verificar ahora. Intenta de nuevo." });
      return;
    }

    onFinished({ id: result.id, fieldKey: result.fieldKey, decision: result.decision, reasons: result.reasons, completedAt: new Date().toISOString() });
    if (result.completed) {
      setPhase({ kind: "idle" });
    } else {
      const message =
        result.decision === "retry" ? REASON_TEXT[result.reasons[0]] ?? GENERIC_RETRY : GENERIC_RETRY;
      setPhase({ kind: "failed", message, attemptsLeft: result.attemptsLeft });
    }
  };

  const active = phase.kind === "starting" || phase.kind === "running" || phase.kind === "checking";

  if (done && !active) {
    return (
      <div id={`f-${field.key}`} tabIndex={-1} className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
        <CheckCircle2 className="h-4 w-4" /> Verificación completada
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "relative mx-auto aspect-[3/4] w-full max-w-xs overflow-hidden rounded-xl bg-zinc-900",
          !active && "hidden",
        )}
      >
        <video ref={video} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
        {/* Oval guide */}
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[62%] w-[66%] rounded-[50%] border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>
        <div aria-live="assertive" className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-10 text-center text-white">
          {phase.kind === "starting" && <p className="text-sm">Preparando la cámara…</p>}
          {phase.kind === "running" && (
            <>
              <p className="flex items-center justify-center gap-2 text-base font-semibold">
                {STEP_TEXT[phase.step].icon}
                {STEP_TEXT[phase.step].text}
              </p>
              <p className="mt-1 text-xs text-white/70">
                Paso {phase.index + 1} de {phase.total}
              </p>
            </>
          )}
          {phase.kind === "checking" && (
            <p className="flex items-center justify-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Verificando…
            </p>
          )}
        </div>
      </div>

      {!active && (
        <div id={`f-${field.key}`} tabIndex={-1} className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm">
          {phase.kind === "failed" ? (
            <p className="mb-3 text-red-700">
              {phase.message}
              {phase.attemptsLeft !== undefined && (
                <span className="block text-xs text-zinc-500">
                  {phase.attemptsLeft > 0 ? `Te quedan ${phase.attemptsLeft} intentos.` : "No te quedan intentos."}
                </span>
              )}
            </p>
          ) : (
            <ul className="mb-3 list-disc space-y-0.5 pl-5 text-zinc-600">
              <li>Busca un lugar con buena luz, sin contraluz.</li>
              <li>Quítate lentes de sol, gorro o mascarilla.</li>
              <li>Sigue las instrucciones que aparecen en pantalla. Toma unos 10 segundos.</li>
            </ul>
          )}
          <Button variant="primary" onClick={run} disabled={disabled || (phase.kind === "failed" && phase.attemptsLeft === 0)}>
            <Camera className="h-4 w-4" />
            {phase.kind === "failed" ? "Intentar de nuevo" : "Iniciar verificación"}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Builder preview: shows what the applicant will see without opening the camera. */
export function LivenessPreview() {
  return (
    <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
      <p className="flex items-center gap-2 font-medium text-zinc-800">
        <Camera className="h-4 w-4" /> Verificación con cámara
      </p>
      <p className="mt-1">
        En el formulario real, el solicitante abre su cámara y sigue unas instrucciones al azar (mirar de frente, girar la
        cabeza, acercarse). Así confirmamos que es una persona real y no una foto.
      </p>
    </div>
  );
}
