import { ParticipantRoundSelection } from "@/components/participant-round-selection";
import { getAdminTestRoundData } from "@/lib/round-repository";

export const dynamic = "force-dynamic";

type AdminRoundTestPageProps = {
  params: Promise<{ roundId: string }>;
};

export default async function AdminRoundTestPage({ params }: AdminRoundTestPageProps) {
  const { roundId } = await params;
  const data = await getAdminTestRoundData(BigInt(roundId));

  return <ParticipantRoundSelection {...data} />;
}
