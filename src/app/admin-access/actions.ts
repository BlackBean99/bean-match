"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createAdminAccessCookieValue,
  getAdminAccessCookieMaxAge,
  getAdminAccessCookieName,
  getAdminAccessCode,
  normalizeAdminAccessReturnPath,
} from "@/lib/admin-access";

export type AdminAccessActionState = {
  error: string | null;
};

export async function unlockAdminAccessAction(
  _prevState: AdminAccessActionState,
  formData: FormData,
): Promise<AdminAccessActionState> {
  const accessCode = formData.get("accessCode")?.toString().trim() ?? "";
  const returnPath = normalizeAdminAccessReturnPath(formData.get("returnPath")?.toString());
  const configuredCode = getAdminAccessCode();

  if (!configuredCode) {
    return {
      error: "ADMIN_ACCESS_CODE 가 설정되지 않았습니다. 운영 환경 변수부터 설정해 주세요.",
    };
  }

  if (!accessCode || accessCode !== configuredCode) {
    return {
      error: "접근 코드가 올바르지 않습니다.",
    };
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: getAdminAccessCookieName(),
    value: await createAdminAccessCookieValue(accessCode),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getAdminAccessCookieMaxAge(),
  });

  redirect(returnPath);
}
