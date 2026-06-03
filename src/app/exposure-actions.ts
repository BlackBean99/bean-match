"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminOpsSession } from "@/lib/admin-access-server";
import type { OpenLevel } from "@/lib/domain";
import {
  approveIntroCandidate,
  convertIntroCandidateToIntroCase,
  createBroadcastInterest,
  createManualIntroCandidate,
  expireStaleInterests,
  joinAutoExposureWithExistingUser,
  rejectIntroCandidate,
  submitBrowseInterests,
  updateAutoExposureSettings,
} from "@/lib/auto-exposure-repository";
import { validateOnboardingAccessToken } from "@/lib/onboarding-access-repository";

const openLevelValues = new Set<OpenLevel>(["PRIVATE", "SEMI_OPEN", "FULL_OPEN"]);

export type JoinAutoExposureActionState = {
  error: string | null;
  values: {
    accessToken: string;
    name: string;
    invitorUserId: string;
    openLevel: OpenLevel;
    exposureConsent: boolean;
    newMemberNotificationsEnabled: boolean;
  };
};

export async function joinAutoExposureAction(formData: FormData) {
  const openLevel = readEnum(formData, "openLevel", openLevelValues, "FULL_OPEN");
  const exposureConsent = formData.get("exposureConsent") === "on";
  const newMemberNotificationsEnabled = formData.get("newMemberNotificationsEnabled") === "on";
  const accessToken = readString(formData, "accessToken");
  if (!accessToken) throw new Error("온보딩 접근 토큰이 없습니다. 운영자에게 링크를 다시 받아 주세요.");
  const userId = await resolveUserIdFromOnboardingAccessToken(accessToken);

  const result = await joinAutoExposureWithExistingUser({
    userId,
    name: readRequiredString(formData, "name"),
    invitorUserId: readString(formData, "invitorUserId") ? parseNamedId(formData, "invitorUserId") : null,
    openLevel,
    exposureConsent,
    newMemberNotificationsEnabled,
  });

  revalidateExposure();
  redirect(`/pool/${result.userId.toString()}`);
}

export async function joinAutoExposureWithStateAction(
  _previousState: JoinAutoExposureActionState,
  formData: FormData,
): Promise<JoinAutoExposureActionState> {
  const values = {
    accessToken: readString(formData, "accessToken") ?? "",
    name: readString(formData, "name") ?? "",
    invitorUserId: readString(formData, "invitorUserId") ?? "",
    openLevel: readEnum(formData, "openLevel", openLevelValues, "FULL_OPEN"),
    exposureConsent: formData.get("exposureConsent") === "on",
    newMemberNotificationsEnabled: formData.get("newMemberNotificationsEnabled") === "on",
  };

  if (!values.accessToken) {
    return {
      error: "온보딩 접근 토큰이 없습니다. 운영자에게 링크를 다시 받아 주세요.",
      values,
    };
  }
  if (!values.name) {
    return {
      error: "이름을 입력해 주세요.",
      values,
    };
  }

  try {
    const userId = await resolveUserIdFromOnboardingAccessToken(values.accessToken);

    const result = await joinAutoExposureWithExistingUser({
      userId,
      name: values.name,
      invitorUserId: values.invitorUserId ? BigInt(values.invitorUserId) : null,
      openLevel: values.openLevel,
      exposureConsent: values.exposureConsent,
      newMemberNotificationsEnabled: values.newMemberNotificationsEnabled,
    });

    revalidateExposure();
    redirect(`/pool/${result.userId.toString()}`);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "자동 노출 풀 입장 처리 중 문제가 발생했습니다.",
      values,
    };
  }
}

export async function submitBrowseInterestsAction(formData: FormData) {
  const userId = parseNamedId(formData, "userId");
  const targetUserIds = formData
    .getAll("targetUserId")
    .map((value) => value.toString())
    .filter(Boolean)
    .map((value) => BigInt(value));

  await submitBrowseInterests({ userId, targetUserIds });
  revalidateExposure();
  revalidatePath(`/pool/${userId.toString()}`);
}

export async function createBroadcastInterestAction(formData: FormData) {
  const userId = parseNamedId(formData, "userId");
  const targetUserId = parseNamedId(formData, "targetUserId");

  await createBroadcastInterest(userId, targetUserId);
  revalidateExposure();
  revalidatePath(`/pool/${userId.toString()}`);
}

export async function updateAutoExposureSettingsAction(formData: FormData) {
  await requireAdminOpsSession();
  const userId = parseNamedId(formData, "userId");

  await updateAutoExposureSettings(userId, {
    openLevel: readEnum(formData, "openLevel", openLevelValues, "PRIVATE"),
    exposureConsent: formData.get("exposureConsent") === "on",
    newMemberNotificationsEnabled: formData.get("newMemberNotificationsEnabled") === "on",
    exposurePaused: formData.get("exposurePaused") === "on",
  });

  revalidateExposure();
}

export async function createManualIntroCandidateAction(formData: FormData) {
  await requireAdminOpsSession();
  await createManualIntroCandidate({
    userAId: parseNamedId(formData, "userAId"),
    userBId: parseNamedId(formData, "userBId"),
    reason: readString(formData, "reason") ?? "",
  });
  revalidateExposure();
}

export async function approveIntroCandidateAction(formData: FormData) {
  await requireAdminOpsSession();
  await approveIntroCandidate(parseNamedId(formData, "candidateId"));
  revalidateExposure();
}

export async function rejectIntroCandidateAction(formData: FormData) {
  await requireAdminOpsSession();
  await rejectIntroCandidate(parseNamedId(formData, "candidateId"));
  revalidateExposure();
}

export async function convertIntroCandidateAction(formData: FormData) {
  await requireAdminOpsSession();
  await convertIntroCandidateToIntroCase(parseNamedId(formData, "candidateId"));
  revalidateExposure();
}

export async function expireStaleInterestsAction() {
  await requireAdminOpsSession();
  await expireStaleInterests();
  revalidateExposure();
}

function revalidateExposure() {
  revalidatePath("/");
  revalidatePath("/onboarding");
  revalidatePath("/matches");
  revalidatePath("/rounds");
  revalidatePath("/users");
}

function parseNamedId(formData: FormData, key: string) {
  return BigInt(readRequiredString(formData, key));
}

function readRequiredString(formData: FormData, key: string) {
  const value = readString(formData, key);
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key)?.toString().trim();
  return value || null;
}

function readEnum<T extends string>(formData: FormData, key: string, allowed: Set<T>, fallback: T) {
  const value = readString(formData, key);
  return value && allowed.has(value as T) ? (value as T) : fallback;
}

async function resolveUserIdFromOnboardingAccessToken(rawToken: string) {
  const validation = await validateOnboardingAccessToken(rawToken);
  if (!validation.ok) {
    throw new Error(
      validation.reason === "missing_token"
        ? "온보딩 접근 토큰이 없습니다. 운영자에게 링크를 다시 받아 주세요."
        : validation.reason === "database_unavailable"
          ? "온보딩 접근 토큰 저장소에 연결할 수 없습니다."
          : "온보딩 접근 토큰이 올바르지 않거나 이미 만료 또는 해제되었습니다.",
    );
  }

  return BigInt(validation.userId);
}
