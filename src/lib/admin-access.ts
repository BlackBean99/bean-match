const ADMIN_ACCESS_COOKIE_NAME = "bb_admin_access";
const ADMIN_ACCESS_COOKIE_MAX_AGE = 60 * 60 * 12;
const textEncoder = new TextEncoder();

export function getAdminAccessCookieName() {
  return ADMIN_ACCESS_COOKIE_NAME;
}

export function getAdminAccessCookieMaxAge() {
  return ADMIN_ACCESS_COOKIE_MAX_AGE;
}

export function getAdminAccessCode() {
  return process.env.ADMIN_ACCESS_CODE?.trim() ?? "";
}

export function isAdminAccessConfigured() {
  return getAdminAccessCode().length > 0;
}

export function isPublicAppPath(pathname: string) {
  return (
    pathname.startsWith("/admin-access") ||
    pathname.startsWith("/offer/") ||
    pathname.startsWith("/readonly/") ||
    pathname.startsWith("/onboarding/access/") ||
    pathname.startsWith("/invite/") ||
    pathname.startsWith("/api/photos/")
  );
}

export async function createAdminAccessCookieValue(accessCode: string) {
  return hashAccessCode(accessCode.trim());
}

export async function hasValidAdminAccessCookie(cookieValue: string | undefined) {
  if (!cookieValue) return false;

  const configuredCode = getAdminAccessCode();
  if (!configuredCode) return false;

  return cookieValue === (await hashAccessCode(configuredCode));
}

export function normalizeAdminAccessReturnPath(pathname: string | null | undefined) {
  if (!pathname || !pathname.startsWith("/")) return "/matches";
  if (pathname.startsWith("//")) return "/matches";
  if (pathname.startsWith("/admin-access")) return "/matches";
  return pathname;
}

async function hashAccessCode(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
