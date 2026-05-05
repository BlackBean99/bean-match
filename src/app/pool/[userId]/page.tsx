import { ParticipantExposureHub } from "@/components/participant-exposure-hub";
import { getParticipantExposureData } from "@/lib/auto-exposure-repository";

export const dynamic = "force-dynamic";

type ParticipantPoolPageProps = {
  params: Promise<{ userId: string }>;
};

export default async function ParticipantPoolPage({ params }: ParticipantPoolPageProps) {
  const { userId } = await params;
  const data = await getParticipantExposureData(BigInt(userId));

  return <ParticipantExposureHub {...data} />;
}
