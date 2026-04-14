import { AdminShell } from "@/components/admin-shell";
import { RoundDashboard } from "@/components/round-dashboard";
import { getRoundDashboardData } from "@/lib/round-repository";

export const dynamic = "force-dynamic";

export default async function RoundsPage() {
  const data = await getRoundDashboardData();

  return (
    <AdminShell
      title="라운드 운영"
      description="주 2회 라운드, 선택 제한, 노출 제어, 운영자 조율 흐름을 관리합니다."
      active="rounds"
    >
      <RoundDashboard {...data} />
    </AdminShell>
  );
}
