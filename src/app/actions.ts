"use server";

import { Gender, IntroCaseStatus, UserRole, UserStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import type { OpenLevel } from "@/lib/domain";
import {
  addUserPhoto,
  bulkApplyRoundParticipationDefaults,
  createIntroCase,
  createMember,
  deleteIntroCase,
  deleteMember,
  deleteUserPhoto,
  setMainUserPhoto,
  updateUserPhoto,
  uploadUserPhotoFile,
  updateIntroCase,
  updateMember,
  updateMemberExposure,
} from "@/lib/member-repository";

const genderValues = new Set(Object.values(Gender));
const statusValues = new Set(Object.values(UserStatus));
const roleValues = new Set(Object.values(UserRole));
const introStatusValues = new Set(Object.values(IntroCaseStatus));
const openLevelValues = new Set<OpenLevel>(["PRIVATE", "SEMI_OPEN", "FULL_OPEN"]);

export async function createMemberAction(formData: FormData) {
  await createMember(parseMemberForm(formData));
  revalidatePath("/");
}

export async function updateMemberAction(formData: FormData) {
  const id = parseId(formData);
  await updateMember(id, parseMemberForm(formData));
  revalidatePath("/");
}

export async function deleteMemberAction(formData: FormData) {
  const id = parseId(formData);
  await deleteMember(id);
  revalidatePath("/");
}

export async function updateMemberExposureAction(formData: FormData) {
  const id = parseId(formData);
  await updateMemberExposure(id, {
    status: readEnum(formData, "status", statusValues, UserStatus.INCOMPLETE),
    openLevel: readEnum(formData, "openLevel", openLevelValues, "PRIVATE"),
  });
  revalidatePath(`/users/${id.toString()}`);
  revalidatePath("/users");
  revalidatePath("/matches");
  revalidatePath("/rounds");
}

export async function bulkApplyRoundParticipationDefaultsAction(formData: FormData) {
  if (formData.get("confirm") !== "on") {
    throw new Error("확인 체크가 필요합니다.");
  }

  await bulkApplyRoundParticipationDefaults({
    exceptNames: ["정희", "김채원", "이원민"],
  });

  revalidatePath("/users");
  revalidatePath("/matches");
  revalidatePath("/rounds");
}

export async function createIntroCaseAction(formData: FormData) {
  await createIntroCase(parseIntroCaseForm(formData));
  revalidatePath("/");
}

export async function updateIntroCaseAction(formData: FormData) {
  const id = parseId(formData);
  await updateIntroCase(id, {
    status: readEnum(formData, "status", introStatusValues, IntroCaseStatus.OFFERED),
    memo: readString(formData, "memo"),
  });
  revalidatePath("/");
}

export async function deleteIntroCaseAction(formData: FormData) {
  const id = parseId(formData);
  await deleteIntroCase(id);
  revalidatePath("/");
}

export async function addUserPhotoAction(formData: FormData) {
  const userId = parseNamedId(formData, "userId");
  await addUserPhoto(userId, await parsePhotoForm(userId, formData));
  revalidatePath(`/users/${userId.toString()}`);
  revalidatePath("/users");
}

export async function updateUserPhotoAction(formData: FormData) {
  const photoId = parseNamedId(formData, "photoId");
  const userId = parseNamedId(formData, "userId");
  await updateUserPhoto(photoId, await parsePhotoForm(userId, formData));
  revalidatePath(`/users/${userId.toString()}`);
  revalidatePath("/users");
}

export async function setMainUserPhotoAction(formData: FormData) {
  const photoId = parseNamedId(formData, "photoId");
  const userId = parseNamedId(formData, "userId");
  await setMainUserPhoto(photoId);
  revalidatePath(`/users/${userId.toString()}`);
  revalidatePath("/users");
}

export async function deleteUserPhotoAction(formData: FormData) {
  const photoId = parseNamedId(formData, "photoId");
  const userId = parseNamedId(formData, "userId");
  await deleteUserPhoto(photoId);
  revalidatePath(`/users/${userId.toString()}`);
  revalidatePath("/users");
}

function parseMemberForm(formData: FormData) {
  const name = readString(formData, "name");
  if (!name) {
    throw new Error("Name is required.");
  }

  return {
    name,
    gender: readEnum(formData, "gender", genderValues, Gender.UNDISCLOSED),
    status: readEnum(formData, "status", statusValues, UserStatus.INCOMPLETE),
    openLevel: readEnum(formData, "openLevel", openLevelValues, "PRIVATE"),
    birthDate: readDate(formData, "birthDate"),
    ageText: readString(formData, "ageText"),
    heightCm: readNumber(formData, "heightCm"),
    jobTitle: readString(formData, "jobTitle"),
    companyName: readString(formData, "companyName"),
    selfIntro: readString(formData, "selfIntro"),
    idealTypeDescription: readString(formData, "idealTypeDescription"),
    phone: readString(formData, "phone"),
    roles: formData
      .getAll("roles")
      .map((value) => value.toString())
      .filter((value): value is UserRole => roleValues.has(value as UserRole)),
  };
}

function parseIntroCaseForm(formData: FormData) {
  return {
    status: readEnum(formData, "status", introStatusValues, IntroCaseStatus.OFFERED),
    personAId: parseNamedId(formData, "personAId"),
    personBId: parseNamedId(formData, "personBId"),
    invitorUserId: readString(formData, "invitorUserId") ? parseNamedId(formData, "invitorUserId") : null,
    memo: readString(formData, "memo"),
  };
}

async function parsePhotoForm(userId: bigint, formData: FormData) {
  const uploadedPhoto = await uploadPhotoIfPresent(userId, formData);
  const url = uploadedPhoto?.url ?? readString(formData, "url");
  if (!url) throw new Error("Photo URL or image file is required.");

  return {
    url,
    originalFileName: readString(formData, "originalFileName") ?? uploadedPhoto?.originalFileName ?? null,
    storedFileName: uploadedPhoto?.storedFileName,
    filePath: uploadedPhoto?.filePath,
    mimeType: uploadedPhoto?.mimeType,
    fileSizeBytes: uploadedPhoto?.fileSizeBytes,
    sortOrder: readNumber(formData, "sortOrder") ?? 0,
    isMain: formData.get("isMain") === "on",
  };
}

async function uploadPhotoIfPresent(userId: bigint, formData: FormData) {
  const file = formData.get("photoFile");
  if (!isUploadedFile(file)) return null;

  return uploadUserPhotoFile(userId, file);
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File && value.size > 0;
}

function parseId(formData: FormData) {
  return parseNamedId(formData, "id");
}

function parseNamedId(formData: FormData, key: string) {
  const value = readString(formData, "id");
  const namedValue = readString(formData, key);
  const resolvedValue = key === "id" ? value : namedValue;
  if (!resolvedValue) {
    throw new Error(`${key} is required.`);
  }

  return BigInt(resolvedValue);
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key)?.toString().trim();
  return value || null;
}

function readDate(formData: FormData, key: string) {
  const value = readString(formData, key);
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
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
