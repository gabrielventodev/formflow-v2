// Organization branding for the applicant portal (name, color, logo), read server-side.
export type Branding = {
  name: string;
  primary_color: string;
  support_email: string;
  logo_url: string | null;
};

export const DEFAULT_BRANDING: Branding = { name: "FormFlow", primary_color: "#18181b", support_email: "", logo_url: null };

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export async function getBranding(): Promise<Branding> {
  try {
    const res = await fetch(`${API_URL}/api/v1/branding`, { cache: "no-store" });
    if (!res.ok) return DEFAULT_BRANDING;
    const b = (await res.json()) as Branding;
    return { ...DEFAULT_BRANDING, ...b, name: b.name || DEFAULT_BRANDING.name };
  } catch {
    return DEFAULT_BRANDING; // API down: the portal still renders with the default look
  }
}
