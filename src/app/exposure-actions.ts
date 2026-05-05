"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

const openLevelValues = new Set<OpenLevel>(["PRIVATE", "SEMI_OPEN", "FULL_OPEN"]);

export async function joinAutoExposureAction(formData: FormData) {
  const userId = parseNamedId(formData, "userId");
  const openLevel = readEnum(formData, "openLevel", openLevelValues, "FULL_OPEN");
  const exposureConsent = formData.get("exposureConsent") === "on";
  const newMemberNotificationsEnabled = formData.get("newMemberNotificationsEnabled") === "on";

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
  await createManualIntroCandidate({
    userAId: parseNamedId(formData, "userAId"),
    userBId: parseNamedId(formData, "userBId"),
    reason: readString(formData, "reason") ?? "",
  });
  revalidateExposure();
}

export async function approveIntroCandidateAction(formData: FormData) {
  await approveIntroCandidate(parseNamedId(formData, "candidateId"));
  revalidateExposure();
}

export async function rejectIntroCandidateAction(formData: FormData) {
  await rejectIntroCandidate(parseNamedId(formData, "candidateId"));
  revalidateExposure();
}

export async function convertIntroCandidateAction(formData: FormData) {
  await convertIntroCandidateToIntroCase(parseNamedId(formData, "candidateId"));
  revalidateExposure();
}

export async function expireStaleInterestsAction() {
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
