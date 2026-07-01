"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireAdminOpsSession } from "@/lib/admin-access-server";
import { getUserDetail } from "@/lib/member-repository";
import {
  createInviteAccessToken,
  validateInviteAccessToken,
  type InviteTokenSummary,
} from "@/lib/invite-token-repository";
import { getParticipantSessionCookieName } from "@/lib/participant-session";

export type InviteShareActionResult = {
  accessUrl: string;
  shareText: string;
  token: InviteTokenSummary;
};

export async function createInviteKakaoShareAction(userId: number): Promise<InviteShareActionResult> {
  await requireAdminOpsSession();

  const user = await getUserDetail(BigInt(userId));
  if (!user) {
    throw new Error("초대 링크를 발급할 사용자를 찾을 수 없습니다.");
  }
  if (!user.roles.includes("PARTICIPANT")) {
    throw new Error("참가자에게만 개인 초대 링크를 발급할 수 있습니다.");
  }

  const issued = await createInviteAccessToken(BigInt(userId), {
    label: `${user.name} 개인 초대 링크`,
    expiresAt: null,
  });

  return {
    accessUrl: issued.accessUrl,
    shareText: buildInviteKakaoMessage(user.name, issued.accessUrl),
    token: issued.token,
  };
}

export async function confirmInviteAccessAction(formData: FormData) {
  const inviteToken = formData.get("inviteToken")?.toString().trim() ?? "";
  if (!inviteToken) {
    throw new Error("초대 링크 토큰이 없습니다.");
  }

  const validation = await validateInviteAccessToken(inviteToken);
  if (!validation.ok) {
    throw new Error(
      validation.reason === "missing_token"
        ? "초대 링크 토큰이 없습니다."
        : validation.reason === "database_unavailable"
          ? "초대 링크 저장소에 연결할 수 없습니다."
          : "초대 링크가 올바르지 않거나 이미 만료 또는 해제되었습니다.",
    );
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: getParticipantSessionCookieName(),
    value: validation.userId.toString(),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(validation.expiresAt ? { expires: validation.expiresAt } : {}),
  });

  redirect("/me");
}

function buildInviteKakaoMessage(userName: string, accessUrl: string) {
  return [
    "[블랙빈 매치]",
    "",
    `${userName}님 전용 초대 링크입니다.`,
    "기능 설명: 본인 확인 후 공개조회에 동의한 반대 성별 참가자 목록을 볼 수 있습니다.",
    "최대 3명까지 선택하여 호감을 표시할 수 있습니다.",
    "본인 전용 링크이므로 다른 사람과 공유하지 말아 주세요.",
    "링크 공유 금지: 개인 초대 링크는 본인만 사용해 주세요.",
    "",
    accessUrl,
  ].join("\n");
}
