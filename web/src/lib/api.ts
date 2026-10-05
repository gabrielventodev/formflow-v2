import type { FormSchema, Problem } from "./form-schema";

// Server-side calls go straight to the Go API inside the network. The browser goes through the
// same-origin proxy (app/api/v1) so the admin session cookie is first-party.
const API_URL =
  typeof window === "undefined" ? (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080") : "";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public problems: Problem[] = [],
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    cache: "no-store",
    credentials: "include",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/admin/login")) {
    window.location.replace(`/admin/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.error ?? `La API respondió ${res.status}`, res.status, data?.problems ?? []);
  }
  return data as T;
}

export const apiGet = <T,>(path: string) => request<T>("GET", path);
export const apiPost = <T,>(path: string, body?: unknown) => request<T>("POST", path, body ?? {});
export const apiPatch = <T,>(path: string, body: unknown) => request<T>("PATCH", path, body);
export const apiDelete = (path: string) => request<void>("DELETE", path);

export type FormStatus = "draft" | "published" | "archived";

export type VersionInfo = { id: string; number: number; publishedAt: string };

export type FormSummary = {
  id: string;
  title: string;
  description: string;
  status: FormStatus;
  currentVersion: VersionInfo | null;
  hasUnpublishedChanges: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FormDetail = FormSummary & { schema: FormSchema };

export type FormVersion = VersionInfo & { schema: FormSchema };

export const formsPath = "/api/v1/admin/forms";
