// Same-origin proxy to the Go API so the session cookie is first-party for the browser.
const API_URL = process.env.API_URL ?? "http://localhost:8080";

const FORWARD_REQUEST = ["cookie", "authorization", "content-type", "accept", "user-agent"];
const FORWARD_RESPONSE = ["content-type", "content-disposition", "set-cookie", "cache-control", "content-security-policy", "x-content-type-options"];

async function proxy(request: Request, ctx: RouteContext<"/api/v1/[...path]">) {
  const { path } = await ctx.params;
  const url = new URL(request.url);
  const target = `${API_URL}/api/v1/${path.map(encodeURIComponent).join("/")}${url.search}`;

  const headers = new Headers();
  for (const name of FORWARD_REQUEST) {
    const v = request.headers.get(name);
    if (v) headers.set(name, v);
  }
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  let res: Response;
  try {
    res = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return Response.json({ error: "No se pudo conectar con la API" }, { status: 502 });
  }

  const out = new Headers();
  for (const name of FORWARD_RESPONSE) {
    if (name === "set-cookie") {
      for (const c of res.headers.getSetCookie()) out.append("set-cookie", c);
      continue;
    }
    const v = res.headers.get(name);
    if (v) out.set(name, v);
  }
  return new Response(res.body, { status: res.status, headers: out });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
