"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOpsSession } from "@/lib/admin-access-server";
import {
  createOnboardingAccessToken,
  revokeOnboardingAccessToken,
  type CreateOnboardingAccessTokenResult,
} from "@/lib/onboarding-access-repository";

export type CreateOnboardingAccessTokenActionState = {
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

export async function createOnboardingAccessTokenWithStateAction(
  _prevState: CreateOnboardingAccessTokenActionState,
  formData: FormData,
): Promise<CreateOnboardingAccessTokenActionState> {
  await requireAdminOpsSession();
  const values = {
    label: readString(formData, "label") ?? "",
    expiresAt: readString(formData, "expiresAt") ?? "",
  };

  try {
    const userId = parseNamedId(formData, "userId");
    const createdToken = await createOnboardingAccessToken(userId, {
      label: values.label,
      expiresAt: parseExpiryDate(values.expiresAt),
    });

    revalidateOnboardingAccessTokenViews(userId, createdToken);

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
      error: error instanceof Error ? error.message : "온보딩 접근 토큰 생성 중 오류가 발생했습니다.",
      values,
    };
  }
}

export async function createQuickOnboardingAccessClipboardAction(userId: number) {
  await requireAdminOpsSession();
  const createdToken = await createOnboardingAccessToken(BigInt(userId), {
    label: `온보딩 접근 빠른 복사 ${new Intl.DateTimeFormat("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date())}`,
    expiresAt: null,
  });

  revalidatePath(`/users/${userId}`);

  return {
    accessUrl: createdToken.accessUrl,
    rawToken: createdToken.rawToken,
  };
}

export async function revokeOnboardingAccessTokenAction(formData: FormData) {
  await requireAdminOpsSession();
  const tokenId = parseNamedId(formData, "tokenId");
  const userId = parseNamedId(formData, "userId");

  await revokeOnboardingAccessToken(tokenId);
  revalidatePath(`/users/${userId.toString()}`);
}

function revalidateOnboardingAccessTokenViews(userId: bigint, createdToken: CreateOnboardingAccessTokenResult) {
  revalidatePath(`/users/${userId.toString()}`);
  revalidatePath(new URL(createdToken.accessUrl).pathname);
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
