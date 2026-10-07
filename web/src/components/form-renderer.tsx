"use client";

import { useState, type ReactNode } from "react";
import { Button, Checkbox, Input, Select, Textarea } from "@/components/ui";
import { SignaturePad } from "@/components/signature-pad";
import { LivenessPreview } from "@/components/portal/liveness-field";
import {
  ADDRESS_PARTS,
  FREQUENT_COUNTRIES,
  countriesByName,
  countryName,
  evaluate,
  fieldOptions,
  formatAmount,
  scaleRange,
  validateAnswer,
  type Address,
  type Answers,
  type Field,
  type FormSchema,
} from "@/lib/form-schema";
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
      if (!evaluate(f.showIf, answers) || f.type === "liveness") continue; // no camera in the preview
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

/**
 * One field of the form. The filling portal passes `renderFile` and `renderLiveness` to plug in
 * real uploads and the camera check, and `disabled` to lock fields a reviewer did not flag.
 */
export function FieldInput({
  field: f,
  value,
  onChange,
  error,
  errors,
  errorPrefix,
  disabled,
  renderFile,
  renderLiveness,
  note,
}: {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
  errors: Record<string, string>;
  errorPrefix: string;
  disabled?: boolean;
  renderFile?: (field: Field, path: string) => ReactNode;
  renderLiveness?: (field: Field) => ReactNode;
  note?: ReactNode;
}) {
  const id = `f-${errorPrefix}`;
  const str = typeof value === "string" || typeof value === "number" ? String(value) : "";
  let input;
  switch (f.type) {
    case "info":
      return (
        <div className="rounded-md border-l-4 border-zinc-300 bg-zinc-50 px-4 py-3">
          <p className="text-sm font-semibold text-zinc-900">{f.label}</p>
          {f.help && <p className="mt-1 whitespace-pre-line text-sm text-zinc-600">{f.help}</p>}
          {note}
        </div>
      );
    case "heading":
      return (
        <div className="pt-2">
          <h3 className="text-base font-semibold text-zinc-900">{f.label}</h3>
          {f.help && <p className="mt-0.5 whitespace-pre-line text-sm text-zinc-600">{f.help}</p>}
          {note}
        </div>
      );
    case "divider":
      return f.label ? (
        <div className="flex items-center gap-3 py-1" role="separator">
          <span className="h-px flex-1 bg-zinc-200" />
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{f.label}</span>
          <span className="h-px flex-1 bg-zinc-200" />
        </div>
      ) : (
        <hr className="border-zinc-200" />
      );
    case "spacer":
      return <div aria-hidden className="h-6" />;
    case "yesno":
    case "radio":
      input = (
        <ChoiceGroup
          id={id}
          options={fieldOptions(f) ?? []}
          value={str}
          inline={f.type === "yesno"}
          disabled={disabled}
          onChange={onChange}
        />
      );
      break;
    case "country":
      input = <CountrySelect id={id} value={str} disabled={disabled} onChange={onChange} />;
      break;
    case "scale": {
      const [lo, hi] = scaleRange(f);
      input = (
        <div id={id} role="radiogroup" className="flex flex-wrap gap-1.5">
          {Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => lo + i).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              disabled={disabled}
              onClick={() => onChange(value === n ? undefined : n)}
              className={cn(
                "h-9 min-w-9 rounded-md border px-2 text-sm font-medium transition-colors disabled:cursor-not-allowed",
                value === n ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-500",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      );
      break;
    }
    case "currency":
      input = (
        <div>
          <div className="flex">
            <span className="inline-flex items-center rounded-l-md border border-r-0 border-zinc-300 bg-zinc-50 px-2.5 text-xs font-medium text-zinc-600">
              {f.currency === "CLF" ? "UF" : f.currency || "CLP"}
            </span>
            <Input
              id={id}
              type="number"
              inputMode="decimal"
              step="any"
              className="rounded-l-none"
              value={str}
              placeholder={f.placeholder ?? "0"}
              min={f.min}
              max={f.max}
              disabled={disabled}
              onChange={(e) => onChange(e.target.value)}
            />
          </div>
          {str !== "" && !Number.isNaN(Number(str)) && (
            <p className="mt-1 text-xs text-zinc-500">{formatAmount(str, f.currency)}</p>
          )}
        </div>
      );
      break;
    case "address":
      input = <AddressInput id={id} value={value} disabled={disabled} onChange={onChange} />;
      break;
    case "liveness":
      input = renderLiveness ? renderLiveness(f) : <LivenessPreview />;
      break;
    case "signature":
      input = <SignaturePad id={id} value={str} disabled={disabled} onChange={(p) => onChange(p || undefined)} />;
      break;
    case "url":
      input = (
        <Input
          id={id}
          type="url"
          inputMode="url"
          value={str}
          placeholder={f.placeholder ?? "https://"}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          // Applicants often type "empresa.cl"; add the scheme so it validates.
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && !/^[a-z][a-z0-9+.-]*:/i.test(v)) onChange(`https://${v}`);
          }}
        />
      );
      break;
    case "textarea":
      input = <Textarea id={id} value={str} placeholder={f.placeholder} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "select":
      input = (
        <Select id={id} value={str} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
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
              disabled={disabled}
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
          <Checkbox
            label={f.label + (f.required ? " *" : "")}
            checked={value === true}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
          />
          {f.help && <p className="mt-1 text-xs text-zinc-500">{f.help}</p>}
          {note}
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
      );
    case "file":
      input = renderFile ? (
        renderFile(f, errorPrefix)
      ) : (
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
                <Button
                  size="sm"
                  variant="danger"
                  disabled={disabled}
                  onClick={() => onChange(rows.filter((_, j) => j !== i))}
                >
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
                    disabled={disabled}
                    renderFile={renderFile}
                  />
                ))}
              </div>
            </div>
          ))}
          <Button
            size="sm"
            onClick={() => onChange([...rows, {}])}
            disabled={disabled || (f.max !== undefined && rows.length >= f.max)}
          >
            + Agregar
          </Button>
        </div>
      );
      break;
    }
    default: {
      const type =
        { email: "email", phone: "tel", number: "number", date: "date", time: "time", datetime: "datetime-local" }[f.type as string] ??
        "text";
      input = (
        <Input
          id={id}
          type={type}
          value={str}
          placeholder={f.placeholder ?? (f.type === "id" && f.idKind === "rut" ? "12.345.678-5" : undefined)}
          min={f.type === "number" ? f.min : undefined}
          max={f.type === "number" ? f.max : undefined}
          disabled={disabled}
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
      {note}
      {error && <p className={cn("mt-1 text-xs text-red-600")}>{error}</p>}
    </div>
  );
}

function ChoiceGroup({
  id,
  options,
  value,
  inline,
  disabled,
  onChange,
}: {
  id: string;
  options: string[];
  value: string;
  inline?: boolean;
  disabled?: boolean;
  onChange: (v: unknown) => void;
}) {
  return (
    <div id={id} role="radiogroup" className={cn(inline ? "flex flex-wrap gap-2" : "space-y-1.5")}>
      {options.map((o) => (
        <label
          key={o}
          className={cn(
            "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
            inline && "min-w-20",
            value === o ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-400",
            disabled && "cursor-not-allowed opacity-70",
          )}
        >
          <input
            type="radio"
            name={id}
            className="h-4 w-4 accent-zinc-900"
            checked={value === o}
            disabled={disabled}
            onChange={() => onChange(o)}
          />
          {o}
        </label>
      ))}
    </div>
  );
}

function CountrySelect({
  id,
  value,
  disabled,
  onChange,
}: {
  id: string;
  value: string;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <Select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">Selecciona un país…</option>
      <optgroup label="Frecuentes">
        {FREQUENT_COUNTRIES.map((c) => (
          <option key={c} value={c}>
            {countryName(c)}
          </option>
        ))}
      </optgroup>
      <optgroup label="Todos los países">
        {countriesByName().map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </optgroup>
    </Select>
  );
}

function AddressInput({
  id,
  value,
  disabled,
  onChange,
}: {
  id: string;
  value: unknown;
  disabled?: boolean;
  onChange: (v: unknown) => void;
}) {
  const a = value && typeof value === "object" && !Array.isArray(value) ? (value as Address) : {};
  const set = (k: keyof Address, v: string) => onChange({ ...a, [k]: v });
  return (
    <div id={id} className="grid gap-2 rounded-md border border-zinc-200 p-3 sm:grid-cols-2">
      {ADDRESS_PARTS.map((p) => (
        <div key={p.key} className={cn(p.key === "line1" && "sm:col-span-2")}>
          <label htmlFor={`${id}-${p.key}`} className="mb-1 block text-xs text-zinc-600">
            {p.label}
            {p.optional && <span className="text-zinc-400"> (opcional)</span>}
          </label>
          {p.key === "country" ? (
            <CountrySelect id={`${id}-${p.key}`} value={a.country ?? ""} disabled={disabled} onChange={(v) => set("country", v)} />
          ) : (
            <Input
              id={`${id}-${p.key}`}
              value={a[p.key] ?? ""}
              disabled={disabled}
              autoComplete={{ line1: "address-line1", line2: "address-line2", city: "address-level2", region: "address-level1", postalCode: "postal-code" }[p.key]}
              onChange={(e) => set(p.key, e.target.value)}
            />
          )}
        </div>
      ))}
    </div>
  );
}
