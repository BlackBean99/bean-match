"use server";

import { Gender, UserRole, UserStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { addUserPhoto, createMember, uploadUserPhotoFile } from "@/lib/member-repository";

const genderValues = new Set(Object.values(Gender));

export type SubmitPublicApplicationActionState = {
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

export async function submitPublicApplicationAction(
  _prevState: SubmitPublicApplicationActionState,
  formData: FormData,
): Promise<SubmitPublicApplicationActionState> {
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
    const name = values.name.trim();
    if (!name) throw new Error("이름을 입력해 주세요.");

    const gender = readEnum(formData, "gender", genderValues, null);
    if (!gender) throw new Error("성별을 선택해 주세요.");

    const photoFile = readUploadedFile(formData.get("photoFile"));
    if (!photoFile) throw new Error("사진 파일을 1장 이상 첨부해 주세요.");

    const submittedUser = await createMember({
      name,
      gender,
      status: UserStatus.INCOMPLETE,
      openLevel: "FULL_OPEN",
      exposureConsent: values.exposureConsent,
      newMemberNotificationsEnabled: values.newMemberNotificationsEnabled,
      exposurePaused: false,
      birthDate: null,
      ageText: values.birthYearText.trim(),
      heightCm: readNumber(values.heightCm),
      jobTitle: values.jobTitle.trim() || null,
      companyName: values.companyName.trim() || null,
      selfIntro: values.selfIntro.trim() || null,
      idealTypeDescription: values.idealTypeDescription.trim() || null,
      phone: values.phone.trim() || null,
      roles: [UserRole.PARTICIPANT],
    });

    const submittedUserId = typeof submittedUser.id === "bigint" ? submittedUser.id : BigInt(submittedUser.id);
    const uploadedPhoto = await uploadUserPhotoFile(submittedUserId, photoFile);
    await addUserPhoto(submittedUserId, {
      ...uploadedPhoto,
      sortOrder: 0,
      isMain: true,
    });

    revalidatePath("/apply");
    revalidatePath("/users");

    return {
      error: null,
      success: "신청이 접수되었습니다. 승인 전까지는 승인 대기 상태로 보관됩니다.",
      values: {
        name: "",
        gender: "",
        birthYearText: "",
        phone: "",
        heightCm: "",
        jobTitle: "",
        companyName: "",
        selfIntro: "",
        idealTypeDescription: "",
        exposureConsent: true,
        newMemberNotificationsEnabled: true,
      },
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "신청 처리 중 오류가 발생했습니다.",
      success: null,
      values,
    };
  }
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key)?.toString().trim();
  return value || null;
}

function readEnum<T extends string>(formData: FormData, key: string, allowed: Set<T>, fallback: T | null): T | null {
  const value = readString(formData, key);
  if (!value) return fallback;
  return allowed.has(value as T) ? (value as T) : fallback;
}

function readNumber(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readUploadedFile(value: FormDataEntryValue | null) {
  return typeof File !== "undefined" && value instanceof File && value.size > 0 ? value : null;
}
