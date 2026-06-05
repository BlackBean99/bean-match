"use server";

import { redirect } from "next/navigation";
import {
  authenticateOpsCredentialsAsync,
  isOpsAuthConfiguredAsync,
  normalizeAdminAccessReturnPath,
} from "@/lib/admin-access";
import { clearOpsSession, setOpsSession } from "@/lib/admin-access-server";

export type AdminAccessActionState = {
  error: string | null;
};

export async function unlockAdminAccessAction(
  _prevState: AdminAccessActionState,
  formData: FormData,
): Promise<AdminAccessActionState> {
  const loginId = formData.get("loginId")?.toString().trim() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const returnPath = normalizeAdminAccessReturnPath(formData.get("returnPath")?.toString());

  if (!(await isOpsAuthConfiguredAsync())) {
    return {
      error: "운영 로그인 계정이 설정되지 않았습니다. 환경 변수부터 설정해 주세요.",
    };
  }

  const account = await authenticateOpsCredentialsAsync(loginId, password);
  if (!account) {
    return {
      error: "ID 또는 비밀번호가 올바르지 않습니다.",
    };
  }

  await setOpsSession(account);
  redirect(returnPath);
}

export async function logoutAdminAccessAction() {
  await clearOpsSession();
  redirect("/admin-access");
}
