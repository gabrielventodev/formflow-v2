"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { adminFetch, ApiError, ROLE_LABEL, type ApprovalStepView, type Member } from "@/lib/admin";

const MAX_STEPS = 5;

type Step = { name: string; approvers: string[] };

const toSteps = (views: ApprovalStepView[]): Step[] => views.map((v) => ({ name: v.name, approvers: v.approvers.map((a) => a.id) }));

// Approval flow of one form: ordered steps, each signed off by its approvers (or anyone when none are set).
export default function ApprovalFlowPage() {
  const { id } = useParams<{ id: string }>();
  const [title, setTitle] = useState("");
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [saved, setSaved] = useState<string>("");
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    Promise.all([
      adminFetch<{ title: string }>(`/admin/forms/${id}`),
      adminFetch<{ steps: ApprovalStepView[] }>(`/admin/forms/${id}/approval-flow`),
      adminFetch<Member[]>("/admin/team"),
    ]).then(
      ([form, flow, team]) => {
        setTitle(form.title);
        const s = toSteps(flow.steps);
        setSteps(s);
        setSaved(JSON.stringify(s));
        setMembers(team.filter((m) => m.active));
      },
      (e) => setError(e.message),
    );
  }, [id]);

  if (!steps) {
    return <p className="p-6 text-sm text-zinc-500">{error || "Cargando…"}</p>;
  }

  const dirty = JSON.stringify(steps) !== saved;
  const update = (i: number, patch: Partial<Step>) => setSteps(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: number) => {
    const next = [...steps];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setSteps(next);
  };
  const name = (uid: string) => {
    const m = members.find((x) => x.id === uid);
    return m ? m.name || m.email : "";
  };
  // Four eyes needs a different person per step; warn when the team is too small.
  const tooFewPeople = steps.length > 1 && members.length < steps.length;

  async function save() {
    if (!steps) return;
    setPending(true);
    setError("");
    setNotice("");
    try {
      const res = await adminFetch<{ steps: ApprovalStepView[] }>(`/admin/forms/${id}/approval-flow`, {
        method: "PUT",
        body: JSON.stringify({ steps: steps.map((s) => ({ ...s, name: s.name.trim() })) }),
      });
      const s = toSteps(res.steps);
      setSteps(s);
      setSaved(JSON.stringify(s));
      setNotice(s.length ? "Flujo guardado. Aplica a los envíos que se aprueben desde ahora." : "Sin pasos: aprobar vuelve a ser un solo clic.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo guardar");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-6">
      <Link href="/admin/forms" className="text-sm text-zinc-500 hover:underline">← Formularios</Link>
      <div>
        <h1 className="text-xl font-semibold">Flujo de aprobación</h1>
        <p className="text-sm text-zinc-500">
          {title}. Cada envío pasa por estos pasos en orden; queda aprobado cuando firma el último.
        </p>
      </div>

      {steps.length > 0 && (
        <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Resumen del flujo">
          {steps.map((s, i) => (
            <li key={i} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden className="text-zinc-400">→</span>}
              <span className="rounded-full bg-zinc-900 px-3 py-1 text-white">{s.name || `Paso ${i + 1}`}</span>
            </li>
          ))}
          <li className="flex items-center gap-2">
            <span aria-hidden className="text-zinc-400">→</span>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">Aprobado</span>
          </li>
        </ol>
      )}

      <div className="space-y-3">
        {steps.map((s, i) => (
          <section key={i} className="card space-y-3 p-4">
            <div className="flex items-center gap-2">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-zinc-100 text-sm font-medium">{i + 1}</span>
              <input
                aria-label={`Nombre del paso ${i + 1}`}
                value={s.name}
                maxLength={80}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder="Nombre del paso, p. ej. Cumplimiento"
                className="input flex-1"
              />
              <button className="btn !px-2" aria-label="Subir paso" disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp className="size-4" aria-hidden />
              </button>
              <button className="btn !px-2" aria-label="Bajar paso" disabled={i === steps.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown className="size-4" aria-hidden />
              </button>
              <button className="btn !px-2 !text-rose-700" aria-label="Quitar paso" onClick={() => setSteps(steps.filter((_, j) => j !== i))}>
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
            <fieldset>
              <legend className="mb-1 text-xs font-medium text-zinc-700">
                Quién aprueba este paso{" "}
                <span className="font-normal text-zinc-500">
                  {s.approvers.length === 0 ? "(nadie marcado: cualquier miembro del equipo)" : `(${s.approvers.map(name).join(", ")} o un propietario)`}
                </span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => {
                  const checked = s.approvers.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm ${checked ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"}`}
                    >
                      <input
                        type="checkbox"
                        className="accent-zinc-900"
                        checked={checked}
                        onChange={() =>
                          update(i, { approvers: checked ? s.approvers.filter((a) => a !== m.id) : [...s.approvers, m.id] })
                        }
                      />
                      {m.name || m.email}
                      <span className="text-xs text-zinc-500">{ROLE_LABEL[m.role]}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </section>
        ))}

        {steps.length === 0 && (
          <p className="card p-6 text-center text-sm text-zinc-500">
            Sin pasos configurados: cualquier miembro aprueba un envío con un clic.
          </p>
        )}

        {steps.length < MAX_STEPS && (
          <button className="btn" onClick={() => setSteps([...steps, { name: "", approvers: [] }])}>
            <Plus className="size-4" aria-hidden /> Agregar paso
          </button>
        )}
      </div>

      <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600">
        <li>Con dos o más pasos, una misma persona firma como máximo un paso.</li>
        <li>Pedir correcciones o reabrir una decisión hace que el envío vuelva al primer paso.</li>
      </ul>
      {tooFewPeople && (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          El equipo tiene {members.length} {members.length === 1 ? "persona activa" : "personas activas"} y el flujo {steps.length} pasos: no alcanzará para firmar todos. <Link href="/admin/equipo" className="underline">Invita a alguien</Link>.
        </p>
      )}

      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={!dirty || pending} onClick={save}>
          {pending ? "Guardando…" : "Guardar flujo"}
        </button>
        {dirty && (
          <button className="btn" onClick={() => setSteps(JSON.parse(saved))}>
            Descartar cambios
          </button>
        )}
      </div>
    </div>
  );
}
