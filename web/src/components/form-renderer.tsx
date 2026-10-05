"use client";

import { useState } from "react";
import { Button, Checkbox, Input, Select, Textarea } from "@/components/ui";
import { evaluate, validateAnswer, type Answers, type Field, type FormSchema } from "@/lib/form-schema";
import { cn } from "@/lib/utils";

/**
 * Renders a form schema as a multi-step form (one section per step), applying conditions
 * and validating each step. The builder uses it for preview; the filling portal can reuse it.
 */
export function FormRenderer({
  schema,
  onSubmit,
  submitLabel = "Enviar",
}: {
  schema: FormSchema;
  onSubmit?: (answers: Answers) => void;
  submitLabel?: string;
}) {
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  const visible = schema.sections.filter((s) => evaluate(s.showIf, answers));
  const current = visible[Math.min(step, visible.length - 1)];

  if (!current) {
    return <p className="text-sm text-zinc-500">Este formulario todavía no tiene secciones.</p>;
  }
  if (done) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-800">
        Vista previa completada. Así terminaría el solicitante.
        <Button className="ml-3" size="sm" onClick={() => { setDone(false); setStep(0); setAnswers({}); }}>
          Empezar de nuevo
        </Button>
      </div>
    );
  }

  const isLast = step >= visible.length - 1;
  const set = (key: string, v: unknown) => {
    setAnswers((a) => ({ ...a, [key]: v }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const next = () => {
    const errs: Record<string, string> = {};
    for (const f of current.fields) {
      if (!evaluate(f.showIf, answers)) continue;
      const err = validateAnswer(f, answers[f.key]);
      if (err) errs[f.key] = err;
      if (f.type === "repeater" && Array.isArray(answers[f.key])) {
        (answers[f.key] as Answers[]).forEach((row, i) =>
          f.fields?.forEach((sf) => {
            const e = validateAnswer(sf, row[sf.key]);
            if (e) errs[`${f.key}.${i}.${sf.key}`] = e;
          }),
        );
      }
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    if (isLast) {
      onSubmit?.(answers);
      setDone(true);
    } else {
      setStep(step + 1);
    }
  };

  return (
    <div className="space-y-6">
      {visible.length > 1 && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-zinc-500">
            <span>
              Paso {step + 1} de {visible.length}
            </span>
            <span>{current.title}</span>
          </div>
          <div className="h-1.5 rounded-full bg-zinc-200">
            <div
              className="h-1.5 rounded-full bg-zinc-900 transition-all"
              style={{ width: `${((step + 1) / visible.length) * 100}%` }}
            />
          </div>
        </div>
      )}
      <div>
        <h2 className="text-lg font-semibold">{current.title}</h2>
        {current.description && <p className="mt-1 text-sm text-zinc-600">{current.description}</p>}
      </div>
      <div className="space-y-5">
        {current.fields
          .filter((f) => evaluate(f.showIf, answers))
          .map((f) => (
            <FieldInput
              key={f.key}
              field={f}
              value={answers[f.key]}
              onChange={(v) => set(f.key, v)}
              error={errors[f.key]}
              errors={errors}
              errorPrefix={f.key}
            />
          ))}
      </div>
      <div className="flex justify-between border-t border-zinc-200 pt-4">
        <Button disabled={step === 0} onClick={() => setStep(step - 1)}>
          Atrás
        </Button>
        <Button variant="primary" onClick={next}>
          {isLast ? submitLabel : "Siguiente"}
        </Button>
      </div>
    </div>
  );
}

function FieldInput({
  field: f,
  value,
  onChange,
  error,
  errors,
  errorPrefix,
}: {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
  errors: Record<string, string>;
  errorPrefix: string;
}) {
  const id = `f-${errorPrefix}`;
  const str = typeof value === "string" || typeof value === "number" ? String(value) : "";
  let input;
  switch (f.type) {
    case "textarea":
      input = <Textarea id={id} value={str} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "select":
      input = (
        <Select id={id} value={str} onChange={(e) => onChange(e.target.value)}>
          <option value="">Selecciona…</option>
          {f.options?.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </Select>
      );
      break;
    case "multiselect": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      input = (
        <div className="space-y-1.5">
          {f.options?.map((o) => (
            <Checkbox
              key={o}
              label={o}
              checked={arr.includes(o)}
              onChange={(e) => onChange(e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))}
            />
          ))}
        </div>
      );
      break;
    }
    case "checkbox":
      return (
        <div>
          <Checkbox label={f.label + (f.required ? " *" : "")} checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          {f.help && <p className="mt-1 text-xs text-zinc-500">{f.help}</p>}
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
      );
    case "file":
      input = (
        <div>
          <input
            id={id}
            type="file"
            accept={f.accept?.join(",")}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-zinc-300 file:bg-white file:px-3 file:py-1.5 file:text-sm"
            onChange={(e) => onChange(e.target.files?.[0]?.name ?? "")}
          />
          {f.maxMb && <p className="mt-1 text-xs text-zinc-500">Máximo {f.maxMb} MB</p>}
        </div>
      );
      break;
    case "repeater": {
      const rows = Array.isArray(value) ? (value as Answers[]) : [];
      input = (
        <div className="space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="rounded-md border border-zinc-200 p-3">
              <div className="mb-2 flex items-center justify-between text-xs font-medium text-zinc-500">
                <span>
                  {f.label} {i + 1}
                </span>
                <Button size="sm" variant="danger" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                  Quitar
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {f.fields?.map((sf) => (
                  <FieldInput
                    key={sf.key}
                    field={sf}
                    value={row[sf.key]}
                    onChange={(v) => onChange(rows.map((r, j) => (j === i ? { ...r, [sf.key]: v } : r)))}
                    error={errors[`${errorPrefix}.${i}.${sf.key}`]}
                    errors={errors}
                    errorPrefix={`${errorPrefix}.${i}.${sf.key}`}
                  />
                ))}
              </div>
            </div>
          ))}
          <Button size="sm" onClick={() => onChange([...rows, {}])} disabled={f.max !== undefined && rows.length >= f.max}>
            + Agregar
          </Button>
        </div>
      );
      break;
    }
    default: {
      const type = { email: "email", phone: "tel", number: "number", date: "date" }[f.type as string] ?? "text";
      input = (
        <Input
          id={id}
          type={type}
          value={str}
          placeholder={f.placeholder ?? (f.type === "id" && f.idKind === "rut" ? "12.345.678-5" : undefined)}
          min={f.type === "number" ? f.min : undefined}
          max={f.type === "number" ? f.max : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }
  }
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-zinc-800">
        {f.label}
        {f.required && <span className="text-red-600"> *</span>}
      </label>
      {input}
      {f.help && <p className="mt-1 text-xs text-zinc-500">{f.help}</p>}
      {error && <p className={cn("mt-1 text-xs text-red-600")}>{error}</p>}
    </div>
  );
}
