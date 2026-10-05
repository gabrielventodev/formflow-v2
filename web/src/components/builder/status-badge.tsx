import { Badge } from "@/components/ui";
import type { FormSummary } from "@/lib/api";

export function StatusBadge({ form }: { form: FormSummary }) {
  if (form.status === "archived") return <Badge>Archivado</Badge>;
  if (form.status === "draft") return <Badge tone="amber">Borrador</Badge>;
  return (
    <span className="inline-flex gap-1">
      <Badge tone="green">Publicado · v{form.currentVersion?.number}</Badge>
      {form.hasUnpublishedChanges && <Badge tone="amber">Cambios sin publicar</Badge>}
    </span>
  );
}
