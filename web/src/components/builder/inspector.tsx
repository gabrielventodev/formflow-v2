"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, Checkbox, Input, Label, Select, Textarea } from "@/components/ui";
import {
  CONDITION_OPS,
  CURRENCIES,
  FIELD_TYPES,
  FILE_ACCEPT,
  ID_KINDS,
  allKeys,
  fieldOptions,
  fieldsBefore,
  slugify,
  typeLabel,
  uniqueKey,
  type Condition,
  type Field,
  type FieldType,
  type FormSchema,
  type Problem,
} from "@/lib/form-schema";
import {
  addSubField,
  getField,
  keyFollowsLabel,
  move,
  removeField,
  renameKey,
  updateField,
  updateSection,
  type Selection,
} from "./ops";

type Props = {
  schema: FormSchema;
  sel: Selection;
  published: boolean;
  problems: Problem[];
  onChange: (schema: FormSchema, sel?: Selection) => void;
  onSelect: (sel: Selection) => void;
};

export function Inspector(props: Props) {
  const { schema, sel } = props;
  if (!sel || !schema.sections[sel.s]) {
    return <p className="text-sm text-zinc-500">Selecciona una sección o un campo para editar sus propiedades.</p>;
  }
  if (sel.f === undefined) return <SectionProps {...props} s={sel.s} />;
  const field = getField(schema, sel);
  if (!field) return null;
  // Remount per selection so local text state (like the options list) resets.
  return <FieldProps key={`${sel.s}:${sel.f}:${sel.sub}`} {...props} field={field} sel={sel} />;
}

function problemsAt(problems: Problem[], prefix: string) {
  return problems.filter((p) => p.path === prefix || p.path.startsWith(prefix + "."));
}

function ProblemList({ problems }: { problems: Problem[] }) {
  if (problems.length === 0) return null;
  return (
    <ul className="mb-4 space-y-1 rounded-md bg-amber-50 p-3 text-xs text-amber-900">
      {problems.map((p, i) => (
        <li key={i}>{p.message}</li>
      ))}
    </ul>
  );
}

function SectionProps({ schema, s, problems, onChange }: Props & { s: number }) {
  const sec = schema.sections[s];
  const own = problems.filter(
    (p) => (p.path === `sections[${s}]` || p.path.startsWith(`sections[${s}].`)) && !p.path.includes(".fields["),
  );
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Sección · paso {s + 1}</h3>
      <ProblemList problems={own} />
      <div>
        <Label htmlFor="sec-title">Título</Label>
        <Input id="sec-title" value={sec.title} onChange={(e) => onChange(updateSection(schema, s, { title: e.target.value }))} />
      </div>
      <div>
        <Label htmlFor="sec-desc" hint="(opcional)">
          Descripción
        </Label>
        <Textarea
          id="sec-desc"
          value={sec.description ?? ""}
          onChange={(e) => onChange(updateSection(schema, s, { description: e.target.value || undefined }))}
        />
      </div>
      <div>
        <Label htmlFor="sec-key" hint="identificador interno">
          Clave
        </Label>
        <Input
          id="sec-key"
          className="font-mono"
          value={sec.key}
          onChange={(e) => onChange(updateSection(schema, s, { key: e.target.value }))}
          onBlur={(e) => onChange(updateSection(schema, s, { key: slugify(e.target.value) }))}
        />
      </div>
      <ConditionEditor
        candidates={fieldsBefore(schema, s)}
        value={sec.showIf}
        what="esta sección"
        onChange={(showIf) => onChange(updateSection(schema, s, { showIf }))}
      />
    </div>
  );
}

function FieldProps({ schema, sel, field, published, problems, onChange, onSelect }: Props & { field: Field; sel: NonNullable<Selection> }) {
  const nested = sel.sub !== undefined;
  const path = `sections[${sel.s}].fields[${sel.f}]` + (nested ? `.fields[${sel.sub}]` : "");
  const set = (patch: Partial<Field>) => onChange(updateField(schema, sel, patch));
  const parent = nested ? getField(schema, { s: sel.s, f: sel.f }) : undefined;
  const siblingKeys = nested ? new Set(parent?.fields?.map((f) => f.key)) : allKeys(schema);
  siblingKeys.delete(field.key);

  const setKey = (key: string) => {
    if (key === field.key) return;
    if (nested) set({ key });
    else onChange(renameKey(schema, sel.s, sel.f!, key));
  };

  const setLabel = (label: string) => {
    // Until the first publish, keys follow labels so admins rarely need to touch them.
    if (!published && keyFollowsLabel(field.key, field.label) && label.trim()) {
      const key = uniqueKey(slugify(label), siblingKeys);
      const renamed = nested ? updateField(schema, sel, { key }) : renameKey(schema, sel.s, sel.f!, key);
      onChange(updateField(renamed, sel, { label }));
    } else {
      set({ label });
    }
  };

  const [optionsText, setOptionsText] = useState((field.options ?? []).join("\n"));
  const num = (v: string) => (v === "" ? undefined : Number(v));
  const isText = ["text", "textarea", "email", "phone", "id", "url", "currency"].includes(field.type);
  const isInfo = field.type === "info";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {typeLabel(field.type)}
          {nested && <span className="font-normal text-zinc-500"> · dentro de {parent?.label}</span>}
        </h3>
        {nested && (
          <Button size="sm" variant="ghost" onClick={() => onSelect({ s: sel.s, f: sel.f })}>
            Volver al grupo
          </Button>
        )}
      </div>
      <ProblemList problems={problemsAt(problems, path).filter((p) => nested || !p.path.startsWith(path + ".fields["))} />

      <div>
        <Label htmlFor="f-label">{isInfo ? "Título" : "Etiqueta"}</Label>
        <Input id="f-label" value={field.label} onChange={(e) => setLabel(e.target.value)} />
      </div>
      {isInfo ? (
        <div>
          <Label htmlFor="f-help">Texto</Label>
          <Textarea id="f-help" rows={4} value={field.help ?? ""} onChange={(e) => set({ help: e.target.value || undefined })} />
        </div>
      ) : (
        <div>
          <Label htmlFor="f-help" hint="(opcional)">
            Texto de ayuda
          </Label>
          <Input id="f-help" value={field.help ?? ""} onChange={(e) => set({ help: e.target.value })} />
        </div>
      )}
      {isText && (
        <div>
          <Label htmlFor="f-ph" hint="(opcional)">
            Texto de ejemplo
          </Label>
          <Input id="f-ph" value={field.placeholder ?? ""} onChange={(e) => set({ placeholder: e.target.value })} />
        </div>
      )}
      {field.type !== "repeater" && !isInfo && (
        <Checkbox label="Obligatorio" checked={!!field.required} onChange={(e) => set({ required: e.target.checked || undefined })} />
      )}

      {(field.type === "select" || field.type === "multiselect" || field.type === "radio") && (
        <div>
          <Label htmlFor="f-opts" hint="una por línea">
            Opciones
          </Label>
          <Textarea
            id="f-opts"
            rows={5}
            value={optionsText}
            onChange={(e) => {
              setOptionsText(e.target.value);
              set({ options: e.target.value.split("\n").map((o) => o.trim()).filter(Boolean) });
            }}
          />
        </div>
      )}

      {field.type === "id" && (
        <div>
          <Label htmlFor="f-idkind">Tipo de documento</Label>
          <Select id="f-idkind" value={field.idKind ?? "rut"} onChange={(e) => set({ idKind: e.target.value as Field["idKind"] })}>
            {ID_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </div>
      )}

      {field.type === "currency" && (
        <div>
          <Label htmlFor="f-currency">Moneda</Label>
          <Select id="f-currency" value={field.currency ?? ""} onChange={(e) => set({ currency: e.target.value || undefined })}>
            <option value="">Elige…</option>
            {CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
      )}

      {["number", "currency", "scale", "text", "textarea", "repeater"].includes(field.type) && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label
              htmlFor="f-min"
              hint={
                field.type === "number" || field.type === "scale" ? "valor" : field.type === "currency" ? "monto" : field.type === "repeater" ? "elementos" : "caracteres"
              }
            >
              Mínimo
            </Label>
            <Input id="f-min" type="number" value={field.min ?? ""} onChange={(e) => set({ min: num(e.target.value) })} />
          </div>
          <div>
            <Label htmlFor="f-max">Máximo</Label>
            <Input id="f-max" type="number" value={field.max ?? ""} onChange={(e) => set({ max: num(e.target.value) })} />
          </div>
        </div>
      )}

      {(field.type === "text" || field.type === "id") && (
        <details className="rounded-md border border-zinc-200 p-3 text-sm" open={!!field.pattern}>
          <summary className="cursor-pointer text-xs font-medium text-zinc-700">Validación avanzada (expresión regular)</summary>
          <div className="mt-3 space-y-3">
            <div>
              <Label htmlFor="f-pattern">Patrón</Label>
              <Input id="f-pattern" className="font-mono" placeholder="[A-Z]{3}-\d{4}" value={field.pattern ?? ""} onChange={(e) => set({ pattern: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="f-pmsg">Mensaje si no coincide</Label>
              <Input id="f-pmsg" value={field.patternMessage ?? ""} onChange={(e) => set({ patternMessage: e.target.value })} />
            </div>
          </div>
        </details>
      )}

      {field.type === "file" && (
        <>
          <div>
            <Label>Tipos permitidos</Label>
            <div className="space-y-1.5">
              {FILE_ACCEPT.map((a) => {
                const on = field.accept?.includes(a.value) ?? false;
                return (
                  <Checkbox
                    key={a.value}
                    label={a.label}
                    checked={on}
                    onChange={() => {
                      const next = on ? field.accept?.filter((x) => x !== a.value) : [...(field.accept ?? []), a.value];
                      set({ accept: next?.length ? next : undefined });
                    }}
                  />
                );
              })}
            </div>
          </div>
          <div>
            <Label htmlFor="f-maxmb">Tamaño máximo (MB)</Label>
            <Input id="f-maxmb" type="number" min={1} max={100} value={field.maxMb ?? ""} onChange={(e) => set({ maxMb: num(e.target.value) })} />
          </div>
        </>
      )}

      {field.type === "repeater" && !nested && (
        <SubFields schema={schema} sel={sel} field={field} onChange={onChange} onSelect={onSelect} />
      )}

      {!nested && (
        <ConditionEditor
          candidates={fieldsBefore(schema, sel.s, sel.f)}
          value={field.showIf}
          what="este campo"
          onChange={(showIf) => set({ showIf })}
        />
      )}

      <div>
        <Label htmlFor="f-key" hint="nombre de la columna en las respuestas">
          Clave
        </Label>
        <Input
          id="f-key"
          className="font-mono"
          value={field.key}
          onChange={(e) => setKey(e.target.value)}
          onBlur={(e) => setKey(slugify(e.target.value))}
        />
        {published && <p className="mt-1 text-xs text-zinc-500">Cambiar la clave de un formulario publicado separa las respuestas nuevas de las anteriores en las exportaciones.</p>}
      </div>
    </div>
  );
}

function SubFields({
  schema,
  sel,
  field,
  onChange,
  onSelect,
}: {
  schema: FormSchema;
  sel: NonNullable<Selection>;
  field: Field;
  onChange: Props["onChange"];
  onSelect: Props["onSelect"];
}) {
  const [type, setType] = useState<FieldType>("text");
  const subs = field.fields ?? [];
  const parentSel = { s: sel.s, f: sel.f };
  return (
    <div>
      <Label>Campos del grupo</Label>
      <ul className="mb-2 divide-y divide-zinc-100 rounded-md border border-zinc-200">
        {subs.map((sf, i) => (
          <li key={i} className="flex items-center gap-1 px-2 py-1.5 text-sm">
            <button className="min-w-0 flex-1 truncate text-left hover:underline" onClick={() => onSelect({ ...parentSel, sub: i })}>
              {sf.label || "Sin etiqueta"} <span className="text-xs text-zinc-500">· {typeLabel(sf.type)}</span>
            </button>
            <Button size="sm" variant="ghost" aria-label="Subir" disabled={i === 0} onClick={() => onChange(updateField(schema, parentSel, { fields: move(subs, i, i - 1) }))}>
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" aria-label="Bajar" disabled={i === subs.length - 1} onClick={() => onChange(updateField(schema, parentSel, { fields: move(subs, i, i + 1) }))}>
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="danger" aria-label="Quitar" onClick={() => onChange(removeField(schema, { ...parentSel, sub: i }))}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Select value={type} onChange={(e) => setType(e.target.value as FieldType)}>
          {FIELD_TYPES.filter((t) => t.type !== "repeater" && t.type !== "info").map((t) => (
            <option key={t.type} value={t.type}>
              {t.label}
            </option>
          ))}
        </Select>
        <Button
          onClick={() => {
            const r = addSubField(schema, parentSel, type);
            onChange(r.schema, r.sel);
          }}
        >
          Agregar
        </Button>
      </div>
    </div>
  );
}

function ConditionEditor({
  candidates,
  value,
  what,
  onChange,
}: {
  candidates: Field[];
  value?: Condition;
  what: string;
  onChange: (c: Condition | undefined) => void;
}) {
  const target = candidates.find((f) => f.key === value?.field);
  const op = CONDITION_OPS.find((o) => o.value === value?.op);
  return (
    <div className="rounded-md border border-zinc-200 p-3">
      <Checkbox
        label={`Mostrar ${what} solo si…`}
        checked={!!value}
        disabled={!value && candidates.length === 0}
        onChange={(e) => onChange(e.target.checked ? { field: candidates[0].key, op: "notEmpty" } : undefined)}
      />
      {!value && candidates.length === 0 && (
        <p className="mt-1 text-xs text-zinc-500">Necesitas un campo anterior para crear una condición.</p>
      )}
      {value && (
        <div className="mt-3 space-y-2">
          <Select value={value.field} onChange={(e) => onChange({ ...value, field: e.target.value, value: undefined })}>
            {!target && <option value={value.field}>{value.field} (no disponible)</option>}
            {candidates.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </Select>
          <Select value={value.op} onChange={(e) => onChange({ ...value, op: e.target.value as Condition["op"] })}>
            {CONDITION_OPS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          {op?.needsValue &&
            (target && fieldOptions(target) ? (
              <Select value={String(value.value ?? "")} onChange={(e) => onChange({ ...value, value: e.target.value || undefined })}>
                <option value="">Elige una opción…</option>
                {fieldOptions(target)!.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </Select>
            ) : target?.type === "checkbox" ? (
              <Select value={String(value.value ?? "")} onChange={(e) => onChange({ ...value, value: e.target.value === "" ? undefined : e.target.value === "true" })}>
                <option value="">Elige…</option>
                <option value="true">Marcada</option>
                <option value="false">Sin marcar</option>
              </Select>
            ) : (
              <Input placeholder="Valor" value={String(value.value ?? "")} onChange={(e) => onChange({ ...value, value: e.target.value || undefined })} />
            ))}
        </div>
      )}
    </div>
  );
}
