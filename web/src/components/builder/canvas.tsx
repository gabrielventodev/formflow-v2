"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, GitBranch, GripVertical, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, Button } from "@/components/ui";
import { typeLabel, type FormSchema } from "@/lib/form-schema";
import { cn } from "@/lib/utils";
import { move, moveField, type Selection } from "./ops";

// Sortable ids encode positions: "s:1" is section 1, "f:1:3" is field 3 of section 1.
const parseId = (id: string | number) => String(id).split(":").slice(1).map(Number);

export function Canvas({
  schema,
  sel,
  problemPaths,
  onSelect,
  onChange,
  onAddSection,
  onRemoveSection,
  onRemoveField,
  onDuplicateField,
}: {
  schema: FormSchema;
  sel: Selection;
  problemPaths: Set<string>;
  onSelect: (sel: Selection) => void;
  onChange: (schema: FormSchema, sel: Selection) => void;
  onAddSection: () => void;
  onRemoveSection: (s: number) => void;
  onRemoveField: (sel: Selection) => void;
  onDuplicateField: (sel: Selection) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const a = String(active.id);
    const o = String(over.id);
    if (a.startsWith("s:") && o.startsWith("s:")) {
      const [from] = parseId(a);
      const [to] = parseId(o);
      onChange({ sections: move(schema.sections, from, to) }, { s: to });
      return;
    }
    if (a.startsWith("f:")) {
      const [fs, ff] = parseId(a);
      // Dropping on a section header appends the field to that section.
      const [ts, tf] = o.startsWith("f:") ? parseId(o) : [parseId(o)[0], schema.sections[parseId(o)[0]].fields.length];
      onChange(moveField(schema, { s: fs, f: ff }, { s: ts, f: tf }), { s: ts, f: Math.min(tf, schema.sections[ts].fields.length - (fs === ts ? 1 : 0)) });
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={schema.sections.map((_, i) => `s:${i}`)} strategy={verticalListSortingStrategy}>
        <div className="space-y-4">
          {schema.sections.map((sec, si) => (
            <SortableRow key={`s:${si}`} id={`s:${si}`}>
              {(handle) => (
                <section
                  className={cn(
                    "rounded-lg border bg-white",
                    sel?.s === si && sel.f === undefined ? "border-zinc-900 ring-1 ring-zinc-900" : "border-zinc-200",
                  )}
                >
                  <header
                    className="flex cursor-pointer items-center gap-2 border-b border-zinc-100 px-3 py-2"
                    onClick={() => onSelect({ s: si })}
                  >
                    {handle}
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">Paso {si + 1}</span>
                    <span className={cn("font-medium", problemPaths.has(`sections[${si}].title`) && "text-red-600")}>
                      {sec.title || "Sin título"}
                    </span>
                    {sec.showIf && (
                      <Badge tone="blue">
                        <GitBranch className="mr-1 h-3 w-3" />
                        Condicional
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="danger"
                      className="ml-auto"
                      aria-label="Eliminar sección"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (sec.fields.length === 0 || confirm(`¿Eliminar la sección "${sec.title}" y sus campos?`)) onRemoveSection(si);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </header>
                  <SortableContext items={sec.fields.map((_, fi) => `f:${si}:${fi}`)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-1.5 p-3">
                      {sec.fields.length === 0 && (
                        <div className="rounded-md border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500">
                          Agrega campos desde el panel de la izquierda o arrástralos aquí.
                        </div>
                      )}
                      {sec.fields.map((f, fi) => {
                        const selected = sel?.s === si && sel.f === fi;
                        const hasProblem = [...problemPaths].some((p) => p.startsWith(`sections[${si}].fields[${fi}]`));
                        return (
                          <SortableRow key={`f:${si}:${fi}`} id={`f:${si}:${fi}`}>
                            {(handle) => (
                              <div
                                onClick={() => onSelect({ s: si, f: fi })}
                                className={cn(
                                  "group flex cursor-pointer items-center gap-2 rounded-md border px-2 py-2",
                                  selected ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-400",
                                  hasProblem && !selected && "border-red-300",
                                )}
                              >
                                {handle}
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-medium">
                                    {f.label || <span className="text-zinc-400">Sin etiqueta</span>}
                                    {f.required && <span className="text-red-600"> *</span>}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                                    <span>{typeLabel(f.type)}</span>
                                    <span className="font-mono text-zinc-400">{f.key}</span>
                                    {f.type === "repeater" && <span>· {f.fields?.length ?? 0} campos</span>}
                                  </div>
                                </div>
                                {f.showIf && (
                                  <Badge tone="blue">
                                    <GitBranch className="mr-1 h-3 w-3" />
                                    Condicional
                                  </Badge>
                                )}
                                {hasProblem && <Badge tone="amber">Revisar</Badge>}
                                <div className="flex opacity-0 group-hover:opacity-100">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    aria-label="Duplicar campo"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDuplicateField({ s: si, f: fi });
                                    }}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="danger"
                                    aria-label="Eliminar campo"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onRemoveField({ s: si, f: fi });
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </SortableRow>
                        );
                      })}
                    </div>
                  </SortableContext>
                </section>
              )}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
      <Button className="mt-4 w-full border-dashed" onClick={onAddSection}>
        <Plus className="h-4 w-4" /> Agregar sección (paso)
      </Button>
    </DndContext>
  );
}

function SortableRow({ id, children }: { id: string; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle = (
    <button
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => e.stopPropagation()}
      className="cursor-grab touch-none rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 active:cursor-grabbing"
      aria-label="Arrastrar para reordenar"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(isDragging && "relative z-10 opacity-80 shadow-lg")}
    >
      {children(handle)}
    </div>
  );
}
