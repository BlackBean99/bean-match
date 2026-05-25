import { createHash, randomBytes } from "node:crypto";
import { getUserDetail } from "@/lib/member-repository";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import {
  getAppBaseUrl,
  getSupabaseServerKey,
  getSupabaseUrl,
} from "@/lib/runtime-env";

const ONBOARDING_ACCESS_TOKEN_PREFIX = "bboa_";
const ONBOARDING_ACCESS_TOUCH_WINDOW_MS = 15 * 60 * 1000;

type AccessIssue = "missing_token" | "invalid_token" | "database_unavailable";

type OnboardingAccessTokenRecord = {
  id: number;
  userId: number;
  label: string;
  tokenHash: string;
  tokenHint: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

type SupabaseOnboardingAccessTokenRow = {
  id: number;
  user_id: number;
  label: string;
  token_hash: string;
  token_hint: string;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

type SupabaseNotionRawRecordRow = {
  id: number;
  source_type: string;
  source_id: string;
  source_name: string;
  notion_page_id: string;
  payload: unknown;
  checksum: string;
  last_synced_at: string;
  notion_edited_at: string | null;
};

type FallbackOnboardingAccessTokenPayload = {
  createdAt: string;
  expiresAt: string | null;
  label: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  tokenHash: string;
  tokenHint: string;
  userId: number;
};

type OnboardingAccessTokenRowSource =
  | OnboardingAccessTokenRecord
  | SupabaseOnboardingAccessTokenRow
  | SupabaseNotionRawRecordRow
  | {
      id: bigint;
      userId: bigint;
      label: string;
      tokenHash: string;
      tokenHint: string;
      expiresAt: Date | null;
      lastUsedAt: Date | null;
      revokedAt: Date | null;
      createdAt: Date;
    };

type ValidationResult =
  | {
      ok: true;
      expiresAt: Date | null;
      label: string;
      userId: number;
    }
  | {
      ok: false;
      reason: AccessIssue;
    };

export type OnboardingAccessTokenSummary = {
  id: number;
  label: string;
  tokenHint: string;
  createdAt: string;
  expiresAt: string | null;
  isActive: boolean;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export type OnboardingAccessTokenManagerData = {
  databaseConnected: boolean;
  loadError: string | null;
  tokens: OnboardingAccessTokenSummary[];
};

export type CreateOnboardingAccessTokenResult = {
  accessUrl: string;
  rawToken: string;
  token: OnboardingAccessTokenSummary;
};

export type OnboardingAccessPageData = {
  accessIssue: AccessIssue | null;
  authorized: boolean;
  databaseConnected: boolean;
  defaultName: string | null;
  loadError: string | null;
  tokenLabel: string | null;
  userId: bigint | null;
};

export function getOnboardingAccessPath(rawToken: string) {
  return `/onboarding/access/${encodeURIComponent(rawToken)}`;
}

export function buildOnboardingAccessUrl(rawToken: string) {
  return `${getAppBaseUrl()}${getOnboardingAccessPath(rawToken)}`;
}

export async function getOnboardingAccessTokenManagerData(
  userId: bigint,
): Promise<OnboardingAccessTokenManagerData> {
  if (!hasOnboardingAccessStorageConfig()) {
    return {
      databaseConnected: false,
      loadError: "DATABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.",
      tokens: [],
    };
  }

  try {
    const tokens = await loadOnboardingAccessTokenRows(userId);

    return {
      databaseConnected: true,
      loadError: null,
      tokens: tokens.map((token: OnboardingAccessTokenRowSource) => toOnboardingAccessTokenSummary(toTokenRecord(token))),
    };
  } catch (error) {
    return {
      databaseConnected: false,
      loadError: error instanceof Error ? error.message : "Onboarding access token query failed.",
      tokens: [],
    };
  }
}

export async function createOnboardingAccessToken(
  userId: bigint,
  input: { label: string; expiresAt: Date | null },
): Promise<CreateOnboardingAccessTokenResult> {
  if (!hasOnboardingAccessStorageConfig()) {
    throw new Error("DATABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  const label = input.label.trim();
  if (!label) throw new Error("토큰 라벨을 입력해 주세요.");
  if (label.length > 120) throw new Error("토큰 라벨은 120자 이하로 입력해 주세요.");
  if (input.expiresAt && input.expiresAt.getTime() <= Date.now()) {
    throw new Error("만료일은 현재 시각 이후여야 합니다.");
  }

  await assertUserExists(userId);

  const rawToken = generateOnboardingAccessToken();
  const tokenHash = hashOnboardingAccessToken(rawToken);
  const tokenHint = rawToken.slice(0, 16);

  const token = await createOnboardingAccessTokenRow(userId, {
    label,
    tokenHash,
    tokenHint,
    expiresAt: input.expiresAt,
  });

  if (!token) {
    throw new Error("온보딩 접근 토큰 생성 결과를 확인하지 못했습니다.");
  }

  const summary = toOnboardingAccessTokenSummary(toTokenRecord(token));
  return {
    accessUrl: buildOnboardingAccessUrl(rawToken),
    rawToken,
    token: summary,
  };
}

export async function revokeOnboardingAccessToken(tokenId: bigint) {
  if (!hasOnboardingAccessStorageConfig()) {
    throw new Error("DATABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  await revokeOnboardingAccessTokenRow(tokenId);
}

export async function getOnboardingAccessPageData(rawToken: string): Promise<OnboardingAccessPageData> {
  if (!hasOnboardingAccessStorageConfig()) {
    return {
      accessIssue: "database_unavailable",
      authorized: false,
      databaseConnected: false,
      defaultName: null,
      loadError: "온보딩 접근 토큰 저장소에 연결할 수 없습니다.",
      tokenLabel: null,
      userId: null,
    };
  }

  const validation = await validateOnboardingAccessToken(rawToken);
  if (!validation.ok) {
    return {
      accessIssue: validation.reason,
      authorized: false,
      databaseConnected: validation.reason !== "database_unavailable",
      defaultName: null,
      loadError: validation.reason === "database_unavailable" ? "온보딩 접근 토큰 저장소에 연결할 수 없습니다." : null,
      tokenLabel: null,
      userId: null,
    };
  }

  const userId = BigInt(validation.userId);
  const user = await getUserDetail(userId);
  if (!user) {
    return {
      accessIssue: null,
      authorized: true,
      databaseConnected: false,
      defaultName: null,
      loadError: "온보딩 대상 사용자 정보를 찾을 수 없습니다.",
      tokenLabel: validation.label,
      userId,
    };
  }

  return {
    accessIssue: null,
    authorized: true,
    databaseConnected: true,
    defaultName: user.name,
    loadError: null,
    tokenLabel: validation.label,
    userId,
  };
}

export async function validateOnboardingAccessToken(rawToken: string | null): Promise<ValidationResult> {
  if (!hasOnboardingAccessStorageConfig()) {
    return { ok: false, reason: "database_unavailable" };
  }

  const normalizedToken = rawToken?.trim();
  if (!normalizedToken) {
    return { ok: false, reason: "missing_token" };
  }

  const tokenHash = hashOnboardingAccessToken(normalizedToken);
  const token = await findOnboardingAccessTokenRowByHash(tokenHash);

  if (!token) {
    return { ok: false, reason: "invalid_token" };
  }

  const record = toTokenRecord(token);
  if (record.revokedAt) {
    return { ok: false, reason: "invalid_token" };
  }

  const expiresAt = record.expiresAt ? new Date(record.expiresAt) : null;
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "invalid_token" };
  }

  await touchOnboardingAccessToken(record);

  return {
    ok: true,
    expiresAt,
    label: record.label,
    userId: record.userId,
  };
}

function generateOnboardingAccessToken() {
  return `${ONBOARDING_ACCESS_TOKEN_PREFIX}${randomBytes(24).toString("hex")}`;
}

function hashOnboardingAccessToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

function toOnboardingAccessTokenSummary(token: OnboardingAccessTokenRecord): OnboardingAccessTokenSummary {
  const expired = token.expiresAt ? new Date(token.expiresAt).getTime() <= Date.now() : false;
  const revoked = Boolean(token.revokedAt);

  return {
    id: token.id,
    label: token.label,
    tokenHint: token.tokenHint,
    createdAt: formatShortDateTime(token.createdAt),
    expiresAt: token.expiresAt ? formatShortDateTime(token.expiresAt) : null,
    isActive: !revoked && !expired,
    lastUsedAt: token.lastUsedAt ? formatShortDateTime(token.lastUsedAt) : null,
    revokedAt: token.revokedAt ? formatShortDateTime(token.revokedAt) : null,
  };
}

async function touchOnboardingAccessToken(token: OnboardingAccessTokenRecord) {
  if (token.lastUsedAt) {
    const lastUsedAt = new Date(token.lastUsedAt);
    if (
      !Number.isNaN(lastUsedAt.getTime()) &&
      Date.now() - lastUsedAt.getTime() < ONBOARDING_ACCESS_TOUCH_WINDOW_MS
    ) {
      return;
    }
  }

  const timestamp = new Date();
  await touchOnboardingAccessTokenRow(token, timestamp);
}

async function assertUserExists(userId: bigint) {
  const userExists = hasDatabaseUrl()
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      })
    : (
        await supabaseRest<{ id: number }[]>(
          `/users?select=id&id=eq.${userId.toString()}&limit=1`,
        )
      )[0];

  if (!userExists) {
    throw new Error("온보딩 토큰을 발급할 사용자를 찾을 수 없습니다.");
  }
}

function hasOnboardingAccessStorageConfig() {
  return hasDatabaseUrl() || Boolean(getSupabaseUrl() && getSupabaseServerKey());
}

async function supabaseRest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getSupabaseUrl()}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: getSupabaseServerKey(),
      Authorization: `Bearer ${getSupabaseServerKey()}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase REST ${response.status}: ${text}`);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function formatShortDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function toTokenRecord(
  token:
    | OnboardingAccessTokenRecord
    | SupabaseOnboardingAccessTokenRow
    | SupabaseNotionRawRecordRow
    | {
        id: bigint;
        userId: bigint;
        label: string;
        tokenHash: string;
        tokenHint: string;
        expiresAt: Date | null;
        lastUsedAt: Date | null;
        revokedAt: Date | null;
        createdAt: Date;
      },
): OnboardingAccessTokenRecord {
  if (isSupabaseOnboardingAccessTokenRow(token)) {
    return {
      id: token.id,
      userId: token.user_id,
      label: token.label,
      tokenHash: token.token_hash,
      tokenHint: token.token_hint,
      expiresAt: token.expires_at,
      lastUsedAt: token.last_used_at,
      revokedAt: token.revoked_at,
      createdAt: token.created_at,
    };
  }

  if (isSupabaseNotionRawRecordRow(token)) {
    const payload = normalizeFallbackPayload(token.payload);
    return {
      id: token.id,
      userId: payload.userId,
      label: payload.label,
      tokenHash: payload.tokenHash,
      tokenHint: payload.tokenHint,
      expiresAt: payload.expiresAt,
      lastUsedAt: payload.lastUsedAt,
      revokedAt: payload.revokedAt,
      createdAt: payload.createdAt,
    };
  }

  if (isOnboardingAccessTokenRecord(token)) {
    return token;
  }

  return {
    id: Number(token.id),
    userId: Number(token.userId),
    label: token.label,
    tokenHash: token.tokenHash,
    tokenHint: token.tokenHint,
    expiresAt: token.expiresAt?.toISOString() ?? null,
    lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
    revokedAt: token.revokedAt?.toISOString() ?? null,
    createdAt: token.createdAt.toISOString(),
  };
}

function isSupabaseOnboardingAccessTokenRow(token: object): token is SupabaseOnboardingAccessTokenRow {
  return "user_id" in token;
}

function isSupabaseNotionRawRecordRow(token: object): token is SupabaseNotionRawRecordRow {
  return "source_type" in token && "payload" in token && "notion_page_id" in token;
}

function isOnboardingAccessTokenRecord(token: object): token is OnboardingAccessTokenRecord {
  return "userId" in token && "createdAt" in token && typeof (token as OnboardingAccessTokenRecord).createdAt === "string";
}

async function loadOnboardingAccessTokenRows(userId: bigint): Promise<OnboardingAccessTokenRowSource[]> {
  if (hasDatabaseUrl()) {
    return prisma.onboardingAccessToken.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  try {
    return await supabaseRest<OnboardingAccessTokenRowSource[]>(
      `/onboarding_access_tokens?select=id,user_id,label,token_hash,token_hint,expires_at,last_used_at,revoked_at,created_at&user_id=eq.${userId.toString()}&order=created_at.desc,id.desc`,
    );
  } catch (error) {
    if (!isMissingDedicatedOnboardingTokenTable(error)) throw error;

    return await supabaseRest<OnboardingAccessTokenRowSource[]>(
      `/notion_raw_records?select=id,source_type,source_id,source_name,notion_page_id,payload,checksum,last_synced_at,notion_edited_at&source_type=eq.onboarding_access_token&source_id=eq.${userId.toString()}&order=last_synced_at.desc,id.desc`,
    );
  }
}

async function createOnboardingAccessTokenRow(
  userId: bigint,
  input: {
    label: string;
    tokenHash: string;
    tokenHint: string;
    expiresAt: Date | null;
  },
) {
  if (hasDatabaseUrl()) {
    return prisma.onboardingAccessToken.create({
      data: {
        userId,
        label: input.label,
        tokenHash: input.tokenHash,
        tokenHint: input.tokenHint,
        expiresAt: input.expiresAt,
      },
    });
  }

  try {
    const rows = await supabaseRest<SupabaseOnboardingAccessTokenRow[]>("/onboarding_access_tokens?select=*", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: Number(userId),
        label: input.label,
        token_hash: input.tokenHash,
        token_hint: input.tokenHint,
        expires_at: input.expiresAt?.toISOString() ?? null,
      }),
    });
    return rows[0];
  } catch (error) {
    if (!isMissingDedicatedOnboardingTokenTable(error)) throw error;

    const createdAt = new Date().toISOString();
    const payload: FallbackOnboardingAccessTokenPayload = {
      createdAt,
      expiresAt: input.expiresAt?.toISOString() ?? null,
      label: input.label,
      lastUsedAt: null,
      revokedAt: null,
      tokenHash: input.tokenHash,
      tokenHint: input.tokenHint,
      userId: Number(userId),
    };

    const rows = await supabaseRest<SupabaseNotionRawRecordRow[]>("/notion_raw_records?select=*", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        source_type: "onboarding_access_token",
        source_id: userId.toString(),
        source_name: input.label.slice(0, 100),
        notion_page_id: input.tokenHash,
        payload,
        checksum: hashPayload(payload),
        last_synced_at: createdAt,
        notion_edited_at: null,
      }),
    });

    return rows[0];
  }
}

async function revokeOnboardingAccessTokenRow(tokenId: bigint) {
  const revokedAt = new Date().toISOString();

  if (hasDatabaseUrl()) {
    await prisma.onboardingAccessToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date(revokedAt) },
    });
    return;
  }

  try {
    await supabaseRest(`/onboarding_access_tokens?id=eq.${tokenId.toString()}`, {
      method: "PATCH",
      body: JSON.stringify({ revoked_at: revokedAt }),
    });
    return;
  } catch (error) {
    if (!isMissingDedicatedOnboardingTokenTable(error)) throw error;

    const record = await findFallbackOnboardingAccessTokenRowById(tokenId);
    if (!record) throw new Error("온보딩 접근 토큰을 찾을 수 없습니다.");

    const payload = normalizeFallbackPayload(record.payload);
    const nextPayload: FallbackOnboardingAccessTokenPayload = {
      ...payload,
      revokedAt,
    };

    await supabaseRest(`/notion_raw_records?source_type=eq.onboarding_access_token&id=eq.${tokenId.toString()}`, {
      method: "PATCH",
      body: JSON.stringify({
        payload: nextPayload,
        checksum: hashPayload(nextPayload),
        last_synced_at: revokedAt,
      }),
    });
  }
}

async function findOnboardingAccessTokenRowByHash(tokenHash: string) {
  if (hasDatabaseUrl()) {
    return prisma.onboardingAccessToken.findFirst({
      where: { tokenHash },
    });
  }

  try {
    return (
      await supabaseRest<SupabaseOnboardingAccessTokenRow[]>(
        `/onboarding_access_tokens?select=id,user_id,label,token_hash,token_hint,expires_at,last_used_at,revoked_at,created_at&token_hash=eq.${tokenHash}&limit=1`,
      )
    )[0];
  } catch (error) {
    if (!isMissingDedicatedOnboardingTokenTable(error)) throw error;

    return (
      await supabaseRest<SupabaseNotionRawRecordRow[]>(
        `/notion_raw_records?select=id,source_type,source_id,source_name,notion_page_id,payload,checksum,last_synced_at,notion_edited_at&notion_page_id=eq.${tokenHash}&limit=1`,
      )
    )[0];
  }
}

async function findFallbackOnboardingAccessTokenRowById(tokenId: bigint) {
  const rows = await supabaseRest<SupabaseNotionRawRecordRow[]>(
    `/notion_raw_records?select=id,source_type,source_id,source_name,notion_page_id,payload,checksum,last_synced_at,notion_edited_at&source_type=eq.onboarding_access_token&id=eq.${tokenId.toString()}&limit=1`,
  );
  return rows[0];
}

async function touchOnboardingAccessTokenRow(token: OnboardingAccessTokenRecord, timestamp: Date) {
  if (hasDatabaseUrl()) {
    await prisma.onboardingAccessToken.update({
      where: { id: BigInt(token.id) },
      data: { lastUsedAt: timestamp },
    });
    return;
  }

  try {
    await supabaseRest(`/onboarding_access_tokens?id=eq.${token.id}`, {
      method: "PATCH",
      body: JSON.stringify({ last_used_at: timestamp.toISOString() }),
    });
    return;
  } catch (error) {
    if (!isMissingDedicatedOnboardingTokenTable(error)) throw error;

    const nextPayload: FallbackOnboardingAccessTokenPayload = {
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
      label: token.label,
      lastUsedAt: timestamp.toISOString(),
      revokedAt: token.revokedAt,
      tokenHash: token.tokenHash,
      tokenHint: token.tokenHint,
      userId: token.userId,
    };

    await supabaseRest(`/notion_raw_records?source_type=eq.onboarding_access_token&id=eq.${token.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        payload: nextPayload,
        checksum: hashPayload(nextPayload),
        last_synced_at: timestamp.toISOString(),
      }),
    });
  }
}

function normalizeFallbackPayload(payload: unknown): FallbackOnboardingAccessTokenPayload {
  const raw = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  return {
    createdAt: readStringValue(raw.createdAt) ?? new Date().toISOString(),
    expiresAt: readNullableStringValue(raw.expiresAt),
    label: readStringValue(raw.label) ?? "",
    lastUsedAt: readNullableStringValue(raw.lastUsedAt),
    revokedAt: readNullableStringValue(raw.revokedAt),
    tokenHash: readStringValue(raw.tokenHash) ?? "",
    tokenHint: readStringValue(raw.tokenHint) ?? "",
    userId: readNumberValue(raw.userId) ?? 0,
  };
}

function hashPayload(payload: FallbackOnboardingAccessTokenPayload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function readStringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function readNullableStringValue(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function readNumberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function isMissingDedicatedOnboardingTokenTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("PGRST205") && message.includes("onboarding_access_tokens");
}
