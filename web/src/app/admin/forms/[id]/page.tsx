import { Builder } from "@/components/builder/builder";

export default async function FormBuilderPage({ params }: PageProps<"/admin/forms/[id]">) {
  const { id } = await params;
  return <Builder formId={id} />;
}
