import { StartForm } from "@/components/portal/start-form";

export const metadata = { title: "Completar formulario · FormFlow" };

export default async function FormLinkPage({ params }: PageProps<"/f/[token]">) {
  const { token } = await params;
  return <StartForm linkToken={token} />;
}
