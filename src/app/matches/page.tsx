import { AdminShell } from "@/components/admin-shell";
import { MatchesDashboard } from "@/components/dashboard";
import { parseMemberFilters, type SearchParamMap } from "@/lib/filter-utils";
import { getMemberDashboardData } from "@/lib/member-repository";

export const dynamic = "force-dynamic";

type MatchesPageProps = {
  searchParams?: Promise<SearchParamMap>;
};

export default async function MatchesPage({ searchParams }: MatchesPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const view = typeof resolvedSearchParams.view === "string" ? resolvedSearchParams.view : undefined;
  const filters = parseMemberFilters({ ...resolvedSearchParams, view: view ?? "recommend" });
  const data = await getMemberDashboardData(filters, { includeRoles: false });

  return (
    <AdminShell title="매칭 관리" description="특정 사용자 기준 상대 추천과 매칭 기록을 관리합니다." active="matches">
      <MatchesDashboard {...data} filters={filters} />
    </AdminShell>
  );
}
