import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createOpsSessionCookieValue,
  getOpsSessionCookieName,
  getOpsSessionMaxAge,
  type OpsAccount,
  readOpsSessionCookieValue,
} from "@/lib/admin-access";

export async function getOpsSession() {
  const cookieStore = await cookies();
  return readOpsSessionCookieValue(cookieStore.get(getOpsSessionCookieName())?.value);
}

export async function requireOpsSession() {
  const session = await getOpsSession();
  if (!session) redirect("/admin-access");
  return session;
}

export async function requireAdminOpsSession() {
  const session = await requireOpsSession();
  if (session.role !== "ADMIN") {
    throw new Error("관리자 권한이 필요합니다.");
  }
  return session;
}

export async function setOpsSession(account: Pick<OpsAccount, "id" | "name" | "role">) {
  const cookieStore = await cookies();
  cookieStore.set({
    name: getOpsSessionCookieName(),
    value: await createOpsSessionCookieValue(account),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getOpsSessionMaxAge(),
  });
}

export async function clearOpsSession() {
  const cookieStore = await cookies();
  cookieStore.set({
    name: getOpsSessionCookieName(),
    value: "",
    expires: new Date(0),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}
