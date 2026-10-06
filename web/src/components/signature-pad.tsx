"use client";

import { useRef, useState, type PointerEvent } from "react";
import { Button } from "@/components/ui";
import { MAX_SIGNATURE_LEN } from "@/lib/form-schema";
import { cn } from "@/lib/utils";

// Signatures are stored as SVG path data in this coordinate space, so they stay small and
// render crisply anywhere (review screen, admin panel) without storing an image.
const W = 600;
const H = 200;

export function SignatureView({ path, className }: { path: string; className?: string }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn("h-auto w-full", className)} role="img" aria-label="Firma">
      <path d={path} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Pad where the applicant draws a signature with mouse, finger or pen. */
export function SignaturePad({
  id,
  value,
  onChange,
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (path: string) => void;
  disabled?: boolean;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const path = draft ?? value;

  const point = (e: PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    const x = Math.min(W, Math.max(0, ((e.clientX - r.left) / r.width) * W));
    const y = Math.min(H, Math.max(0, ((e.clientY - r.top) / r.height) * H));
    return `${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10}`;
  };

  const down = (e: PointerEvent<SVGSVGElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraft(`${value}M${point(e)}`);
  };
  const moveTo = (e: PointerEvent) => {
    if (draft === null) return;
    const next = `${draft}L${point(e)}`;
    if (next.length <= MAX_SIGNATURE_LEN) setDraft(next);
  };
  const up = () => {
    if (draft === null) return;
    // A tap without movement leaves a lone move command; draw it as a dot.
    const done = /M[\d.]+ [\d.]+$/.test(draft) ? draft.replace(/M([\d.]+) ([\d.]+)$/, "M$1 $2L$1 $2") : draft;
    setDraft(null);
    onChange(done.length <= MAX_SIGNATURE_LEN ? done : value);
  };

  return (
    <div>
      <div
        className={cn(
          "relative rounded-md border border-zinc-300 bg-white text-zinc-900",
          disabled ? "bg-zinc-50" : "focus-within:border-zinc-900",
        )}
      >
        <svg
          id={id}
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          className={cn("block h-auto w-full touch-none select-none", disabled ? "cursor-not-allowed" : "cursor-crosshair")}
          onPointerDown={down}
          onPointerMove={moveTo}
          onPointerUp={up}
          onPointerCancel={up}
          role="img"
          aria-label="Área de firma"
        >
          <line x1={24} x2={W - 24} y1={H - 40} y2={H - 40} stroke="#d4d4d8" strokeDasharray="4 4" />
          {path && <path d={path} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}
        </svg>
        {!path && (
          <span className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-zinc-400">
            Firma aquí con el mouse o el dedo
          </span>
        )}
      </div>
      <div className="mt-1 flex justify-end">
        <Button size="sm" variant="ghost" disabled={disabled || !value} onClick={() => onChange("")}>
          Borrar firma
        </Button>
      </div>
    </div>
  );
}
