import { AdminShell } from "@/components/admin-shell";
import { OfferMatchDashboard } from "@/components/offer-match-dashboard";
import { requireOpsSession } from "@/lib/admin-access-server";
import { getExposureDashboardData } from "@/lib/auto-exposure-repository";

export const dynamic = "force-dynamic";

type MatchesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MatchesPage({ searchParams }: MatchesPageProps) {
  const session = await requireOpsSession();
  const data = await getExposureDashboardData();
  const resolvedSearchParams = (await searchParams) ?? {};
  const searchQuery = readString(resolvedSearchParams.q);
  const canManage = session?.role === "ADMIN";

  return (
    <AdminShell
      title="오퍼 매칭 관리"
      description="오퍼 사이트에서 모인 관심 기록을 페어 단위로 보고, 단방향/상호 관심/전환 상태를 한눈에 확인합니다."
      active="matches"
      canManage={canManage}
      viewerName={session.name}
      viewerRole={session.role}
    >
      <OfferMatchDashboard {...data} searchQuery={searchQuery} />
    </AdminShell>
  );
}

function readString(value: string | string[] | undefined) {
  const resolvedValue = Array.isArray(value) ? value[0] : value;
  return resolvedValue?.trim() ?? "";
}
