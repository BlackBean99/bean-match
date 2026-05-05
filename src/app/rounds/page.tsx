import { AdminShell } from "@/components/admin-shell";
import { RoundDashboard } from "@/components/round-dashboard";
import { getRoundDashboardData } from "@/lib/round-repository";

export const dynamic = "force-dynamic";

export default async function RoundsPage() {
  const data = await getRoundDashboardData();

  return (
    <AdminShell
      title="매칭 제안 관리"
      description="라운드 기반 노출과 선택 제한, 운영자 조율 흐름을 현재 기준에 맞춰 관리합니다."
      active="rounds"
    >
      <RoundDashboard {...data} />
    </AdminShell>
  );
}
