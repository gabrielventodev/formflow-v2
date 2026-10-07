import { PhoneLiveness } from "@/components/portal/phone-liveness";

export const metadata = { title: "Verificación con cámara · FormFlow" };

// Opened on a phone from the QR the portal shows on a computer.
export default async function PhoneLivenessPage({ params }: PageProps<"/v/[token]">) {
  const { token } = await params;
  return <PhoneLiveness token={token} />;
}
