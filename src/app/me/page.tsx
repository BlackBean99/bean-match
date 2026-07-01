import { cookies } from "next/headers";
import { MyHub } from "@/components/my-hub";
import { getInviteTokenManagerData } from "@/lib/invite-token-repository";
import { getParticipantSessionCookieName, parseParticipantSessionUserId } from "@/lib/participant-session";
import { getParticipantExposureData } from "@/lib/auto-exposure-repository";
import { getUserDetail, countUserInvitees } from "@/lib/member-repository";

export default async function MePage() {
  const cookieStore = await cookies();
  const userId = parseParticipantSessionUserId(cookieStore.get(getParticipantSessionCookieName())?.value);

  if (!userId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 text-zinc-950">
        <div className="max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold">참가자 세션이 없습니다</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">초대 링크로 다시 접속해 주세요.</p>
        </div>
      </main>
    );
  }

  const [user, exposureData, inviteTokenManager, inviteCount] = await Promise.all([
    getUserDetail(userId),
    getParticipantExposureData(userId),
    getInviteTokenManagerData(userId),
    countUserInvitees(userId),
  ]);

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 text-zinc-950">
        <div className="max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold">내 프로필을 찾을 수 없습니다</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">관리자에게 계정 상태를 확인해 달라고 요청해 주세요.</p>
        </div>
      </main>
    );
  }

  return (
    <MyHub
      user={user}
      exposureData={exposureData}
      inviteCount={inviteCount}
      inviteTokenHint={inviteTokenManager.token ? inviteTokenManager.token.tokenHint : null}
    />
  );
}
