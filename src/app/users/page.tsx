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
  const data = await getMemberDashboardData(filters, { includeIntroCases: false });

  return (
    <AdminShell title="회원 관리" description="등록 회원을 필터링하고 핵심 프로필 정보를 빠르게 검토합니다." active="users">
      <UsersDashboard {...data} filters={filters} />
    </AdminShell>
  );
}
