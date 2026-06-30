import { AdminShell } from "@/components/admin-shell";
import { OfferMatchDashboard } from "@/components/offer-match-dashboard";
import { requireOpsSession } from "@/lib/admin-access-server";
import { getExposureDashboardData } from "@/lib/auto-exposure-repository";
import type { SearchParamMap } from "@/lib/filter-utils";

export const dynamic = "force-dynamic";

type MatchesPageProps = {
  searchParams?: Promise<SearchParamMap>;
};

export default async function MatchesPage({ searchParams }: MatchesPageProps) {
  const session = await requireOpsSession();
  const data = await getExposureDashboardData();
  const q = readString((await searchParams) ?? {}, "q");
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
      <OfferMatchDashboard {...data} canManage={canManage} searchQuery={q} />
    </AdminShell>
  );
}

function readString(searchParams: SearchParamMap, key: string) {
  const value = searchParams[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}
