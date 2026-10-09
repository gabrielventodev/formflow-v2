"use client";

import { useEffect, useRef, useState } from "react";
import { adminFetch, ApiError } from "@/lib/admin";
import type { Branding } from "@/lib/branding";

// WCAG contrast of white text over a #rrggbb color (same rule the API enforces).
function contrastWithWhite(hex: string): number {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return 0;
  const lin = (i: number) => {
    const s = parseInt(hex.slice(i, i + 2), 16) / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5);
  return 1.05 / (l + 0.05);
}

const PRESETS = ["#0f1c2e", "#1d4ed8", "#0f766e", "#15803d", "#b91c1c", "#7c3aed", "#c2410c", "#0e7490"];

export default function BrandingPage() {
  const [saved, setSaved] = useState<Branding | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#0f1c2e");
  const [support, setSupport] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function apply(b: Branding) {
    setSaved(b);
    setName(b.name);
    setColor(b.primary_color);
    setSupport(b.support_email);
  }

  useEffect(() => {
    adminFetch<Branding>("/admin/organization").then(apply, (e) => setError(e.message));
  }, []);

  if (!saved) return <p className="p-6 text-sm text-zinc-500">{error || "Cargando…"}</p>;

  const ratio = contrastWithWhite(color);
  const readable = ratio >= 4.5;
  const dirty = name !== saved.name || color.toLowerCase() !== saved.primary_color || support !== saved.support_email;

  async function run(fn: () => Promise<Branding>, done: string) {
    setPending(true);
    setError("");
    setNotice("");
    try {
      apply(await fn());
      setNotice(done);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo guardar");
    } finally {
      setPending(false);
    }
  }

  const save = () =>
    run(
      () =>
        adminFetch<Branding>("/admin/organization", {
          method: "PUT",
          body: JSON.stringify({ name, primary_color: color, support_email: support }),
        }),
      "Marca guardada. El portal y los próximos correos ya la usan.",
    );

  async function uploadLogo(file: File) {
    const body = new FormData();
    body.append("file", file);
    await run(async () => {
      const res = await fetch("/api/v1/admin/organization/logo", { method: "POST", body, credentials: "same-origin" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(res.status, data?.error ?? `Error ${res.status}`);
      return data as Branding;
    }, "Logo actualizado.");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Marca</h1>
          <p className="text-sm text-zinc-500">Cómo ven los solicitantes el portal y los correos.</p>
        </div>

        <section className="card space-y-4 p-4">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-700">Nombre de la organización</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="input w-full" />
          </label>

          <fieldset>
            <legend className="mb-1 text-xs font-medium text-zinc-700">Color principal (botones, barra de progreso, correos)</legend>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="color"
                aria-label="Elegir color"
                value={/^#[0-9a-f]{6}$/i.test(color) ? color : "#000000"}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-zinc-300 bg-white p-0.5"
              />
              <input
                aria-label="Color en hexadecimal"
                value={color}
                onChange={(e) => setColor(e.target.value.trim())}
                className="input w-28 font-mono"
                maxLength={7}
              />
              {PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Usar ${c}`}
                  onClick={() => setColor(c)}
                  className={`size-7 rounded-full border-2 ${color.toLowerCase() === c ? "border-zinc-400" : "border-white"} shadow-sm`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <p className={`mt-1.5 text-xs ${readable ? "text-zinc-500" : "text-rose-600"}`}>
              {ratio === 0
                ? "Usa el formato #RRGGBB."
                : readable
                  ? `Contraste con texto blanco ${ratio.toFixed(1)}:1, se lee bien.`
                  : `Contraste ${ratio.toFixed(1)}:1: el texto blanco de los botones no se leería. Elige un color más oscuro (mínimo 4,5:1).`}
            </p>
          </fieldset>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-700">
              Email de contacto <span className="font-normal text-zinc-500">(opcional, aparece en el portal y los correos)</span>
            </span>
            <input type="email" value={support} onChange={(e) => setSupport(e.target.value)} placeholder="ayuda@empresa.com" className="input w-full" />
          </label>

          <div className="flex gap-2">
            <button className="btn-primary" disabled={!dirty || !readable || pending} onClick={save}>
              {pending ? "Guardando…" : "Guardar"}
            </button>
            {dirty && (
              <button className="btn" onClick={() => apply(saved)}>
                Descartar cambios
              </button>
            )}
          </div>
        </section>

        <section className="card space-y-3 p-4">
          <h2 className="font-medium">Logo</h2>
          <p className="text-sm text-zinc-500">PNG, JPG o WebP de hasta 1 MB. Se muestra con 32 px de alto en el portal y 40 px en los correos; mejor si es horizontal y con fondo transparente.</p>
          <div className="flex flex-wrap items-center gap-3">
            {saved.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={saved.logo_url} alt="Logo actual" className="h-10 max-w-48 rounded border border-zinc-200 bg-white object-contain p-1" />
            ) : (
              <span className="text-sm text-zinc-500">Sin logo: se muestra el nombre.</span>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
            />
            <button className="btn" disabled={pending} onClick={() => fileRef.current?.click()}>
              {saved.logo_url ? "Cambiar logo" : "Subir logo"}
            </button>
            {saved.logo_url && (
              <button
                className="btn !text-rose-700"
                disabled={pending}
                onClick={() => run(() => adminFetch<Branding>("/admin/organization/logo", { method: "DELETE" }), "Logo quitado.")}
              >
                Quitar
              </button>
            )}
          </div>
        </section>

        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
      </div>

      <aside className="space-y-2">
        <h2 className="text-sm font-medium text-zinc-500">Vista previa del portal</h2>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 shadow-sm">
          <div className="h-1" style={{ background: readable ? color : saved.primary_color }} />
          <div className="flex h-12 items-center border-b border-zinc-200 bg-white px-4">
            {saved.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={saved.logo_url} alt="" className="h-7 max-w-40 object-contain" />
            ) : (
              <span className="text-sm font-semibold">{name || "Tu organización"}</span>
            )}
          </div>
          <div className="space-y-3 p-4">
            <div className="h-1.5 rounded-full bg-zinc-200">
              <div className="h-1.5 w-2/5 rounded-full" style={{ background: readable ? color : saved.primary_color }} />
            </div>
            <p className="text-sm font-medium">Datos de la empresa</p>
            <div className="h-8 rounded-md border border-zinc-300 bg-white" />
            <div className="h-8 rounded-md border border-zinc-300 bg-white" />
            <span
              className="inline-flex h-9 items-center rounded-md px-3.5 text-sm font-medium text-white"
              style={{ background: readable ? color : saved.primary_color }}
            >
              Continuar
            </span>
          </div>
          {support && <p className="pb-3 text-center text-xs text-zinc-500">¿Dudas? Escríbenos a {support}</p>}
        </div>
      </aside>
    </div>
  );
}
