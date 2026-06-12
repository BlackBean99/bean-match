import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { UserDetail } from "@/components/user-detail";
import { requireOpsSession } from "@/lib/admin-access-server";
import { getUserDetail } from "@/lib/member-repository";
import { getInviteTokenManagerData } from "@/lib/invite-token-repository";
import { getOnboardingAccessTokenManagerData } from "@/lib/onboarding-access-repository";
import { getReadOnlyBrowseTokenManagerData } from "@/lib/readonly-browse-repository";
import Link from "next/link";

export const dynamic = "force-dynamic";

type UserDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  const session = await requireOpsSession();
  const { id } = await params;
  const userId = BigInt(id);
  const canManage = session.role === "ADMIN";

  try {
    const [user, inviteTokenManager, onboardingAccessTokenManager, readOnlyTokenManager] = await Promise.all([
      getUserDetail(userId),
      getInviteTokenManagerData(userId),
      getOnboardingAccessTokenManagerData(userId),
      getReadOnlyBrowseTokenManagerData(userId),
    ]);

    if (!user) notFound();

    return (
      <AdminShell
        title={`${user.name} 상세`}
        description="개인 프로필과 여러 장의 사진을 관리합니다."
        active="users"
        canManage={canManage}
        viewerName={session.name}
        viewerRole={session.role}
      >
        <UserDetail
          user={user}
          inviteTokenManager={inviteTokenManager}
          onboardingAccessTokenManager={onboardingAccessTokenManager}
          readOnlyTokenManager={readOnlyTokenManager}
          canManage={canManage}
        />
      </AdminShell>
    );
  } catch {
    return (
      <AdminShell
        title="회원 상세"
        description="개인 프로필과 여러 장의 사진을 관리합니다."
        active="users"
        canManage={canManage}
        viewerName={session.name}
        viewerRole={session.role}
      >
        <section className="rounded-lg border border-red-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-[#E00E0E]">사용자 상세를 불러오지 못했습니다</p>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            사용자 데이터 저장소에 연결하지 못했습니다. Supabase 연결 상태를 확인한 뒤 다시 시도해 주세요.
          </p>
          <Link href="/users" className="mt-4 inline-flex text-sm font-bold text-[#E00E0E]">
            사용자 목록으로 돌아가기
          </Link>
        </section>
      </AdminShell>
    );
  }
}
