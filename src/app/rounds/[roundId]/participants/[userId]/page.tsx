import { notFound } from "next/navigation";
import { ParticipantRoundSelection } from "@/components/participant-round-selection";
import { getParticipantRoundData } from "@/lib/round-repository";

export const dynamic = "force-dynamic";

type ParticipantRoundPageProps = {
  params: Promise<{ roundId: string; userId: string }>;
};

export default async function ParticipantRoundPage({ params }: ParticipantRoundPageProps) {
  const { roundId, userId } = await params;
  const data = await getParticipantRoundData(BigInt(roundId), BigInt(userId));

  if (!data.actor && !data.loadError) notFound();

  return <ParticipantRoundSelection {...data} />;
}
