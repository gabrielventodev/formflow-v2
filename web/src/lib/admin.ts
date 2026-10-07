// Client-side helpers for the admin panel. Requests go through the same-origin
// proxy at /api/v1 so the httpOnly session cookie travels with them.

export type Status = "draft" | "submitted" | "in_review" | "changes_requested" | "approved" | "rejected";

export const STATUS_LABEL: Record<Status, string> = {
  draft: "Borrador",
  submitted: "Enviado",
  in_review: "En revisión",
  changes_requested: "Observado",
  approved: "Aprobado",
  rejected: "Rechazado",
};

export const STATUS_STYLE: Record<Status, string> = {
  draft: "bg-zinc-100 text-zinc-600",
  submitted: "bg-sky-100 text-sky-800",
  in_review: "bg-violet-100 text-violet-800",
  changes_requested: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
};

export type Role = "owner" | "admin" | "reviewer";
export type Me = { id: string; email: string; name: string; organization_id: string; role: Role };

export const ROLE_LABEL: Record<Role, string> = { owner: "Propietario", admin: "Administrador", reviewer: "Revisor" };

// Owners and admins build forms, share links, manage the team and see the activity log.
export function canManage(role: Role): boolean {
  return role === "owner" || role === "admin";
}

export type Member = {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  pending: boolean;
  created_at: string;
  last_login_at: string | null;
};

export type ActivityRow = EventRow & {
  submission: { id: string; applicant: string; form_title: string } | null;
};
export type UserRef = { id: string; name: string; email: string };

export type SubmissionRow = {
  id: string;
  form_id: string;
  form_title: string;
  version_number: number;
  applicant_email: string;
  applicant_name: string;
  status: Status;
  assigned_to: UserRef | null;
  submitted_at: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
  // Pending step of the form's approval flow while the submission is open.
  approval_step: { index: number; total: number; name: string } | null;
};

export type SubmissionList = {
  items: SubmissionRow[];
  total: number;
  page: number;
  page_size: number;
  counts: Partial<Record<Status | "mine", number>>;
};

export type Facets = {
  forms: { id: string; title: string }[];
  reviewers: (UserRef & { role: string })[];
};

export type SchemaField = {
  key: string;
  type: string;
  label?: string;
  help?: string;
  options?: (string | { value: string; label: string })[];
  currency?: string;
  min?: number;
  max?: number;
  fields?: SchemaField[];
};
export type FormSchema = { sections?: { key: string; title?: string; fields?: SchemaField[] }[] };

export type FileRow = { id: string; field_key: string; filename: string; mime_type: string; size_bytes: number; uploaded_at: string };
export type CommentRow = { id: string; field_key: string | null; body: string; author: UserRef; resolved_at: string | null; created_at: string };
export type EventRow = {
  id: number;
  actor_type: "user" | "applicant" | "system";
  actor_name: string;
  action: string;
  from_status: Status | null;
  to_status: Status | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ApprovalStepView = { name: string; approvers: UserRef[] };
export type ApprovalRow = {
  step: number;
  step_name: string;
  user: UserRef;
  comment: string;
  created_at: string;
  invalidated_at: string | null;
};
export type ApprovalState = {
  steps: ApprovalStepView[];
  current: number;
  approvals: ApprovalRow[];
  can_approve: boolean;
  reason?: string;
};

export type LivenessFrameResult = {
  index: number;
  step: number;
  faces: number;
  face_ratio: number;
  yaw: number;
  brightness: number;
  sharpness: number;
  real: number | null;
  similarity: number | null;
  issues: string[];
};
export type LivenessRow = {
  id: string;
  field_key: string;
  steps: string[];
  decision: "pass" | "review" | "retry" | "fail" | "expired" | "error";
  reasons: string[];
  result: {
    scores?: { passive: number | null; consistency: number | null };
    steps?: { index: number; step: string; ok: boolean; frame: number | null }[];
    frames?: LivenessFrameResult[];
    engine?: Record<string, string>;
  } | null;
  frame_steps: number[];
  best_frame: number | null;
  created_at: string;
  completed_at: string | null;
  /** Taken on a phone through the QR shown on a computer. */
  from_phone: boolean;
};

export type SubmissionDetail = {
  approval: ApprovalState | null;
  submission: SubmissionRow;
  data: Record<string, unknown>;
  schema: FormSchema;
  files: FileRow[];
  liveness: LivenessRow[];
  comments: CommentRow[];
  events: EventRow[];
  allowed_transitions: Status[];
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    credentials: "same-origin",
    cache: "no-store",
  });
  if (res.status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/admin/login")) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`/admin/login?next=${next}`);
    throw new ApiError(401, "Inicia sesión");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error ?? `Error ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const dateFmt = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" });

export function formatDate(iso: string | null | undefined): string {
  return iso ? dateFmt.format(new Date(iso)) : "—";
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const ACTION_LABEL: Record<string, string> = {
  created: "Creó el borrador",
  submitted: "Envió el formulario",
  resubmitted: "Reenvió con correcciones",
  review_started: "Tomó el envío para revisión",
  changes_requested: "Pidió correcciones",
  changes_request_withdrawn: "Retiró la observación",
  approved: "Aprobó",
  rejected: "Rechazó",
  reopened: "Reabrió la revisión",
  commented: "Comentó",
  comment_resolved: "Marcó un comentario como resuelto",
  assigned: "Cambió el revisor",
  step_approved: "Aprobó el paso",
  // Portal-side actions (actor_type applicant)
  "submission.created": "Empezó a llenar el formulario",
  "submission.submitted": "Envió el formulario",
  "submission.resubmitted": "Reenvió con correcciones",
  "file.uploaded": "Subió un documento",
  "file.deleted": "Eliminó un documento",
  "liveness.completed": "Hizo la prueba de vida",
  // Team changes (no submission attached)
  "member.invited": "Invitó a",
  "member.link_sent": "Envió un enlace de contraseña a",
  "member.role_changed": "Cambió el rol de",
  "member.deactivated": "Desactivó a",
  "member.reactivated": "Reactivó a",
  "member.updated": "Editó a",
  "form.approval_flow_updated": "Cambió el flujo de aprobación de",
  "organization.updated": "Cambió la marca de la organización",
  "webhook.created": "Creó el webhook",
  "webhook.updated": "Editó el webhook",
  "webhook.deleted": "Eliminó el webhook",
  "webhook.secret_rotated": "Rotó el secreto del webhook",
};

export type Webhook = {
  id: string;
  url: string;
  description: string;
  events: string[];
  include_data: boolean;
  active: boolean;
  secret_hint: string;
  created_at: string;
  secret?: string; // only right after create or rotate
  last_delivery: { status: DeliveryStatus; event: string; at: string } | null;
  failing: number;
};

export type DeliveryStatus = "pending" | "succeeded" | "failed";

export type Delivery = {
  id: string;
  event: string;
  status: DeliveryStatus;
  attempts: number;
  last_status_code: number | null;
  last_error: string;
  created_at: string;
  last_attempt_at: string | null;
  next_attempt_at: string | null;
  payload?: unknown;
};

export const WEBHOOK_EVENT_LABEL: Record<string, string> = {
  "submission.submitted": "Envío recibido",
  "submission.in_review": "En revisión",
  "submission.step_approved": "Paso de aprobación firmado",
  "submission.changes_requested": "Correcciones pedidas",
  "submission.approved": "Aprobado",
  "submission.rejected": "Rechazado",
  ping: "Prueba",
};
