import { AdminShell } from "@/components/admin-shell";
import { MatchesDashboard } from "@/components/dashboard";
import { getOpsSession } from "@/lib/admin-access-server";
import { parseMemberFilters, type SearchParamMap } from "@/lib/filter-utils";
import { getMemberDashboardData } from "@/lib/member-repository";

export const dynamic = "force-dynamic";

type MatchesPageProps = {
  searchParams?: Promise<SearchParamMap>;
};

export default async function MatchesPage({ searchParams }: MatchesPageProps) {
  const session = await getOpsSession();
  const resolvedSearchParams = (await searchParams) ?? {};
  const view = typeof resolvedSearchParams.view === "string" ? resolvedSearchParams.view : undefined;
  const filters = parseMemberFilters({ ...resolvedSearchParams, view: view ?? "recommend" });
  const data = await getMemberDashboardData(filters, { includeRoles: false });
  const canManage = session?.role === "ADMIN";

  return (
    <AdminShell
      title="매칭 풀 관리"
      description="등록된 회원을 관리하고 매칭 기회를 빠르게 구성합니다."
      active="matches"
      canManage={canManage}
      viewerName={session?.name ?? "운영"}
      viewerRole={session?.role ?? "INVITOR"}
    >
      <MatchesDashboard {...data} filters={filters} canManage={canManage} />
    </AdminShell>
  );
}
