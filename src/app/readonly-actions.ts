"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminOpsSession, requireOpsSession } from "@/lib/admin-access-server";
import {
  createReadOnlyBrowseToken,
  getReadOnlyBrowseAccessPath,
  getReadOnlyBrowseCookieName,
  revokeReadOnlyBrowseToken,
  validateReadOnlyBrowseToken,
} from "@/lib/readonly-browse-repository";
import { submitBrowseInterests } from "@/lib/auto-exposure-repository";

export type CreateReadOnlyBrowseTokenActionState = {
  createdToken:
    | {
        accessPath: string;
        expiresAt: string | null;
        label: string;
        rawToken: string;
      }
    | null;
  error: string | null;
  values: {
    expiresAt: string;
    label: string;
  };
};

export type UnlockReadOnlyBrowseActionState = {
  error: string | null;
};

export type SubmitReadOnlyBrowseInterestsActionState = {
  error: string | null;
  success: string | null;
};

export async function createReadOnlyBrowseTokenWithStateAction(
  _prevState: CreateReadOnlyBrowseTokenActionState,
  formData: FormData,
): Promise<CreateReadOnlyBrowseTokenActionState> {
  await requireAdminOpsSession();
  const values = {
    label: readString(formData, "label") ?? "",
    expiresAt: readString(formData, "expiresAt") ?? "",
  };

  try {
    const userId = parseNamedId(formData, "userId");
    const createdToken = await createReadOnlyBrowseToken(userId, {
      label: values.label,
      expiresAt: parseExpiryDate(values.expiresAt),
    });

    revalidatePath(`/users/${userId.toString()}`);

    return {
      createdToken: {
        accessPath: createdToken.accessPath,
        expiresAt: createdToken.token.expiresAt,
        label: createdToken.token.label,
        rawToken: createdToken.rawToken,
      },
      error: null,
      values: {
        label: "",
        expiresAt: "",
      },
    };
  } catch (error) {
    return {
      createdToken: null,
      error: error instanceof Error ? error.message : "열람 링크 생성 중 오류가 발생했습니다.",
      values,
    };
  }
}

export async function revokeReadOnlyBrowseTokenAction(formData: FormData) {
  await requireAdminOpsSession();
  const tokenId = parseNamedId(formData, "tokenId");
  const userId = parseNamedId(formData, "userId");

  await revokeReadOnlyBrowseToken(tokenId);
  revalidatePath(`/users/${userId.toString()}`);
  revalidatePath(getReadOnlyBrowseAccessPath(userId));
}

export async function createQuickOfferClipboardAction(userId: number) {
  await requireOpsSession();
  const expiresAt = oneWeekFromNow();
  const createdToken = await createReadOnlyBrowseToken(BigInt(userId), {
    label: `호감표시 링크 빠른 복사 ${new Intl.DateTimeFormat("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date())}`,
    expiresAt,
  });

  revalidatePath(`/users/${userId}`);

  return {
    accessPath: createdToken.accessPath,
    expiresAtIso: expiresAt.toISOString(),
  };
}

export async function unlockReadOnlyBrowseAction(
  _prevState: UnlockReadOnlyBrowseActionState,
  formData: FormData,
): Promise<UnlockReadOnlyBrowseActionState> {
  const userId = parseNamedId(formData, "userId");
  const rawToken = readString(formData, "token");

  const validation = await validateReadOnlyBrowseToken(userId, rawToken);
  if (!validation.ok) {
    return {
      error:
        validation.reason === "missing_token"
          ? "링크 코드를 입력해 주세요."
          : validation.reason === "database_unavailable"
            ? "지금은 링크 정보를 확인할 수 없습니다."
            : "링크가 올바르지 않거나 이미 만료 또는 해제되었습니다.",
    };
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: getReadOnlyBrowseCookieName(userId),
    value: rawToken!.trim(),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(validation.expiresAt ? { expires: validation.expiresAt } : {}),
  });

  redirect(getReadOnlyBrowseAccessPath(userId));
}

export async function submitReadOnlyBrowseInterestsWithStateAction(
  _prevState: SubmitReadOnlyBrowseInterestsActionState,
  formData: FormData,
): Promise<SubmitReadOnlyBrowseInterestsActionState> {
  const userId = parseNamedId(formData, "userId");
  const cookieStore = await cookies();
  const rawToken = readString(formData, "accessToken") ?? cookieStore.get(getReadOnlyBrowseCookieName(userId))?.value ?? null;
  const validation = await validateReadOnlyBrowseToken(userId, rawToken);

  if (!validation.ok) {
    return {
      error:
        validation.reason === "database_unavailable"
          ? "지금은 링크 정보를 확인할 수 없습니다."
          : "입장 코드가 유효하지 않아 다시 확인이 필요합니다.",
      success: null,
    };
  }

  const targetUserIds = formData
    .getAll("targetUserId")
    .map((value) => value.toString())
    .filter(Boolean)
    .map((value) => BigInt(value));

  try {
    await submitBrowseInterests({ userId, targetUserIds });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "관심 저장 중 오류가 발생했습니다.",
      success: null,
    };
  }

  revalidatePath("/");
  revalidatePath("/onboarding");
  revalidatePath("/matches");
  revalidatePath("/rounds");
  revalidatePath("/users");
  revalidatePath(`/users/${userId.toString()}`);
  revalidatePath(`/pool/${userId.toString()}`);
  revalidatePath(getReadOnlyBrowseAccessPath(userId));

  return {
    error: null,
    success: "관심 선택이 저장되었습니다.",
  };
}

export async function clearReadOnlyBrowseAccessAction(formData: FormData) {
  const userId = parseNamedId(formData, "userId");
  const cookieStore = await cookies();
  if (cookieStore.get(getReadOnlyBrowseCookieName(userId))) {
    cookieStore.set({
      name: getReadOnlyBrowseCookieName(userId),
      value: "",
      expires: new Date(0),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }

  redirect(getReadOnlyBrowseAccessPath(userId));
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

function parseExpiryDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(`${value}T23:59:59.999+09:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("만료일 형식이 올바르지 않습니다.");
  }
  return parsed;
}

function oneWeekFromNow() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  return expiresAt;
}
