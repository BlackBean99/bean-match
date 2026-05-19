import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { UserDetail } from "@/components/user-detail";
import { getUserDetail } from "@/lib/member-repository";
import { getReadOnlyBrowseTokenManagerData } from "@/lib/readonly-browse-repository";

export const dynamic = "force-dynamic";

type UserDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  const { id } = await params;
  const userId = BigInt(id);
  const [user, readOnlyTokenManager] = await Promise.all([
    getUserDetail(userId),
    getReadOnlyBrowseTokenManagerData(userId),
  ]);

  if (!user) notFound();

  return (
    <AdminShell title={`${user.name} 상세`} description="개인 프로필과 여러 장의 사진을 관리합니다." active="users">
      <UserDetail user={user} readOnlyTokenManager={readOnlyTokenManager} />
    </AdminShell>
  );
}
