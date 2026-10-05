// Immutable edits on a form schema, used by the builder.
import { allKeys, newField, slugify, uniqueKey, type Field, type FieldType, type FormSchema, type Section } from "@/lib/form-schema";

/** What the inspector is editing: a section, a field in it, or a sub-field of a repeater. */
export type Selection = { s: number; f?: number; sub?: number } | null;

export function getField(schema: FormSchema, sel: Selection): Field | undefined {
  if (!sel || sel.f === undefined) return undefined;
  const f = schema.sections[sel.s]?.fields[sel.f];
  return sel.sub === undefined ? f : f?.fields?.[sel.sub];
}

export function updateSection(schema: FormSchema, s: number, patch: Partial<Section>): FormSchema {
  return { sections: schema.sections.map((sec, i) => (i === s ? { ...sec, ...patch } : sec)) };
}

export function updateField(schema: FormSchema, sel: Selection, patch: Partial<Field>): FormSchema {
  if (!sel || sel.f === undefined) return schema;
  const { s, f, sub } = sel;
  return updateSection(schema, s, {
    fields: schema.sections[s].fields.map((field, i) => {
      if (i !== f) return field;
      if (sub === undefined) return clean({ ...field, ...patch });
      return { ...field, fields: field.fields?.map((sf, j) => (j === sub ? clean({ ...sf, ...patch }) : sf)) };
    }),
  });
}

// Drops properties set to undefined or "" so the saved JSON stays tidy.
function clean(f: Field): Field {
  const out = { ...f } as Record<string, unknown>;
  for (const k of Object.keys(out)) {
    if (k === "key" || k === "label" || k === "type") continue;
    if (out[k] === undefined || out[k] === "") delete out[k];
  }
  return out as Field;
}

/** Renames the top-level field at (s, f) and repoints the conditions that referred to its old key. */
export function renameKey(schema: FormSchema, s: number, f: number, to: string): FormSchema {
  const from = schema.sections[s].fields[f].key;
  // If another field shares the old key (a draft can have duplicates), conditions stay on it.
  const shared = schema.sections.some((sec, si) => sec.fields.some((x, fi) => x.key === from && (si !== s || fi !== f)));
  const fix = <T extends { showIf?: { field: string } }>(x: T): T =>
    !shared && x.showIf?.field === from ? { ...x, showIf: { ...x.showIf, field: to } } : x;
  return {
    sections: schema.sections.map((sec, si) =>
      fix({ ...sec, fields: sec.fields.map((x, fi) => fix(si === s && fi === f ? { ...x, key: to } : x)) }),
    ),
  };
}

export function addField(schema: FormSchema, sel: Selection, type: FieldType): { schema: FormSchema; sel: Selection } {
  if (schema.sections.length === 0) schema = addSection(schema).schema;
  const s = sel ? Math.min(sel.s, schema.sections.length - 1) : schema.sections.length - 1;
  const fields = [...schema.sections[s].fields];
  const at = sel?.s === s && sel.f !== undefined ? sel.f + 1 : fields.length;
  fields.splice(at, 0, newField(type, allKeys(schema)));
  return { schema: updateSection(schema, s, { fields }), sel: { s, f: at } };
}

export function addSubField(schema: FormSchema, sel: Selection, type: FieldType): { schema: FormSchema; sel: Selection } {
  const parent = getField(schema, sel && { s: sel.s, f: sel.f });
  if (!sel || sel.f === undefined || !parent) return { schema, sel };
  const taken = new Set(parent.fields?.map((f) => f.key));
  const sub = newField(type, taken);
  const fields = [...(parent.fields ?? []), sub];
  return { schema: updateField(schema, { s: sel.s, f: sel.f }, { fields }), sel: { s: sel.s, f: sel.f, sub: fields.length - 1 } };
}

export function removeField(schema: FormSchema, sel: Selection): FormSchema {
  if (!sel || sel.f === undefined) return schema;
  if (sel.sub !== undefined) {
    const parent = getField(schema, { s: sel.s, f: sel.f });
    return updateField(schema, { s: sel.s, f: sel.f }, { fields: parent?.fields?.filter((_, i) => i !== sel.sub) });
  }
  return updateSection(schema, sel.s, { fields: schema.sections[sel.s].fields.filter((_, i) => i !== sel.f) });
}

export function duplicateField(schema: FormSchema, sel: Selection): { schema: FormSchema; sel: Selection } {
  const f = getField(schema, sel);
  if (!sel || sel.f === undefined || !f || sel.sub !== undefined) return { schema, sel };
  const copy: Field = { ...f, key: uniqueKey(f.key, allKeys(schema)), label: `${f.label} (copia)` };
  const fields = [...schema.sections[sel.s].fields];
  fields.splice(sel.f + 1, 0, copy);
  return { schema: updateSection(schema, sel.s, { fields }), sel: { s: sel.s, f: sel.f + 1 } };
}

export function addSection(schema: FormSchema): { schema: FormSchema; sel: Selection } {
  const taken = new Set(schema.sections.map((s) => s.key));
  const n = schema.sections.length + 1;
  const sec: Section = { key: uniqueKey(`seccion_${n}`, taken), title: `Sección ${n}`, fields: [] };
  return { schema: { sections: [...schema.sections, sec] }, sel: { s: schema.sections.length } };
}

export function removeSection(schema: FormSchema, s: number): FormSchema {
  return { sections: schema.sections.filter((_, i) => i !== s) };
}

export function move<T>(arr: T[], from: number, to: number): T[] {
  const out = [...arr];
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item);
  return out;
}

/** Moves a top-level field to another position, possibly in another section. */
export function moveField(schema: FormSchema, from: { s: number; f: number }, to: { s: number; f: number }): FormSchema {
  const field = schema.sections[from.s].fields[from.f];
  let next = updateSection(schema, from.s, { fields: schema.sections[from.s].fields.filter((_, i) => i !== from.f) });
  const fields = [...next.sections[to.s].fields];
  fields.splice(Math.min(to.f, fields.length), 0, field);
  next = updateSection(next, to.s, { fields });
  return next;
}

/** A key that still follows its label is renamed along with it, until the form is first published. */
export function keyFollowsLabel(key: string, label: string): boolean {
  const base = slugify(label);
  return key === base || new RegExp(`^${base}_\\d+$`).test(key);
}
