"use server";

import { revalidatePath } from "next/cache";
import type { OpenLevel, RoundStatus } from "@/lib/domain";
import {
  createOnboardingUser,
  createRound,
  createRoundSelection,
  createRoundSelections,
  updateRoundStatus,
} from "@/lib/round-repository";

const roundStatusValues = new Set<RoundStatus>(["DRAFT", "OPEN", "CLOSED", "MATCHING", "COMPLETED"]);
const openLevelValues = new Set<OpenLevel>(["PRIVATE", "SEMI_OPEN", "FULL_OPEN"]);
const genderValues = new Set(["FEMALE", "MALE", "OTHER", "UNDISCLOSED"]);

export async function createRoundAction(formData: FormData) {
  const title = readRequiredString(formData, "title");
  const startAt = readDateTime(formData, "startAt");
  const endAt = readDateTime(formData, "endAt");

  if (endAt <= startAt) throw new Error("라운드 종료 시각은 시작 시각 이후여야 합니다.");

  await createRound({
    title,
    startAt,
    endAt,
    status: readEnum(formData, "status", roundStatusValues, "DRAFT"),
  });
  revalidateRounds();
}

export async function updateRoundStatusAction(formData: FormData) {
  await updateRoundStatus(parseNamedId(formData, "roundId"), readEnum(formData, "status", roundStatusValues, "OPEN"));
  revalidateRounds();
}

export async function createRoundSelectionAction(formData: FormData) {
  await createRoundSelection(
    parseNamedId(formData, "roundId"),
    parseNamedId(formData, "fromUserId"),
    parseNamedId(formData, "toUserId"),
  );
  revalidateRounds();
}

export async function createParticipantRoundSelectionsAction(formData: FormData) {
  const roundId = parseNamedId(formData, "roundId");
  const fromUserId = parseNamedId(formData, "fromUserId");
  const toUserIds = formData
    .getAll("toUserId")
    .map((value) => value.toString())
    .filter(Boolean)
    .map((value) => BigInt(value));

  await createRoundSelections(roundId, fromUserId, toUserIds);
  revalidatePath(`/rounds/${roundId.toString()}/participants/${fromUserId.toString()}`);
  revalidateRounds();
}

export async function createOnboardingUserAction(formData: FormData) {
  await createOnboardingUser({
    name: readRequiredString(formData, "name"),
    gender: readEnum(formData, "gender", genderValues, "UNDISCLOSED") as "FEMALE" | "MALE" | "OTHER" | "UNDISCLOSED",
    ageText: readString(formData, "ageText"),
    jobTitle: readString(formData, "jobTitle"),
    heightCm: readNumber(formData, "heightCm"),
    selfIntro: readString(formData, "selfIntro"),
    idealTypeDescription: readString(formData, "idealTypeDescription"),
    openLevel: readEnum(formData, "openLevel", openLevelValues, "PRIVATE"),
    invitorUserId: readString(formData, "invitorUserId") ? parseNamedId(formData, "invitorUserId") : null,
  });
  revalidateRounds();
}

function revalidateRounds() {
  revalidatePath("/rounds");
  revalidatePath("/users");
  revalidatePath("/onboarding");
}

function parseNamedId(formData: FormData, key: string) {
  return BigInt(readRequiredString(formData, key));
}

function readDateTime(formData: FormData, key: string) {
  const value = readRequiredString(formData, key);
  return new Date(value);
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

function readNumber(formData: FormData, key: string) {
  const value = readString(formData, key);
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function readEnum<T extends string>(formData: FormData, key: string, allowed: Set<T>, fallback: T) {
  const value = readString(formData, key);
  return value && allowed.has(value as T) ? (value as T) : fallback;
}
