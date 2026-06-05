import { getRuntimeEnv } from "@/lib/runtime-env";

const OPS_SESSION_COOKIE_NAME = "bb_ops_session";
const OPS_SESSION_MAX_AGE = 60 * 60 * 12;
const textEncoder = new TextEncoder();

export type OpsRole = "ADMIN" | "INVITOR";

export type OpsAccount = {
  id: string;
  name: string;
  password: string;
  role: OpsRole;
};

export type OpsSession = {
  id: string;
  name: string;
  role: OpsRole;
  expiresAt: number;
};

export function getOpsSessionCookieName() {
  return OPS_SESSION_COOKIE_NAME;
}

export function getOpsSessionMaxAge() {
  return OPS_SESSION_MAX_AGE;
}

export function isOpsAuthConfigured() {
  return Boolean(getOpsAuthSecret()) && getOpsAccounts().length > 0;
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

export function normalizeAdminAccessReturnPath(pathname: string | null | undefined) {
  if (!pathname || !pathname.startsWith("/")) return "/matches";
  if (pathname.startsWith("//")) return "/matches";
  if (pathname.startsWith("/admin-access")) return "/matches";
  return pathname;
}

export function authenticateOpsCredentials(loginId: string, password: string) {
  return getOpsAccounts().find((account) => account.id === loginId && account.password === password) ?? null;
}

export async function createOpsSessionCookieValue(account: Pick<OpsAccount, "id" | "name" | "role">) {
  const payload: OpsSession = {
    id: account.id,
    name: account.name,
    role: account.role,
    expiresAt: Date.now() + getOpsSessionMaxAge() * 1000,
  };
  const encodedPayload = encodeURIComponent(JSON.stringify(payload));
  const signature = await signValue(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function readOpsSessionCookieValue(cookieValue: string | undefined) {
  if (!cookieValue) return null;

  const separatorIndex = cookieValue.lastIndexOf(".");
  if (separatorIndex <= 0) return null;

  const encodedPayload = cookieValue.slice(0, separatorIndex);
  const signature = cookieValue.slice(separatorIndex + 1);
  const expectedSignature = await signValue(encodedPayload);
  if (signature !== expectedSignature) return null;

  try {
    const payload = JSON.parse(decodeURIComponent(encodedPayload)) as Partial<OpsSession>;
    if (
      typeof payload.id !== "string" ||
      typeof payload.name !== "string" ||
      (payload.role !== "ADMIN" && payload.role !== "INVITOR") ||
      typeof payload.expiresAt !== "number"
    ) {
      return null;
    }
    if (payload.expiresAt <= Date.now()) return null;
    return payload as OpsSession;
  } catch {
    return null;
  }
}

function getOpsAuthSecret() {
  const raw = getRuntimeEnv().OPS_AUTH_SECRET?.trim() ?? "";
  return raw.replace(/^OPS_AUTH_SECRET\s*=\s*/i, "").trim();
}

function getOpsAccounts(): OpsAccount[] {
  const parsed = parseOpsAccountsJson(getRuntimeEnv().OPS_AUTH_ACCOUNTS_JSON);
  if (!Array.isArray(parsed)) return [];

  try {
    return parsed.flatMap((candidate) => {
      if (
        !candidate ||
        typeof candidate !== "object" ||
        typeof candidate.id !== "string" ||
        typeof candidate.name !== "string" ||
        typeof candidate.password !== "string" ||
        (candidate.role !== "ADMIN" && candidate.role !== "INVITOR")
      ) {
        return [];
      }

      return [
        {
          id: candidate.id.trim(),
          name: candidate.name.trim(),
          password: candidate.password,
          role: candidate.role,
        } satisfies OpsAccount,
      ];
    });
  } catch {
    return [];
  }
}

function parseOpsAccountsJson(rawValue: string | undefined) {
  const raw = rawValue?.trim().replace(/^OPS_AUTH_ACCOUNTS_JSON\s*[:=]\s*/i, "") ?? "";
  if (!raw) return [];

  const candidates = [
    raw,
    unwrapMatchingQuotes(raw),
  ].filter((value, index, list): value is string => Boolean(value) && list.indexOf(value) === index);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (typeof parsed === "string") {
        try {
          return JSON.parse(parsed) as unknown;
        } catch {
          continue;
        }
      }
      return parsed;
    } catch {
      continue;
    }
  }

  return [];
}

function unwrapMatchingQuotes(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1).trim();
  }

  return value;
}

async function signValue(value: string) {
  const secret = getOpsAuthSecret();
  if (!secret) return "";

  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
