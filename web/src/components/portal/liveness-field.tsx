"use client";

import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  Copy,
  Loader2,
  ScanFace,
  Smartphone,
  ZoomIn,
} from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/ui";
import type { Field } from "@/lib/form-schema";
import {
  ApiError,
  livenessCompleted,
  portal,
  type CapturedFrame,
  type HandoffStatus,
  type LivenessAttempt,
  type LivenessChallenge,
  type LivenessHandoff,
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

export const retryMessage = (a: { decision: string; reasons: string[] }) =>
  a.decision === "retry" ? (REASON_TEXT[a.reasons[0]] ?? GENERIC_RETRY) : GENERIC_RETRY;

// Time to react to each instruction before frames are taken.
const REACTION_MS = 900;
const MAX_WIDTH = 640;
const POLL_MS = 2000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Phones and tablets take the check here; computers hand it off to a phone with a QR. */
function isHandheld() {
  const nav = navigator as Navigator & { userAgentData?: { mobile: boolean } };
  if (nav.userAgentData?.mobile) return true;
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent)) return true;
  // iPadOS reports itself as a Mac.
  return /Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1;
}
const noSubscribe = () => () => {};
/** null while rendering on the server. */
function useHandheld(): boolean | null {
  return useSyncExternalStore(noSubscribe, isHandheld, () => null);
}

type Phase =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "running"; step: LivenessStep; index: number; total: number }
  | { kind: "checking" }
  | { kind: "failed"; message: string; attemptsLeft?: number };

/**
 * The camera part of a liveness check: opens the front camera, walks the person through a random
 * challenge from the server, takes a few frames per step and sends them to be checked.
 */
export function LivenessCamera({
  start,
  finish,
  disabled,
  onResult,
  idleExtra,
}: {
  start: () => Promise<LivenessChallenge>;
  finish: (id: string, frames: CapturedFrame[]) => Promise<LivenessResult>;
  disabled?: boolean;
  onResult: (result: LivenessResult) => void;
  /** Shown under the start button, e.g. a way to switch to the phone. */
  idleExtra?: ReactNode;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

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
      const ch = await start();
      const frames: CapturedFrame[] = [];
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
      result = await finish(ch.id, frames);
    } catch (e) {
      stopCamera();
      setPhase({ kind: "failed", message: e instanceof ApiError ? e.message : "No pudimos verificar ahora. Intenta de nuevo." });
      return;
    }

    onResult(result);
    if (result.completed) setPhase({ kind: "idle" });
    else setPhase({ kind: "failed", message: retryMessage(result), attemptsLeft: result.attemptsLeft });
  };

  const active = phase.kind === "starting" || phase.kind === "running" || phase.kind === "checking";

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
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm">
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
          {idleExtra}
        </div>
      )}
    </div>
  );
}

/**
 * Liveness field of the filling portal. On a phone or tablet the camera opens right here; on a
 * computer the applicant scans a QR and takes the check on their phone while this page waits.
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
  const handheld = useHandheld();
  const [useThisComputer, setUseThisComputer] = useState(false);
  const done = attempts.some((a) => livenessCompleted(a.decision));

  if (done) {
    return (
      <div id={`f-${field.key}`} tabIndex={-1} className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
        <CheckCircle2 className="h-4 w-4" /> Verificación completada
      </div>
    );
  }
  if (handheld === null) return <div id={`f-${field.key}`} tabIndex={-1} className="h-24 rounded-md border border-zinc-200 bg-zinc-50" />;

  if (handheld || useThisComputer) {
    return (
      <div id={`f-${field.key}`} tabIndex={-1}>
        <LivenessCamera
          disabled={disabled}
          start={() => portal.livenessChallenge(token, field.key)}
          finish={(id, frames) => portal.livenessFinish(token, id, frames)}
          onResult={(r) =>
            onFinished({ id: r.id, fieldKey: r.fieldKey, decision: r.decision, reasons: r.reasons, completedAt: new Date().toISOString() })
          }
          idleExtra={
            !handheld && (
              <button type="button" onClick={() => setUseThisComputer(false)} className="mt-3 block text-xs text-zinc-500 underline">
                Mejor uso mi celular
              </button>
            )
          }
        />
      </div>
    );
  }
  return (
    <PhoneHandoff
      token={token}
      field={field}
      disabled={disabled}
      onFinished={onFinished}
      onUseThisComputer={() => setUseThisComputer(true)}
    />
  );
}

type Handoff = LivenessHandoff & { qr: string };

/** Computer side: shows the QR and follows what the phone does until the check completes. */
function PhoneHandoff({
  token,
  field,
  disabled,
  onFinished,
  onUseThisComputer,
}: {
  token: string;
  field: Field;
  disabled?: boolean;
  onFinished: (attempt: LivenessAttempt) => void;
  onUseThisComputer: () => void;
}) {
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [status, setStatus] = useState<HandoffStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  // Latest callback without restarting the polling loop.
  const finished = useRef(onFinished);
  useEffect(() => {
    finished.current = onFinished;
  });

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const h = await portal.livenessHandoff(token, field.key);
      const qr = await QRCode.toDataURL(h.url, { margin: 1, width: 480, errorCorrectionLevel: "M" });
      setStatus(null);
      setHandoff({ ...h, qr });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No pudimos generar el código. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!handoff) return;
    let stop = false;
    const seen = new Set<string>();
    const poll = async () => {
      while (!stop) {
        try {
          const st = await portal.handoffStatus(token, handoff.id);
          if (stop) return;
          setStatus(st);
          for (const a of st.attempts) {
            if (seen.has(a.id)) continue;
            seen.add(a.id);
            finished.current(a);
          }
          if (st.expired) return;
        } catch {
          // Keep polling through brief network errors.
        }
        await sleep(POLL_MS);
      }
    };
    poll();
    return () => {
      stop = true;
    };
  }, [handoff, token]);

  const copy = async () => {
    if (!handoff) return;
    try {
      await navigator.clipboard.writeText(handoff.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the QR still works.
    }
  };

  const last = status?.attempts.at(-1);
  const outOfAttempts = status?.attemptsLeft === 0 && !status.checking;

  return (
    <div id={`f-${field.key}`} tabIndex={-1} className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm">
      {!handoff ? (
        <>
          <p className="flex items-center gap-2 font-medium text-zinc-900">
            <Smartphone className="h-4 w-4" /> Continúa en tu celular
          </p>
          <p className="mt-1 text-zinc-600">
            La verificación se hace con la cámara frontal de tu celular. Te mostraremos un código QR para abrirla allí; esta
            página se actualiza sola cuando termines.
          </p>
          {error && <p className="mt-2 text-red-700">{error}</p>}
          <Button variant="primary" className="mt-3" onClick={create} disabled={disabled || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
            Mostrar código QR
          </Button>
        </>
      ) : status?.expired ? (
        <>
          <p className="text-zinc-700">El código venció. Genera otro para seguir desde tu celular.</p>
          {error && <p className="mt-2 text-red-700">{error}</p>}
          <Button variant="primary" className="mt-3" onClick={create} disabled={disabled || busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Generar otro código
          </Button>
        </>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
          <img
            src={handoff.qr}
            alt="Código QR para abrir la verificación en tu celular"
            className={cn("h-48 w-48 rounded-lg border border-zinc-200 bg-white p-2", status?.openedAt && "opacity-30")}
          />
          <div aria-live="polite" className="flex-1 space-y-2">
            {status?.checking ? (
              <p className="flex items-center gap-2 font-medium text-zinc-900">
                <Loader2 className="h-4 w-4 animate-spin" /> Verificando en tu celular…
              </p>
            ) : last ? (
              <>
                <p className="text-red-700">{retryMessage(last)}</p>
                <p className="text-zinc-600">
                  {outOfAttempts ? "No te quedan intentos." : "Vuelve a intentarlo desde tu celular, ahí verás el botón para reintentar."}
                </p>
              </>
            ) : status?.openedAt ? (
              <p className="flex items-center gap-2 font-medium text-zinc-900">
                <Smartphone className="h-4 w-4" /> Celular conectado. Sigue las instrucciones en tu celular.
              </p>
            ) : (
              <>
                <p className="font-medium text-zinc-900">Escanea este código con la cámara de tu celular</p>
                <ol className="list-decimal space-y-0.5 pl-5 text-zinc-600">
                  <li>Abre la cámara de tu celular y apunta al código.</li>
                  <li>Toca el enlace que aparece y sigue las instrucciones.</li>
                  <li>Cuando termines, esta página mostrará el resultado.</li>
                </ol>
                <p className="flex items-center gap-2 text-xs text-zinc-500">
                  <Loader2 className="h-3 w-3 animate-spin" /> Esperando al celular…
                </p>
              </>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-zinc-500">
              <button type="button" onClick={copy} className="inline-flex items-center gap-1 underline">
                <Copy className="h-3 w-3" /> {copied ? "Enlace copiado" : "Copiar enlace"}
              </button>
              <button type="button" onClick={create} className="underline" disabled={busy}>
                Generar otro código
              </button>
            </div>
          </div>
        </div>
      )}
      {!handoff && (
        <button type="button" onClick={onUseThisComputer} className="mt-3 block text-xs text-zinc-500 underline">
          No tengo celular, usar la cámara de este computador
        </button>
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
        cabeza, acercarse). Así confirmamos que es una persona real y no una foto. Si llena el formulario en un computador,
        le mostramos un código QR para hacerlo con su celular.
      </p>
    </div>
  );
}
