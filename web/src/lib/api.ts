// Server-side calls go straight to the Go API inside the network; the browser uses the public URL.
const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${path} respondió ${res.status}`);
  return res.json() as Promise<T>;
}
