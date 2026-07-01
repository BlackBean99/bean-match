"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { UserRole } from "@prisma/client";
import { createInviteAccessToken } from "@/lib/invite-token-repository";
import { getParticipantSessionCookieName, parseParticipantSessionUserId } from "@/lib/participant-session";
import { getUserDetail, updateMember } from "@/lib/member-repository";

export type UpdateMyProfileActionState = {
  error: string | null;
  success: string | null;
  values: {
    name: string;
    gender: string;
    birthYearText: string;
    phone: string;
    heightCm: string;
    jobTitle: string;
    companyName: string;
    selfIntro: string;
    idealTypeDescription: string;
    exposureConsent: boolean;
    newMemberNotificationsEnabled: boolean;
  };
};

export async function updateMyProfileAction(
  _prevState: UpdateMyProfileActionState,
  formData: FormData,
): Promise<UpdateMyProfileActionState> {
  const userId = await resolveParticipantUserId();
  const user = await getUserDetail(userId);
  if (!user) throw new Error("내 프로필을 찾을 수 없습니다.");

  const values = {
    name: readString(formData, "name") ?? "",
    gender: readString(formData, "gender") ?? "",
    birthYearText: readString(formData, "birthYearText") ?? "",
    phone: readString(formData, "phone") ?? "",
    heightCm: readString(formData, "heightCm") ?? "",
    jobTitle: readString(formData, "jobTitle") ?? "",
    companyName: readString(formData, "companyName") ?? "",
    selfIntro: readString(formData, "selfIntro") ?? "",
    idealTypeDescription: readString(formData, "idealTypeDescription") ?? "",
    exposureConsent: formData.get("exposureConsent") === "on",
    newMemberNotificationsEnabled: formData.get("newMemberNotificationsEnabled") === "on",
  };

  try {
    await updateMember(userId, {
      name: values.name.trim() || user.name,
      gender: user.genderCode as "FEMALE" | "MALE" | "OTHER" | "UNDISCLOSED",
      status: user.status,
      openLevel: user.openLevel,
      exposureConsent: values.exposureConsent,
      newMemberNotificationsEnabled: values.newMemberNotificationsEnabled,
      exposurePaused: user.exposurePaused,
      birthDate: null,
      ageText: values.birthYearText.trim() || null,
      heightCm: readNumber(values.heightCm),
      jobTitle: values.jobTitle.trim() || null,
      companyName: values.companyName.trim() || null,
      selfIntro: values.selfIntro.trim() || null,
      idealTypeDescription: values.idealTypeDescription.trim() || null,
      phone: values.phone.trim() || null,
      roles: user.roles.length > 0 ? (user.roles as UserRole[]) : [UserRole.PARTICIPANT],
      skipInviteTokenCreation: true,
    });

    revalidatePath("/me");
    revalidatePath("/users");
    revalidatePath("/matches");
    return {
      error: null,
      success: "내 프로필을 저장했습니다.",
      values,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "프로필 저장 중 오류가 발생했습니다.",
      success: null,
      values,
    };
  }
}

export async function createMyInviteCodeAction() {
  const userId = await resolveParticipantUserId();
  const user = await getUserDetail(userId);
  if (!user) throw new Error("내 프로필을 찾을 수 없습니다.");

  await createInviteAccessToken(userId, {
    label: `${user.name} 셀프 허브 초대 코드`,
    expiresAt: null,
  });

  revalidatePath("/me");
  redirect("/me");
}

export async function goToMyHubAction() {
  await resolveParticipantUserId();
  redirect("/me");
}

async function resolveParticipantUserId() {
  const cookieStore = await cookies();
  const userId = parseParticipantSessionUserId(cookieStore.get(getParticipantSessionCookieName())?.value);
  if (!userId) {
    throw new Error("참가자 세션이 없습니다. 초대 링크로 다시 접속해 주세요.");
  }
  return userId;
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key)?.toString().trim();
  return value || null;
}

function readNumber(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
