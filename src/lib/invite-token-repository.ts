import { createHash, randomBytes } from "node:crypto";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { getAppBaseUrl, getSupabaseServerKey, getSupabaseUrl } from "@/lib/runtime-env";

const INVITE_ACCESS_TOKEN_PREFIX = "bbiv_";
const INVITE_ACCESS_TOUCH_WINDOW_MS = 15 * 60 * 1000;

type AccessIssue = "missing_token" | "invalid_token" | "database_unavailable";

type InviteTokenRecord = {
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

type SupabaseInviteTokenRow = {
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

export type InviteTokenSummary = {
  id: number;
  label: string;
  tokenHint: string;
  createdAt: string;
  expiresAt: string | null;
  isActive: boolean;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export type InviteTokenManagerData = {
  databaseConnected: boolean;
  loadError: string | null;
  token: InviteTokenSummary | null;
};

export type CreateInviteTokenResult = {
  accessUrl: string;
  rawToken: string;
  token: InviteTokenSummary;
};

export function buildInviteAccessUrl(rawToken: string) {
  return `${getAppBaseUrl()}/invite/${encodeURIComponent(rawToken)}`;
}

export async function getInviteTokenManagerData(userId: bigint): Promise<InviteTokenManagerData> {
  if (!hasInviteTokenStorageConfig()) {
    return {
      databaseConnected: false,
      loadError: "DATABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.",
      token: null,
    };
  }

  try {
    const token = await loadInviteTokenRow(userId);
    return {
      databaseConnected: true,
      loadError: null,
      token: token ? toInviteTokenSummary(toTokenRecord(token)) : null,
    };
  } catch (error) {
    return {
      databaseConnected: false,
      loadError: error instanceof Error ? error.message : "Invite token query failed.",
      token: null,
    };
  }
}

export async function createInviteAccessToken(
  userId: bigint,
  input: { label: string; expiresAt: Date | null },
): Promise<CreateInviteTokenResult> {
  if (!hasInviteTokenStorageConfig()) {
    throw new Error("DATABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  const label = input.label.trim();
  if (!label) throw new Error("토큰 라벨을 입력해 주세요.");
  if (label.length > 120) throw new Error("토큰 라벨은 120자 이하로 입력해 주세요.");
  if (input.expiresAt && input.expiresAt.getTime() <= Date.now()) {
    throw new Error("만료일은 현재 시각 이후여야 합니다.");
  }

  await assertUserExists(userId);

  const rawToken = generateInviteAccessToken();
  const tokenHash = hashInviteAccessToken(rawToken);
  const tokenHint = rawToken.slice(0, 16);
  const token = await upsertInviteTokenRow(userId, {
    label,
    tokenHash,
    tokenHint,
    expiresAt: input.expiresAt,
  });

  return {
    accessUrl: buildInviteAccessUrl(rawToken),
    rawToken,
    token: toInviteTokenSummary(toTokenRecord(token)),
  };
}

export async function validateInviteAccessToken(rawToken: string | null): Promise<ValidationResult> {
  try {
    if (!hasInviteTokenStorageConfig()) {
      return { ok: false, reason: "database_unavailable" };
    }

    const normalizedToken = rawToken?.trim();
    if (!normalizedToken) {
      return { ok: false, reason: "missing_token" };
    }

    const tokenHash = hashInviteAccessToken(normalizedToken);
    const token = await findInviteTokenRowByHash(tokenHash);

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

    try {
      await touchInviteToken(record);
    } catch {
      // Touching last-used-at should not block invite validation.
    }

    return {
      ok: true,
      label: record.label,
      expiresAt,
      userId: record.userId,
    };
  } catch {
    return { ok: false, reason: "database_unavailable" };
  }
}

function generateInviteAccessToken() {
  return `${INVITE_ACCESS_TOKEN_PREFIX}${randomBytes(24).toString("hex")}`;
}

function hashInviteAccessToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

function toInviteTokenSummary(token: InviteTokenRecord): InviteTokenSummary {
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

async function touchInviteToken(token: InviteTokenRecord) {
  if (token.lastUsedAt) {
    const lastUsedAt = new Date(token.lastUsedAt);
    if (!Number.isNaN(lastUsedAt.getTime()) && Date.now() - lastUsedAt.getTime() < INVITE_ACCESS_TOUCH_WINDOW_MS) {
      return;
    }
  }

  const timestamp = new Date();
  await updateInviteTokenRow(token.id, {
    lastUsedAt: timestamp,
  });
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
    throw new Error("초대 링크를 발급할 사용자를 찾을 수 없습니다.");
  }
}

function hasInviteTokenStorageConfig() {
  return hasDatabaseUrl() || Boolean(getSupabaseUrl() && getSupabaseServerKey());
}

async function loadInviteTokenRow(userId: bigint): Promise<InviteTokenRecord | null> {
  if (hasDatabaseUrl()) {
    const token = await prisma.inviteToken.findUnique({
      where: { userId },
    });
    return token ? toTokenRecord(token) : null;
  }

  const rows = await supabaseRest<SupabaseInviteTokenRow[]>(
    `/invite_tokens?select=id,user_id,label,token_hash,token_hint,expires_at,last_used_at,revoked_at,created_at&user_id=eq.${userId.toString()}&limit=1`,
  );
  return rows[0] ? toTokenRecord(rows[0]) : null;
}

async function findInviteTokenRowByHash(tokenHash: string): Promise<InviteTokenRecord | null> {
  if (hasDatabaseUrl()) {
    const token = await prisma.inviteToken.findUnique({
      where: { tokenHash },
    });
    return token ? toTokenRecord(token) : null;
  }

  const rows = await supabaseRest<SupabaseInviteTokenRow[]>(
    `/invite_tokens?select=id,user_id,label,token_hash,token_hint,expires_at,last_used_at,revoked_at,created_at&token_hash=eq.${tokenHash}&limit=1`,
  );
  return rows[0] ? toTokenRecord(rows[0]) : null;
}

async function upsertInviteTokenRow(
  userId: bigint,
  input: {
    label: string;
    tokenHash: string;
    tokenHint: string;
    expiresAt: Date | null;
  },
) {
  if (hasDatabaseUrl()) {
    return prisma.inviteToken.upsert({
      where: { userId },
      create: {
        userId,
        label: input.label,
        tokenHash: input.tokenHash,
        tokenHint: input.tokenHint,
        expiresAt: input.expiresAt,
      },
      update: {
        label: input.label,
        tokenHash: input.tokenHash,
        tokenHint: input.tokenHint,
        expiresAt: input.expiresAt,
        lastUsedAt: null,
        revokedAt: null,
      },
    });
  }

  const existing = await supabaseRest<SupabaseInviteTokenRow[]>(
    `/invite_tokens?select=id&user_id=eq.${userId.toString()}&limit=1`,
  );

  if (existing[0]) {
    const [updated] = await supabaseRest<SupabaseInviteTokenRow[]>(`/invite_tokens?id=eq.${existing[0].id}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        label: input.label,
        token_hash: input.tokenHash,
        token_hint: input.tokenHint,
        expires_at: input.expiresAt?.toISOString() ?? null,
        last_used_at: null,
        revoked_at: null,
      }),
    });
    return updated;
  }

  const [created] = await supabaseRest<SupabaseInviteTokenRow[]>("/invite_tokens?select=*", {
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
  return created;
}

async function updateInviteTokenRow(
  tokenId: number,
  input: {
    lastUsedAt?: Date | null;
    revokedAt?: Date | null;
  },
) {
  if (hasDatabaseUrl()) {
    await prisma.inviteToken.update({
      where: { id: BigInt(tokenId) },
      data: {
        ...(input.lastUsedAt ? { lastUsedAt: input.lastUsedAt } : {}),
        ...(input.revokedAt ? { revokedAt: input.revokedAt } : {}),
      },
    });
    return;
  }

  await supabaseRest(`/invite_tokens?id=eq.${tokenId}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...(input.lastUsedAt ? { last_used_at: input.lastUsedAt.toISOString() } : {}),
      ...(input.revokedAt ? { revoked_at: input.revokedAt.toISOString() } : {}),
    }),
  });
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
    | InviteTokenRecord
    | SupabaseInviteTokenRow
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
): InviteTokenRecord {
  if (isSupabaseInviteTokenRow(token)) {
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

  if (isInviteTokenRecord(token)) {
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

function isSupabaseInviteTokenRow(token: object): token is SupabaseInviteTokenRow {
  return "user_id" in token;
}

function isInviteTokenRecord(token: object): token is InviteTokenRecord {
  return "userId" in token && "createdAt" in token && typeof (token as InviteTokenRecord).createdAt === "string";
}
