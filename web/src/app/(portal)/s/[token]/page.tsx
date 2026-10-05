import { Portal } from "@/components/portal/portal";

export const metadata = { title: "Tu solicitud · FormFlow" };

export default async function SubmissionPage({ params }: PageProps<"/s/[token]">) {
  const { token } = await params;
  return <Portal token={token} />;
}
