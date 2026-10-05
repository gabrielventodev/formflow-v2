// Shape of a form, mirrored from api/internal/schema/schema.go. Keep both in sync.

export type FieldType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "number"
  | "date"
  | "select"
  | "multiselect"
  | "checkbox"
  | "file"
  | "id"
  | "repeater";

export type ConditionOp = "eq" | "neq" | "contains" | "empty" | "notEmpty";

export type Condition = {
  field: string;
  op: ConditionOp;
  value?: string | boolean;
};

export type IdKind = "rut" | "dni" | "other";

export type Field = {
  key: string;
  type: FieldType;
  label: string;
  help?: string;
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  patternMessage?: string;
  options?: string[];
  accept?: string[];
  maxMb?: number;
  idKind?: IdKind;
  fields?: Field[];
  showIf?: Condition;
};

export type Section = {
  key: string;
  title: string;
  description?: string;
  fields: Field[];
  showIf?: Condition;
};

export type FormSchema = { sections: Section[] };

export type Problem = { path: string; message: string };

export const FIELD_TYPES: { type: FieldType; label: string; description: string }[] = [
  { type: "text", label: "Texto corto", description: "Una línea" },
  { type: "textarea", label: "Texto largo", description: "Párrafo" },
  { type: "email", label: "Email", description: "Correo electrónico" },
  { type: "phone", label: "Teléfono", description: "Número de contacto" },
  { type: "number", label: "Número", description: "Con mínimo y máximo" },
  { type: "date", label: "Fecha", description: "Selector de fecha" },
  { type: "select", label: "Selección única", description: "Lista de opciones" },
  { type: "multiselect", label: "Selección múltiple", description: "Varias opciones" },
  { type: "checkbox", label: "Casilla", description: "Sí / no" },
  { type: "file", label: "Archivo", description: "Documento o imagen" },
  { type: "id", label: "RUT / DNI", description: "Documento con validación" },
  { type: "repeater", label: "Grupo repetible", description: "Ej.: socios" },
];

export const typeLabel = (t: FieldType) => FIELD_TYPES.find((x) => x.type === t)?.label ?? t;

export const ID_KINDS: { value: IdKind; label: string }[] = [
  { value: "rut", label: "RUT (Chile)" },
  { value: "dni", label: "DNI (Perú / Argentina)" },
  { value: "other", label: "Otro documento" },
];

export const FILE_ACCEPT: { value: string; label: string }[] = [
  { value: "application/pdf", label: "PDF" },
  { value: "image/*", label: "Imágenes" },
  {
    value: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    label: "Word (.docx)",
  },
  {
    value: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    label: "Excel (.xlsx)",
  },
];

export const CONDITION_OPS: { value: ConditionOp; label: string; needsValue: boolean }[] = [
  { value: "eq", label: "es igual a", needsValue: true },
  { value: "neq", label: "es distinto de", needsValue: true },
  { value: "contains", label: "contiene", needsValue: true },
  { value: "notEmpty", label: "tiene respuesta", needsValue: false },
  { value: "empty", label: "está vacío", needsValue: false },
];

/** Turns a label into a field key: "Razón social" → "razon_social". */
export function slugify(label: string): string {
  const s = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return /^[a-z]/.test(s) ? s : `campo_${s}`.replace(/_+$/, "");
}

export function uniqueKey(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}_${i}`)) return `${base}_${i}`;
}

/** All top-level field keys, which share one namespace across sections. */
export function allKeys(schema: FormSchema): Set<string> {
  return new Set(schema.sections.flatMap((s) => s.fields.map((f) => f.key)));
}

export function newField(type: FieldType, taken: Set<string>): Field {
  const label = typeLabel(type);
  const f: Field = { key: uniqueKey(slugify(label), taken), type, label };
  if (type === "select" || type === "multiselect") f.options = ["Opción 1", "Opción 2"];
  if (type === "file") {
    f.accept = ["application/pdf"];
    f.maxMb = 10;
  }
  if (type === "id") f.idKind = "rut";
  if (type === "repeater") f.fields = [{ key: "nombre", type: "text", label: "Nombre" }];
  return f;
}

/** Top-level fields declared before the given position, which a condition may refer to. */
export function fieldsBefore(schema: FormSchema, sectionIdx: number, fieldIdx?: number): Field[] {
  const out: Field[] = [];
  schema.sections.forEach((s, si) => {
    s.fields.forEach((f, fi) => {
      if (si < sectionIdx || (si === sectionIdx && fieldIdx !== undefined && fi < fieldIdx)) {
        if (f.type !== "repeater" && f.type !== "file") out.push(f);
      }
    });
  });
  return out;
}

export type Answers = Record<string, unknown>;

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === "" || v === false || (Array.isArray(v) && v.length === 0);
}

export function evaluate(c: Condition | undefined, answers: Answers): boolean {
  if (!c) return true;
  const v = answers[c.field];
  if (typeof c.value === "boolean" && (c.op === "eq" || c.op === "neq")) {
    return ((v === true) === c.value) === (c.op === "eq");
  }
  switch (c.op) {
    case "empty":
      return isEmpty(v);
    case "notEmpty":
      return !isEmpty(v);
    case "eq":
      return Array.isArray(v) ? v.includes(c.value) : String(v ?? "") === String(c.value ?? "");
    case "neq":
      return Array.isArray(v) ? !v.includes(c.value) : String(v ?? "") !== String(c.value ?? "");
    case "contains":
      return Array.isArray(v)
        ? v.includes(c.value)
        : String(v ?? "").toLowerCase().includes(String(c.value ?? "").toLowerCase());
  }
}

/** Chilean RUT with check digit, e.g. 12.345.678-5. */
export function isValidRut(raw: string): boolean {
  const clean = raw.replace(/[.\s-]/g, "").toUpperCase();
  if (!/^\d{7,8}[0-9K]$/.test(clean)) return false;
  const body = clean.slice(0, -1);
  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const rest = 11 - (sum % 11);
  const dv = rest === 11 ? "0" : rest === 10 ? "K" : String(rest);
  return dv === clean.slice(-1);
}

/** Validates one answer and returns an error message, or null. */
export function validateAnswer(f: Field, v: unknown): string | null {
  // A repeater with a minimum needs that many rows even when it isn't marked required.
  if (f.type === "repeater" && f.min && (!Array.isArray(v) || v.length < f.min)) return `Agrega al menos ${f.min}`;
  if (isEmpty(v)) return f.required ? "Este campo es obligatorio" : null;
  switch (f.type) {
    case "text":
    case "textarea": {
      const s = String(v);
      if (f.min !== undefined && s.length < f.min) return `Mínimo ${f.min} caracteres`;
      if (f.max !== undefined && s.length > f.max) return `Máximo ${f.max} caracteres`;
      break;
    }
    case "email":
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v))) return "Email no válido";
      break;
    case "phone":
      if (!/^\+?[\d\s()-]{6,20}$/.test(String(v))) return "Teléfono no válido";
      break;
    case "number": {
      const n = Number(v);
      if (Number.isNaN(n)) return "Debe ser un número";
      if (f.min !== undefined && n < f.min) return `El mínimo es ${f.min}`;
      if (f.max !== undefined && n > f.max) return `El máximo es ${f.max}`;
      break;
    }
    case "id":
      if (f.idKind === "rut" && !isValidRut(String(v))) return "RUT no válido";
      if (f.idKind === "dni" && !/^\d{7,8}$/.test(String(v).replace(/[.\s]/g, "")))
        return "DNI no válido";
      break;
    case "repeater": {
      const n = Array.isArray(v) ? v.length : 0;
      if (f.min !== undefined && n < f.min) return `Agrega al menos ${f.min}`;
      if (f.max !== undefined && n > f.max) return `Máximo ${f.max}`;
      break;
    }
  }
  if (f.pattern) {
    try {
      if (!new RegExp(`^(?:${f.pattern})$`).test(String(v)))
        return f.patternMessage || "El formato no es válido";
    } catch {
      // An invalid pattern is reported in the builder, not to the applicant.
    }
  }
  return null;
}

/** Parses a problem path like "sections[1].fields[0].fields[2].label" into indexes. */
export function locateProblem(path: string): { section?: number; field?: number; sub?: number } {
  const nums = [...path.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  return { section: nums[0], field: nums[1], sub: nums[2] };
}
