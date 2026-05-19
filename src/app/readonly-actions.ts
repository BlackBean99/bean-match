"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createReadOnlyBrowseToken,
  getReadOnlyBrowseAccessPath,
  getReadOnlyBrowseCookieName,
  revokeReadOnlyBrowseToken,
  validateReadOnlyBrowseToken,
} from "@/lib/readonly-browse-repository";

export type CreateReadOnlyBrowseTokenActionState = {
  createdToken:
    | {
        accessUrl: string;
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

export async function createReadOnlyBrowseTokenWithStateAction(
  _prevState: CreateReadOnlyBrowseTokenActionState,
  formData: FormData,
): Promise<CreateReadOnlyBrowseTokenActionState> {
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
        accessUrl: createdToken.accessUrl,
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
      error: error instanceof Error ? error.message : "리드 온리 토큰 생성 중 오류가 발생했습니다.",
      values,
    };
  }
}

export async function revokeReadOnlyBrowseTokenAction(formData: FormData) {
  const tokenId = parseNamedId(formData, "tokenId");
  const userId = parseNamedId(formData, "userId");

  await revokeReadOnlyBrowseToken(tokenId);
  revalidatePath(`/users/${userId.toString()}`);
  revalidatePath(getReadOnlyBrowseAccessPath(userId));
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
          ? "리드 온리 토큰을 입력해 주세요."
          : validation.reason === "database_unavailable"
            ? "접근 토큰 저장소에 연결할 수 없습니다."
            : "토큰이 올바르지 않거나 이미 만료 또는 해제되었습니다.",
    };
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: getReadOnlyBrowseCookieName(userId),
    value: rawToken!.trim(),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: getReadOnlyBrowseAccessPath(userId),
    ...(validation.expiresAt ? { expires: validation.expiresAt } : {}),
  });

  redirect(getReadOnlyBrowseAccessPath(userId));
}

export async function clearReadOnlyBrowseAccessAction(formData: FormData) {
  const userId = parseNamedId(formData, "userId");
  const cookieStore = await cookies();
  cookieStore.set({
    name: getReadOnlyBrowseCookieName(userId),
    value: "",
    expires: new Date(0),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: getReadOnlyBrowseAccessPath(userId),
  });

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
