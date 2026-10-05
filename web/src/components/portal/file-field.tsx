"use client";

import { FileText, ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import type { Field } from "@/lib/form-schema";
import { ApiError, portal, type UploadedFile } from "@/lib/portal-api";
import { cn } from "@/lib/utils";

const ACCEPT_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "image/*": "imágenes",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
};

export function acceptsFile(accept: string[] | undefined, file: File): boolean {
  if (!accept || accept.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return accept.some((raw) => {
    const a = raw.trim().toLowerCase();
    if (a.startsWith(".")) return name.endsWith(a);
    if (a.endsWith("/*")) return type.startsWith(a.slice(0, -1));
    return a === type;
  });
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Upload box for a file field: drag and drop, progress, preview and delete. */
export function FileField({
  token,
  field,
  path,
  files,
  disabled,
  onUploaded,
  onDeleted,
}: {
  token: string;
  field: Field;
  path: string;
  files: UploadedFile[];
  disabled?: boolean;
  onUploaded: (f: UploadedFile) => void;
  onDeleted: (id: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  const upload = async (list: FileList | null) => {
    if (!list || list.length === 0 || disabled) return;
    setError("");
    for (const file of Array.from(list)) {
      if (!acceptsFile(field.accept, file)) {
        setError(`"${file.name}" no es de un tipo permitido.`);
        continue;
      }
      if (field.maxMb && file.size > field.maxMb * 1024 * 1024) {
        setError(`"${file.name}" supera el máximo de ${field.maxMb} MB.`);
        continue;
      }
      try {
        setProgress(0);
        onUploaded(await portal.upload(token, path, file, setProgress));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "No pudimos subir el archivo.");
      } finally {
        setProgress(null);
      }
    }
    if (input.current) input.current.value = "";
  };

  const remove = async (id: string) => {
    try {
      await portal.deleteFile(token, id);
      onDeleted(id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No pudimos eliminar el archivo.");
    }
  };

  const accepted = field.accept?.map((a) => ACCEPT_LABELS[a] ?? a).join(", ");

  return (
    <div className="space-y-2">
      {files.map((f) => (
        <FileRow key={f.id} token={token} file={f} disabled={disabled} onDelete={() => remove(f.id)} />
      ))}
      {!disabled && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => input.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void upload(e.dataTransfer.files);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed border-zinc-300 bg-white px-4 py-5 text-center text-sm text-zinc-600 transition-colors hover:border-zinc-500",
            dragging && "border-zinc-900 bg-zinc-50",
          )}
        >
          {progress !== null ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
              <span>Subiendo… {progress}%</span>
              <div className="mt-1 h-1 w-40 rounded-full bg-zinc-200">
                <div className="h-1 rounded-full bg-zinc-900" style={{ width: `${progress}%` }} />
              </div>
            </>
          ) : (
            <>
              <Upload className="h-5 w-5 text-zinc-500" />
              <span>
                <span className="font-medium text-zinc-900">Elige un archivo</span> o arrástralo aquí
              </span>
              <span className="text-xs text-zinc-500">
                {[accepted, field.maxMb && `máximo ${field.maxMb} MB`].filter(Boolean).join(" · ")}
              </span>
            </>
          )}
          <input
            ref={input}
            type="file"
            multiple
            className="hidden"
            accept={field.accept?.join(",")}
            onChange={(e) => void upload(e.target.files)}
          />
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function FileRow({
  token,
  file,
  disabled,
  onDelete,
}: {
  token: string;
  file: UploadedFile;
  disabled?: boolean;
  onDelete: () => void;
}) {
  const isImage = file.mimeType.startsWith("image/");
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    if (!isImage) return;
    let url: string | null = null;
    let cancelled = false;
    portal
      .fileBlob(token, file.id)
      .then((b) => {
        if (cancelled) return;
        url = URL.createObjectURL(b);
        setThumb(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [token, file.id, isImage]);

  const open = async () => {
    // Open the tab synchronously so pop-up blockers allow it, then point it at the blob.
    const tab = window.open("", "_blank");
    try {
      const blob = await portal.fileBlob(token, file.id);
      const url = URL.createObjectURL(blob);
      if (tab) tab.location.href = url;
      else window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      tab?.close();
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-md border border-zinc-200 bg-white p-2">
      <button
        type="button"
        onClick={open}
        className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded bg-zinc-100"
        title="Ver archivo"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- blob URL preview */}
        {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : isImage ? <ImageIcon className="h-5 w-5 text-zinc-400" /> : <FileText className="h-5 w-5 text-zinc-500" />}
      </button>
      <div className="min-w-0 flex-1">
        <button type="button" onClick={open} className="block max-w-full truncate text-left text-sm font-medium hover:underline">
          {file.filename}
        </button>
        <p className="text-xs text-zinc-500">{formatSize(file.sizeBytes)}</p>
      </div>
      {!disabled && (
        <Button size="sm" variant="danger" onClick={onDelete} aria-label={`Eliminar ${file.filename}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
