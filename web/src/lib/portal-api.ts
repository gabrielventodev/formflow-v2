// Browser client for the public portal API (/api/v1/portal). The access token travels in a header, never in API URLs.
import type { Answers, FormSchema } from "./form-schema";

export type Errors = Record<string, string>;

export const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const BASE = `${PUBLIC_API_URL}/api/v1/portal`;

export type Status = "draft" | "submitted" | "in_review" | "changes_requested" | "approved" | "rejected";

export type LinkInfo = {
  form: { title: string; description: string };
  kind: "public" | "invite";
  inviteeEmail: string | null;
  schema: FormSchema;
};

export type UploadedFile = {
  id: string;
  fieldKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
};

/** A finished liveness attempt; "pass" and "review" complete the field. */
export type LivenessDecision = "pass" | "review" | "retry" | "fail" | "expired" | "error";
export type LivenessAttempt = {
  id: string;
  fieldKey: string;
  decision: LivenessDecision;
  reasons: string[];
  completedAt: string | null;
};
export type LivenessStep = "center" | "left" | "right" | "closer";
export type LivenessChallenge = {
  id: string;
  steps: LivenessStep[];
  stepMs: number;
  framesPerStep: number;
  expiresAt: string;
  attemptsLeft: number;
};
export type LivenessResult = {
  id: string;
  fieldKey: string;
  decision: LivenessDecision;
  reasons: string[];
  completed: boolean;
  attemptsLeft: number;
};

export const livenessCompleted = (d: LivenessDecision) => d === "pass" || d === "review";

export type ReviewComment = { id: string; fieldKey: string | null; body: string; createdAt: string };

export type SubmissionView = {
  id: string;
  form: { title: string; description: string };
  applicant: { email: string; name: string };
  status: Status;
  data: Answers;
  schema: FormSchema;
  files: UploadedFile[];
  liveness: LivenessAttempt[];
  comments: ReviewComment[];
  canEdit: boolean;
  editableFields: string[] | null;
  submittedAt: string | null;
  updatedAt: string;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors: Errors = {},
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers, cache: "no-store" });
  } catch {
    throw new ApiError(0, "No pudimos conectarnos. Revisa tu conexión e intenta de nuevo.");
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? `Error ${res.status}`, body.errors ?? {});
  return body as T;
}

export const portal = {
  link: (linkToken: string) => request<LinkInfo>(`/links/${encodeURIComponent(linkToken)}`),
  start: (linkToken: string, email: string, name: string) =>
    request<{ accessToken: string; submissionId: string }>(`/links/${encodeURIComponent(linkToken)}/start`, {
      method: "POST",
      body: JSON.stringify({ email, name }),
    }),
  resume: (email: string) => request<void>(`/resume`, { method: "POST", body: JSON.stringify({ email }) }),
  get: (token: string) => request<SubmissionView>(`/submission`, { token }),
  save: (token: string, data: Answers) =>
    request<{ savedAt: string }>(`/submission/data`, { method: "PUT", token, body: JSON.stringify({ data }) }),
  submit: (token: string, data: Answers) =>
    request<{ status: Status }>(`/submission/submit`, { method: "POST", token, body: JSON.stringify({ data }) }),
  livenessChallenge: (token: string, fieldKey: string) =>
    request<LivenessChallenge>(`/submission/liveness`, { method: "POST", token, body: JSON.stringify({ fieldKey }) }),
  livenessFinish: (token: string, id: string, frames: { step: number; blob: Blob }[]) => {
    const form = new FormData();
    form.append("frameSteps", JSON.stringify(frames.map((f) => f.step)));
    frames.forEach((f, i) => form.append("frames", f.blob, `${i}.jpg`));
    return request<LivenessResult>(`/submission/liveness/${id}`, { method: "POST", token, body: form });
  },
  deleteFile: (token: string, id: string) => request<void>(`/submission/files/${id}`, { method: "DELETE", token }),

  async fileBlob(token: string, id: string): Promise<Blob> {
    const res = await fetch(`${BASE}/submission/files/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new ApiError(res.status, "No pudimos abrir el archivo.");
    return res.blob();
  },

  /** Uploads with XHR so the portal can show progress. */
  upload(token: string, fieldKey: string, file: File, onProgress: (pct: number) => void): Promise<UploadedFile> {
    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.append("fieldKey", fieldKey);
      form.append("file", file);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${BASE}/submission/files`);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => {
        let body: { error?: string } & Partial<UploadedFile> = {};
        try {
          body = JSON.parse(xhr.responseText);
        } catch {}
        if (xhr.status >= 200 && xhr.status < 300) resolve(body as UploadedFile);
        else reject(new ApiError(xhr.status, body.error ?? "No pudimos subir el archivo."));
      };
      xhr.onerror = () => reject(new ApiError(0, "No pudimos subir el archivo. Revisa tu conexión."));
      xhr.send(form);
    });
  },
};

export const statusLabel: Record<Status, string> = {
  draft: "Borrador",
  submitted: "Enviada",
  in_review: "En revisión",
  changes_requested: "Requiere correcciones",
  approved: "Aprobada",
  rejected: "Rechazada",
};
