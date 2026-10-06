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
  | "repeater"
  | "url"
  | "currency"
  | "time"
  | "datetime"
  | "yesno"
  | "radio"
  | "country"
  | "address"
  | "scale"
  | "signature"
  | "info";

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
  currency?: string;
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

export type FieldGroup = "text" | "numbers" | "choices" | "documents" | "layout";

export const FIELD_GROUPS: { value: FieldGroup; label: string }[] = [
  { value: "text", label: "Texto y contacto" },
  { value: "numbers", label: "Números y fechas" },
  { value: "choices", label: "Opciones" },
  { value: "documents", label: "Identidad y documentos" },
  { value: "layout", label: "Estructura" },
];

export const FIELD_TYPES: { type: FieldType; label: string; description: string; group: FieldGroup }[] = [
  { type: "text", label: "Texto corto", description: "Una línea", group: "text" },
  { type: "textarea", label: "Texto largo", description: "Párrafo", group: "text" },
  { type: "email", label: "Email", description: "Correo electrónico", group: "text" },
  { type: "phone", label: "Teléfono", description: "Número de contacto", group: "text" },
  { type: "url", label: "Sitio web", description: "Enlace https://", group: "text" },
  { type: "address", label: "Dirección", description: "Calle, ciudad y país", group: "text" },
  { type: "number", label: "Número", description: "Con mínimo y máximo", group: "numbers" },
  { type: "currency", label: "Monto", description: "Cantidad en una moneda", group: "numbers" },
  { type: "date", label: "Fecha", description: "Selector de fecha", group: "numbers" },
  { type: "time", label: "Hora", description: "Hora y minutos", group: "numbers" },
  { type: "datetime", label: "Fecha y hora", description: "Día y hora juntos", group: "numbers" },
  { type: "scale", label: "Escala", description: "Puntuación, ej. 1 a 5", group: "numbers" },
  { type: "yesno", label: "Sí / No", description: "Pregunta cerrada", group: "choices" },
  { type: "radio", label: "Opción única", description: "Botones visibles", group: "choices" },
  { type: "select", label: "Lista desplegable", description: "Muchas opciones", group: "choices" },
  { type: "multiselect", label: "Selección múltiple", description: "Varias opciones", group: "choices" },
  { type: "checkbox", label: "Casilla", description: "Aceptar o marcar", group: "choices" },
  { type: "country", label: "País", description: "Lista de países", group: "choices" },
  { type: "id", label: "RUT / DNI", description: "Documento con validación", group: "documents" },
  { type: "file", label: "Archivo", description: "Documento o imagen", group: "documents" },
  { type: "signature", label: "Firma", description: "Firma dibujada", group: "documents" },
  { type: "repeater", label: "Grupo repetible", description: "Ej.: socios", group: "layout" },
  { type: "info", label: "Texto informativo", description: "Título y aclaración", group: "layout" },
];

export const typeLabel = (t: FieldType) => FIELD_TYPES.find((x) => x.type === t)?.label ?? t;

export const ID_KINDS: { value: IdKind; label: string }[] = [
  { value: "rut", label: "RUT (Chile)" },
  { value: "dni", label: "DNI (Perú / Argentina)" },
  { value: "other", label: "Otro documento" },
];

export const CURRENCIES: { value: string; label: string }[] = [
  { value: "CLP", label: "Peso chileno (CLP)" },
  { value: "CLF", label: "Unidad de Fomento (UF)" },
  { value: "PEN", label: "Sol peruano (PEN)" },
  { value: "ARS", label: "Peso argentino (ARS)" },
  { value: "COP", label: "Peso colombiano (COP)" },
  { value: "MXN", label: "Peso mexicano (MXN)" },
  { value: "UYU", label: "Peso uruguayo (UYU)" },
  { value: "BOB", label: "Boliviano (BOB)" },
  { value: "PYG", label: "Guaraní (PYG)" },
  { value: "BRL", label: "Real brasileño (BRL)" },
  { value: "USD", label: "Dólar (USD)" },
  { value: "EUR", label: "Euro (EUR)" },
];

/** ISO 3166-1 alpha-2 codes a country answer may hold. Mirrors api/internal/schema/countries.go. */
export const COUNTRY_CODES = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE
BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD
CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM
DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF
GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU
ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN
KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME
MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA
NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM
PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI
SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK
TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI
VN VU WF WS YE YT ZA ZM ZW`.split(/\s+/);

const COUNTRY_SET = new Set(COUNTRY_CODES);

/** Shown first in country lists, since most applicants come from the region. */
export const FREQUENT_COUNTRIES = ["CL", "PE", "AR", "CO", "MX", "UY", "BO", "EC", "PY", "ES", "US"];

let regionNames: Intl.DisplayNames | undefined;
export function countryName(code: string): string {
  try {
    regionNames ??= new Intl.DisplayNames(["es"], { type: "region" });
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** All countries sorted by Spanish name. */
export function countriesByName(): { code: string; name: string }[] {
  return COUNTRY_CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export const YES_NO = ["Sí", "No"];

export type Address = {
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
};

export const ADDRESS_PARTS: { key: keyof Address; label: string; optional?: boolean }[] = [
  { key: "line1", label: "Calle y número" },
  { key: "line2", label: "Depto., oficina", optional: true },
  { key: "city", label: "Ciudad / comuna" },
  { key: "region", label: "Región / provincia", optional: true },
  { key: "postalCode", label: "Código postal", optional: true },
  { key: "country", label: "País" },
];

export function formatAddress(v: unknown): string {
  if (!v || typeof v !== "object") return "";
  const a = v as Address;
  return [a.line1, a.line2, a.city, a.region, a.postalCode, a.country ? countryName(a.country) : ""]
    .map((x) => (x ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

/** Bounds of a scale field with its defaults. */
export function scaleRange(f: Field): [number, number] {
  return [f.min ?? 1, f.max ?? 5];
}

/** Formats an amount answer like "$ 1.500.000" using the field's currency. */
export function formatAmount(v: unknown, currency?: string): string {
  const n = Number(v);
  if (v === "" || v === null || v === undefined || Number.isNaN(n)) return String(v ?? "");
  try {
    if (currency === "CLF") return `UF ${n.toLocaleString("es-CL", { maximumFractionDigits: 4 })}`;
    return n.toLocaleString("es-CL", { style: "currency", currency: currency || "CLP", maximumFractionDigits: 2 });
  } catch {
    return String(n);
  }
}

/**
 * Answer as plain text for summaries and the admin panel; "" when unanswered. File, repeater
 * and signature answers need their own rendering.
 */
export function formatAnswer(f: Pick<Field, "type" | "currency" | "min" | "max">, v: unknown): string {
  if (f.type === "checkbox" && v === false) return "No";
  if (isEmpty(v)) return "";
  switch (f.type) {
    case "checkbox":
      return v === true ? "Sí" : "No";
    case "date": {
      const [y, m, d] = String(v).split("-");
      return d ? `${d}-${m}-${y}` : String(v);
    }
    case "datetime": {
      const [date, time] = String(v).split("T");
      const [y, m, d] = date.split("-");
      return d && time ? `${d}-${m}-${y} ${time}` : String(v);
    }
    case "currency":
      return formatAmount(v, f.currency);
    case "country":
      return countryName(String(v));
    case "address":
      return formatAddress(v);
    case "scale":
      return `${v} de ${scaleRange(f as Field)[1]}`;
    case "signature":
      return "Firmado";
  }
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

/** Fixed options a field offers, used by conditions and validation. */
export function fieldOptions(f: Field): string[] | undefined {
  if (f.type === "yesno") return YES_NO;
  if (f.type === "select" || f.type === "multiselect" || f.type === "radio") return f.options;
  return undefined;
}

/** Whether the type collects an answer (an info block does not). */
export const hasAnswer = (t: FieldType) => t !== "info";

/** Whether a condition may depend on fields of this type. */
export const conditionable = (t: FieldType) => !["repeater", "file", "address", "signature", "info"].includes(t);

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
  if (type === "select" || type === "multiselect" || type === "radio") f.options = ["Opción 1", "Opción 2"];
  if (type === "currency") f.currency = "CLP";
  if (type === "scale") {
    f.min = 1;
    f.max = 5;
  }
  if (type === "info") {
    f.label = "Antes de continuar";
    f.help = "Escribe aquí una aclaración para el solicitante.";
  }
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
        if (conditionable(f.type)) out.push(f);
      }
    });
  });
  return out;
}

export type Answers = Record<string, unknown>;

function isEmpty(v: unknown): boolean {
  if (v && typeof v === "object" && !Array.isArray(v)) return Object.values(v).every(isEmpty); // address
  return v === undefined || v === null || v === "" || v === false || (Array.isArray(v) && v.length === 0);
}

const SIGNATURE_RE = /^M[\d.]+ [\d.]+(?:[ML][\d.]+ [\d.]+)*$/;
/** Mirrors MaxSignatureLen in api/internal/schema/answers.go. */
export const MAX_SIGNATURE_LEN = 60000;

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
  if (!hasAnswer(f.type)) return null;
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
    case "url":
      if (!/^https?:\/\/[^\s/$.?#][^\s]*$/i.test(String(v))) return "Dirección web no válida (debe empezar con https://)";
      break;
    case "currency": {
      const n = Number(String(v).trim());
      if (String(v).trim() === "" || !Number.isFinite(n)) return "Debe ser un monto";
      if (f.min !== undefined && n < f.min) return `El monto mínimo es ${f.min}`;
      if (f.max !== undefined && n > f.max) return `El monto máximo es ${f.max}`;
      return null;
    }
    case "date":
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v)) || Number.isNaN(Date.parse(String(v)))) return "Fecha no válida";
      break;
    case "time":
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v))) return "Hora no válida";
      break;
    case "datetime":
      if (!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(String(v)) || Number.isNaN(Date.parse(String(v))))
        return "Fecha y hora no válidas";
      break;
    case "scale": {
      const n = Number(v);
      const [lo, hi] = scaleRange(f);
      if (!Number.isInteger(n) || n < lo || n > hi) return `Elige un valor entre ${lo} y ${hi}`;
      return null;
    }
    case "select":
    case "radio":
    case "yesno":
      if (!fieldOptions(f)?.includes(String(v))) return "Opción no válida";
      return null;
    case "multiselect":
      if (Array.isArray(v) && v.some((x) => !f.options?.includes(String(x)))) return "Opción no válida";
      return null;
    case "country":
      return COUNTRY_SET.has(String(v)) ? null : "País no válido";
    case "address": {
      if (typeof v !== "object" || Array.isArray(v)) return "Dirección no válida";
      const a = v as Record<string, unknown>;
      const known = ADDRESS_PARTS.map((p) => p.key as string);
      if (Object.entries(a).some(([k, x]) => !known.includes(k) || typeof x !== "string")) return "Dirección no válida";
      if (!a.line1 || !a.city || !a.country) return "Completa calle, ciudad y país";
      return COUNTRY_SET.has(String(a.country)) ? null : "País no válido";
    }
    case "signature":
      if (String(v).length > MAX_SIGNATURE_LEN || !SIGNATURE_RE.test(String(v))) return "La firma no es válida, vuelve a firmar";
      return null;
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
