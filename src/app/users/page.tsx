import { AdminShell } from "@/components/admin-shell";
import { UsersDashboard } from "@/components/dashboard";
import { parseMemberFilters, type SearchParamMap } from "@/lib/filter-utils";
import { getMemberDashboardData } from "@/lib/member-repository";

export const dynamic = "force-dynamic";

type UsersPageProps = {
  searchParams?: Promise<SearchParamMap>;
};

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const filters = parseMemberFilters((await searchParams) ?? {});
  const data = await getMemberDashboardData(filters);

  return (
    <AdminShell title="사용자 풀" description="전체 사용자 정보를 목록형으로 보고 수정합니다." active="users">
      <UsersDashboard {...data} filters={filters} />
    </AdminShell>
  );
}
