import { AdminShell } from "@/components/admin-shell";
import { ExposureDashboard } from "@/components/exposure-dashboard";
import { getOpsSession } from "@/lib/admin-access-server";
import { getExposureDashboardData } from "@/lib/auto-exposure-repository";

export const dynamic = "force-dynamic";

export default async function RoundsPage() {
  const session = await getOpsSession();
  const data = await getExposureDashboardData();
  const canManage = session?.role === "ADMIN";

  return (
    <AdminShell
      title="자동 노출 운영"
      description="새로운 멤버의 자동 노출, 관심 수집, 상호 관심 검토 후보를 한 화면에서 관리합니다."
      active="rounds"
      canManage={canManage}
      viewerName={session?.name ?? "운영"}
      viewerRole={session?.role ?? "INVITOR"}
    >
      <ExposureDashboard {...data} canManage={canManage} />
    </AdminShell>
  );
}
