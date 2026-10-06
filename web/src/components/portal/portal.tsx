"use client";

import { AlertTriangle, Check, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FieldInput } from "@/components/form-renderer";
import { FileField } from "@/components/portal/file-field";
import { Button } from "@/components/ui";
import { SignatureView } from "@/components/signature-pad";
import { evaluate, formatAnswer, hasAnswer, validateAnswer, type Answers, type Field, type FormSchema, type Section } from "@/lib/form-schema";
import { ApiError, portal, statusLabel, type Errors, type ReviewComment, type SubmissionView, type UploadedFile } from "@/lib/portal-api";
import { cn, formatDate } from "@/lib/utils";

type SaveState = "idle" | "saving" | "saved" | "error";

/** Applicant view of one submission: multi-step form with autosave, uploads, review and submit. */
export function Portal({ token }: { token: string }) {
  const [view, setView] = useState<SubmissionView | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [save, setSave] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [justSubmitted, setJustSubmitted] = useState(false);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const top = useRef<HTMLDivElement>(null);
  // Latest answers for the debounced save, without re-creating callbacks on every keystroke.
  const answersRef = useRef<Answers>({});

  const load = useCallback(async () => {
    try {
      const v = await portal.get(token);
      setView(v);
      answersRef.current = v.data ?? {};
      setAnswers(answersRef.current);
      setFiles(v.files);
      setSavedAt(v.updatedAt);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e : new ApiError(0, "No pudimos cargar tu solicitud."));
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    void load();
  }, [load]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current) return true;
    dirty.current = false;
    setSave("saving");
    try {
      const res = await portal.save(token, answersRef.current);
      setSavedAt(res.savedAt);
      setSave("saved");
      return true;
    } catch {
      dirty.current = true;
      setSave("error");
      return false;
    }
  }, [token]);

  // Save on leaving the page if there are pending changes.
  useEffect(() => {
    const onHide = () => {
      if (dirty.current) void flush();
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [flush]);

  const setAnswer = (key: string, v: unknown) => {
    answersRef.current = { ...answersRef.current, [key]: v };
    setAnswers(answersRef.current);
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(next)) if (k === key || k.startsWith(`${key}.`)) delete next[k];
      return next;
    });
    dirty.current = true;
    setSave("idle");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 800);
  };

  const fileCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of files) c[f.fieldKey] = (c[f.fieldKey] ?? 0) + 1;
    return c;
  }, [files]);

  if (loadError) return <LoadErrorCard error={loadError} />;
  if (!view) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-zinc-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando tu solicitud…
      </div>
    );
  }

  const schema = view.schema;
  const sections = schema.sections.filter((s) => evaluate(s.showIf, answers));

  if (!view.canEdit || justSubmitted) {
    return (
      <div className="space-y-6">
        <StatusCard view={view} justSubmitted={justSubmitted} />
        <Summary schema={schema} answers={answers} files={files} />
      </div>
    );
  }

  const reviewStep = sections.length;
  const current = Math.min(step, reviewStep);
  const section = sections[current] as Section | undefined;
  const editable = (key: string) => view.editableFields === null || view.editableFields.includes(key);
  const commentsFor = (key: string) => view.comments.filter((c) => c.fieldKey?.split(".")[0] === key);
  const generalComments = view.comments.filter((c) => !c.fieldKey);

  const goTo = (i: number) => {
    void flush();
    setStep(i);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const next = () => {
    if (!section) return;
    const errs = validateSection(section, answers, fileCounts);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      document.getElementById(`f-${Object.keys(errs)[0]}`)?.focus();
      return;
    }
    goTo(current + 1);
  };

  const submit = async () => {
    setSubmitError("");
    const all: Errors = {};
    for (const s of sections) Object.assign(all, validateSection(s, answers, fileCounts));
    if (Object.keys(all).length > 0) {
      setErrors(all);
      jumpToFirstError(all);
      return;
    }
    setSubmitting(true);
    try {
      if (timer.current) clearTimeout(timer.current);
      dirty.current = false;
      await portal.submit(token, answers);
      setJustSubmitted(true);
      await load();
      top.current?.scrollIntoView({ behavior: "smooth" });
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.errors).length > 0) {
        setErrors(e.errors);
        jumpToFirstError(e.errors);
      } else {
        setSubmitError(e instanceof ApiError ? e.message : "No pudimos enviar tu solicitud.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const jumpToFirstError = (errs: Errors) => {
    const first = Object.keys(errs)[0].split(".")[0];
    const idx = sections.findIndex((s) => s.fields.some((f) => f.key === first));
    if (idx >= 0) goTo(idx);
  };

  const progress = Math.round((current / Math.max(reviewStep, 1)) * 100);

  return (
    <div ref={top} className="scroll-mt-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{view.form.title}</h1>
        {view.form.description && <p className="text-sm text-zinc-600">{view.form.description}</p>}
      </header>

      {view.status === "changes_requested" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" /> Revisamos tu solicitud y necesitamos algunas correcciones.
          </p>
          <p className="mt-1">
            {view.editableFields
              ? "Solo puedes modificar los campos marcados. Cuando termines, vuelve a enviarla."
              : "Corrige lo que se indica y vuelve a enviarla."}
          </p>
          {generalComments.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {generalComments.map((c) => (
                <li key={c.id}>{c.body}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Stepper sections={sections} current={current} onPick={(i) => i < current && goTo(i)} />
      <div className="h-1.5 rounded-full bg-zinc-200" aria-hidden>
        <div className="h-1.5 rounded-full bg-zinc-900 transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        {section ? (
          <>
            <div className="mb-5">
              <h2 className="text-lg font-semibold">{section.title}</h2>
              {section.description && <p className="mt-1 text-sm text-zinc-600">{section.description}</p>}
            </div>
            <div className="space-y-5">
              {section.fields
                .filter((f) => evaluate(f.showIf, answers))
                .map((f) => {
                  const locked = !editable(f.key);
                  const notes = commentsFor(f.key);
                  return (
                    <div
                      key={f.key}
                      className={cn(notes.length > 0 && "-mx-3 rounded-md border-l-4 border-amber-400 bg-amber-50/60 px-3 py-2", locked && "opacity-70")}
                    >
                      <FieldInput
                        field={f}
                        value={answers[f.key]}
                        onChange={(v) => setAnswer(f.key, v)}
                        error={errors[f.key]}
                        errors={errors}
                        errorPrefix={f.key}
                        disabled={locked}
                        note={notes.length > 0 && <ReviewerNotes comments={notes} />}
                        renderFile={(field, path) => (
                          <FileField
                            token={token}
                            field={field}
                            path={path}
                            disabled={locked}
                            files={files.filter((x) => x.fieldKey === path)}
                            onUploaded={(nf) => {
                              setFiles((fs) => [...fs, nf]);
                              setErrors((e) => ({ ...e, [path]: "" }));
                            }}
                            onDeleted={(id) => setFiles((fs) => fs.filter((x) => x.id !== id))}
                          />
                        )}
                      />
                    </div>
                  );
                })}
            </div>
          </>
        ) : (
          <div>
            <h2 className="mb-1 text-lg font-semibold">Revisa y envía</h2>
            <p className="mb-5 text-sm text-zinc-600">Confirma que todo esté correcto. Después de enviar no podrás editar salvo que te pidamos correcciones.</p>
            <Summary schema={schema} answers={answers} files={files} onEdit={(i) => goTo(i)} sections={sections} />
            {submitError && <p className="mt-4 text-sm text-red-600">{submitError}</p>}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-zinc-200 pt-4">
          <Button disabled={current === 0} onClick={() => goTo(current - 1)}>
            Atrás
          </Button>
          <SaveIndicator state={save} savedAt={savedAt} onRetry={() => void flush()} />
          {section ? (
            <Button variant="primary" onClick={next}>
              Siguiente
            </Button>
          ) : (
            <Button variant="primary" onClick={submit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {view.status === "changes_requested" ? "Reenviar solicitud" : "Enviar solicitud"}
            </Button>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-zinc-500">
        Tus respuestas se guardan solas. Guarda el enlace de esta página para continuar después, o{" "}
        <Link href="/retomar" className="underline">
          pide uno nuevo con tu email
        </Link>
        .
      </p>
    </div>
  );
}

/** Same rules as the API (api/internal/schema/answers.go), with real file counts. */
export function validateSection(section: Section, answers: Answers, files: Record<string, number>): Errors {
  const errs: Errors = {};
  const check = (f: Field, v: unknown, path: string) => {
    let msg: string | null;
    if (f.type === "file") msg = f.required && !files[path] ? "Adjunta un archivo" : null;
    else if (f.type === "repeater" && (!Array.isArray(v) || v.length === 0) && (f.min ?? 0) > 0)
      msg = `Agrega al menos ${f.min}`;
    else if (f.type === "select" && typeof v === "string" && v !== "" && !f.options?.includes(v)) msg = "Opción no válida";
    else if (f.type === "date" && typeof v === "string" && v !== "" && Number.isNaN(Date.parse(v))) msg = "Fecha no válida";
    else msg = validateAnswer(f, v);
    if (msg) errs[path] = msg;
  };
  if (!evaluate(section.showIf, answers)) return errs;
  for (const f of section.fields) {
    if (!evaluate(f.showIf, answers)) continue;
    check(f, answers[f.key], f.key);
    if (f.type === "repeater" && Array.isArray(answers[f.key])) {
      (answers[f.key] as Answers[]).forEach((row, i) =>
        f.fields?.forEach((sf) => check(sf, row?.[sf.key], `${f.key}.${i}.${sf.key}`)),
      );
    }
  }
  return errs;
}

function Stepper({ sections, current, onPick }: { sections: Section[]; current: number; onPick: (i: number) => void }) {
  const items = [...sections.map((s) => s.title), "Revisión"];
  return (
    <ol className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
      {items.map((title, i) => (
        <li key={i}>
          <button
            type="button"
            onClick={() => onPick(i)}
            disabled={i >= current}
            className={cn(
              "flex items-center gap-2 disabled:cursor-default",
              i === current ? "font-medium text-zinc-900" : i < current ? "text-zinc-600 hover:text-zinc-900" : "text-zinc-400",
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border text-xs",
                i < current ? "border-zinc-900 bg-zinc-900 text-white" : i === current ? "border-zinc-900" : "border-zinc-300",
              )}
            >
              {i < current ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            {title}
          </button>
        </li>
      ))}
    </ol>
  );
}

function SaveIndicator({ state, savedAt, onRetry }: { state: SaveState; savedAt: string | null; onRetry: () => void }) {
  if (state === "saving") return <span className="text-xs text-zinc-500">Guardando…</span>;
  if (state === "error")
    return (
      <button type="button" onClick={onRetry} className="text-xs text-red-600 underline">
        No se pudo guardar. Reintentar
      </button>
    );
  if (savedAt) return <span className="text-xs text-zinc-500">Guardado {formatDate(savedAt)}</span>;
  return <span />;
}

function ReviewerNotes({ comments }: { comments: ReviewComment[] }) {
  return (
    <div className="mt-2 space-y-1">
      {comments.map((c) => (
        <p key={c.id} className="flex gap-1.5 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {c.body}
        </p>
      ))}
    </div>
  );
}

function display(f: Field, v: unknown): ReactNode {
  if (f.type === "signature" && typeof v === "string" && v) return <SignatureView path={v} className="max-w-60 text-zinc-900" />;
  return formatAnswer(f, v) || "—";
}

function Summary({
  schema,
  answers,
  files,
  sections,
  onEdit,
}: {
  schema: FormSchema;
  answers: Answers;
  files: UploadedFile[];
  sections?: Section[];
  onEdit?: (i: number) => void;
}) {
  const list = sections ?? schema.sections.filter((s) => evaluate(s.showIf, answers));
  const fileNames = (path: string) => files.filter((f) => f.fieldKey === path).map((f) => f.filename).join(", ") || "—";
  const value = (f: Field, v: unknown, path: string): ReactNode => (f.type === "file" ? fileNames(path) : display(f, v));

  return (
    <div className="space-y-4">
      {list.map((s, i) => (
        <section key={s.key} className="rounded-lg border border-zinc-200 bg-white">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5">
            <h3 className="text-sm font-semibold">{s.title}</h3>
            {onEdit && (
              <Button size="sm" variant="ghost" onClick={() => onEdit(i)}>
                Editar
              </Button>
            )}
          </div>
          <dl className="divide-y divide-zinc-100 text-sm">
            {s.fields
              .filter((f) => hasAnswer(f.type) && evaluate(f.showIf, answers))
              .map((f) =>
                f.type === "repeater" ? (
                  <div key={f.key} className="px-4 py-2.5">
                    <dt className="text-zinc-500">{f.label}</dt>
                    <dd className="mt-1 space-y-2">
                      {Array.isArray(answers[f.key]) && (answers[f.key] as Answers[]).length > 0
                        ? (answers[f.key] as Answers[]).map((row, j) => (
                            <div key={j} className="rounded border border-zinc-100 bg-zinc-50 px-3 py-2">
                              {f.fields?.map((sf) => (
                                <div key={sf.key} className="flex gap-2">
                                  <span className="text-zinc-500">{sf.label}:</span>
                                  <span>{value(sf, row?.[sf.key], `${f.key}.${j}.${sf.key}`)}</span>
                                </div>
                              ))}
                            </div>
                          ))
                        : "—"}
                    </dd>
                  </div>
                ) : (
                  <div key={f.key} className="grid gap-1 px-4 py-2.5 sm:grid-cols-3">
                    <dt className="text-zinc-500">{f.label}</dt>
                    <dd className="break-words sm:col-span-2">{value(f, answers[f.key], f.key)}</dd>
                  </div>
                ),
              )}
          </dl>
        </section>
      ))}
    </div>
  );
}

const STATUS_COPY: Record<string, { icon: typeof Clock; tone: string; title: string; body: string }> = {
  submitted: {
    icon: CheckCircle2,
    tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
    title: "Recibimos tu solicitud",
    body: "Te enviamos un email de confirmación. Nuestro equipo la revisará y te avisaremos por email.",
  },
  in_review: {
    icon: Clock,
    tone: "border-sky-200 bg-sky-50 text-sky-900",
    title: "Tu solicitud está en revisión",
    body: "Te avisaremos por email cuando haya novedades.",
  },
  approved: {
    icon: CheckCircle2,
    tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
    title: "Tu solicitud fue aprobada",
    body: "Pronto nos pondremos en contacto contigo con los siguientes pasos.",
  },
  rejected: {
    icon: XCircle,
    tone: "border-red-200 bg-red-50 text-red-900",
    title: "Tu solicitud no fue aprobada",
    body: "Si tienes dudas, responde al email que recibiste.",
  },
};

function StatusCard({ view, justSubmitted }: { view: SubmissionView; justSubmitted: boolean }) {
  const copy = STATUS_COPY[view.status] ?? STATUS_COPY.submitted;
  const Icon = copy.icon;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{view.form.title}</h1>
      <div className={cn("rounded-lg border p-5", copy.tone)}>
        <p className="flex items-center gap-2 text-base font-semibold">
          <Icon className="h-5 w-5" />
          {justSubmitted && view.status === "submitted" ? "¡Listo! " : ""}
          {copy.title}
        </p>
        <p className="mt-1 text-sm">{copy.body}</p>
        <p className="mt-3 text-xs opacity-80">
          Estado: {statusLabel[view.status]}
          {view.submittedAt && ` · Enviada el ${formatDate(view.submittedAt)}`}
        </p>
      </div>
      <h2 className="pt-2 text-sm font-semibold text-zinc-700">Lo que enviaste</h2>
    </div>
  );
}

function LoadErrorCard({ error }: { error: ApiError }) {
  return (
    <div className="mx-auto max-w-md rounded-lg border border-zinc-200 bg-white p-6 text-center shadow-sm">
      <h1 className="text-lg font-semibold">{error.status === 401 ? "Este enlace ya no es válido" : "No pudimos abrir tu solicitud"}</h1>
      <p className="mt-2 text-sm text-zinc-600">
        {error.status === 401
          ? "Puede que hayas pedido un enlace nuevo. Usa el más reciente que te enviamos o pide otro."
          : error.message}
      </p>
      <Link
        href="/retomar"
        className="mt-4 inline-flex h-9 items-center rounded-md bg-zinc-900 px-3.5 text-sm font-medium text-white hover:bg-zinc-700"
      >
        Pedir un enlace nuevo
      </Link>
    </div>
  );
}
