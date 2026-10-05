import { LinksManager } from "@/components/portal/links-manager";

export default async function FormLinksPage({ params }: PageProps<"/admin/forms/[id]/enlaces">) {
  const { id } = await params;
  return <LinksManager formId={id} />;
}
