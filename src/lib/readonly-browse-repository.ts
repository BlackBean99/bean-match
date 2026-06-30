import { createHash, randomBytes } from "node:crypto";
import { type InterestSource, type InterestStatus } from "@prisma/client";
import {
  type DashboardUser,
  type DashboardUserPhoto,
  type ParticipantInterestSelection,
  activeIntroStatuses,
} from "@/lib/domain";
import { getMemberDashboardData, sortUserPhotosForDisplay } from "@/lib/member-repository";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import {
  getAppBaseUrl,
  getSupabaseServerKey,
  getSupabaseUrl,
} from "@/lib/runtime-env";
import { MAX_NEW_USER_MARKS } from "@/lib/auto-exposure-repository";
import { toDashboardPhotoLike } from "@/lib/member-repository";

const READ_ONLY_BROWSE_TOKEN_PREFIX = "bbro_";
const READ_ONLY_BROWSE_TOUCH_WINDOW_MS = 15 * 60 * 1000;

type AccessIssue = "missing_token" | "invalid_token" | "database_unavailable";

type ReadOnlyBrowseTokenRecord = {
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

type SupabaseReadOnlyBrowseTokenRow = {
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

type UserPhotoRecord = {
  id: number;
  userId: number;
  originalFileName: string;
  filePath: string;
  fileUrl: string | null;
  sortOrder: number;
  isMain: boolean;
  uploadedAt: string;
};

type SupabaseUserPhotoRow = {
  id: number;
  user_id: number;
  original_file_name: string;
  file_path: string;
  file_url: string | null;
  sort_order: number;
  is_main: boolean;
  uploaded_at: string;
};

type ValidationResult =
  | {
      ok: true;
      label: string;
      expiresAt: Date | null;
    }
  | {
      ok: false;
      reason: AccessIssue;
    };

export type ReadOnlyBrowseCandidate = DashboardUser & {
  photos: DashboardUserPhoto[];
  hasIntroHistory: boolean;
};

export type ReadOnlyBrowsePageData = {
  accessPath: string;
  accessToken: string | null;
  accessIssue: AccessIssue | null;
  actor: DashboardUser | null;
  authorized: boolean;
  candidates: ReadOnlyBrowseCandidate[];
  browseSelections: ParticipantInterestSelection[];
  receivedInterests: ReadOnlyBrowseReceivedInterest[];
  browseLimit: number;
  browseSubmitted: boolean;
  canSubmitInterests: boolean;
  databaseConnected: boolean;
  loadError: string | null;
  tokenLabel: string | null;
};

export type ReadOnlyBrowseTokenSummary = {
  id: number;
  label: string;
  tokenHint: string;
  createdAt: string;
  expiresAt: string | null;
  isActive: boolean;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export type ReadOnlyBrowseReceivedInterest = {
  id: number;
  fromUserId: number;
  fromUserName: string;
  source: InterestSource;
  status: InterestStatus;
  createdAt: string;
  isMutual: boolean;
  photos: DashboardUserPhoto[];
};

export type ReadOnlyBrowseTokenManagerData = {
  accessPath: string;
  databaseConnected: boolean;
  loadError: string | null;
  tokens: ReadOnlyBrowseTokenSummary[];
};

export type CreateReadOnlyBrowseTokenResult = {
  accessPath: string;
  rawToken: string;
  token: ReadOnlyBrowseTokenSummary;
};

export function getReadOnlyBrowseAccessPath(userId: bigint | number | string) {
  return `/offer/pool/${userId.toString()}`;
}

export function buildReadOnlyBrowseAccessUrl(userId: bigint | number | string) {
  return `${getAppBaseUrl()}${getReadOnlyBrowseAccessPath(userId)}`;
}

export function buildReadOnlyBrowseAccessUrlWithToken(userId: bigint | number | string, rawToken: string) {
  return `${buildReadOnlyBrowseAccessUrl(userId)}?token=${encodeURIComponent(rawToken)}`;
}

export function getReadOnlyBrowseCookieName(userId: bigint | number | string) {
  return `bb_readonly_browse_${userId.toString()}`;
}

export async function getReadOnlyBrowseTokenManagerData(userId: bigint): Promise<ReadOnlyBrowseTokenManagerData> {
  const accessPath = getReadOnlyBrowseAccessPath(userId);
  if (!hasReadOnlyBrowseStorageConfig()) {
    return {
      accessPath,
      databaseConnected: false,
      loadError: "DATABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.",
      tokens: [],
    };
  }

  try {
    const tokens = hasDatabaseUrl()
      ? await prisma.readOnlyBrowseToken.findMany({
          where: { userId },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        })
      : await supabaseRest<SupabaseReadOnlyBrowseTokenRow[]>(
          `/read_only_browse_tokens?select=id,user_id,label,token_hash,token_hint,expires_at,last_used_at,revoked_at,created_at&user_id=eq.${userId.toString()}&order=created_at.desc,id.desc`,
        );

    return {
      accessPath,
      databaseConnected: true,
      loadError: null,
      tokens: tokens.map((token) => toReadOnlyBrowseTokenSummary(toTokenRecord(token))),
    };
  } catch (error) {
    return {
      accessPath,
      databaseConnected: false,
      loadError: error instanceof Error ? error.message : "Read-only token query failed.",
      tokens: [],
    };
  }
}

export async function createReadOnlyBrowseToken(
  userId: bigint,
  input: { label: string; expiresAt: Date | null },
): Promise<CreateReadOnlyBrowseTokenResult> {
  if (!hasReadOnlyBrowseStorageConfig()) {
    throw new Error("DATABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  const label = input.label.trim();
  if (!label) throw new Error("토큰 라벨을 입력해 주세요.");
  if (label.length > 120) throw new Error("토큰 라벨은 120자 이하로 입력해 주세요.");
  if (input.expiresAt && input.expiresAt.getTime() <= Date.now()) {
    throw new Error("만료일은 현재 시각 이후여야 합니다.");
  }

  await assertUserExists(userId);

  const rawToken = generateReadOnlyBrowseToken();
  const tokenHash = hashReadOnlyBrowseToken(rawToken);
  const tokenHint = rawToken.slice(0, 16);

  const token = hasDatabaseUrl()
    ? await prisma.readOnlyBrowseToken.create({
        data: {
          userId,
          label,
          tokenHash,
          tokenHint,
          expiresAt: input.expiresAt,
        },
      })
    : (
        await supabaseRest<SupabaseReadOnlyBrowseTokenRow[]>("/read_only_browse_tokens?select=*", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            user_id: Number(userId),
            label,
            token_hash: tokenHash,
            token_hint: tokenHint,
            expires_at: input.expiresAt?.toISOString() ?? null,
          }),
        })
      )[0];

  if (!token) {
    throw new Error("리드 온리 토큰 생성 결과를 확인하지 못했습니다.");
  }

  const summary = toReadOnlyBrowseTokenSummary(toTokenRecord(token));
  return {
    accessPath: buildReadOnlyBrowseAccessUrlWithToken(userId, rawToken),
    rawToken,
    token: summary,
  };
}

export async function revokeReadOnlyBrowseToken(tokenId: bigint) {
  if (!hasReadOnlyBrowseStorageConfig()) {
    throw new Error("DATABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  const revokedAt = new Date();
  if (hasDatabaseUrl()) {
    await prisma.readOnlyBrowseToken.update({
      where: { id: tokenId },
      data: { revokedAt },
    });
    return;
  }

  await supabaseRest(`/read_only_browse_tokens?id=eq.${tokenId.toString()}`, {
    method: "PATCH",
    body: JSON.stringify({ revoked_at: revokedAt.toISOString() }),
  });
}

export async function getReadOnlyBrowsePageData(
  userId: bigint,
  rawToken: string | null,
): Promise<ReadOnlyBrowsePageData> {
  const accessPath = getReadOnlyBrowseAccessPath(userId);
  if (!hasReadOnlyBrowseStorageConfig()) {
    return {
      accessPath,
      accessToken: null,
      accessIssue: "database_unavailable",
      actor: null,
      authorized: false,
      candidates: [],
      browseSelections: [],
      receivedInterests: [],
      browseLimit: MAX_NEW_USER_MARKS,
      browseSubmitted: false,
      canSubmitInterests: false,
      databaseConnected: false,
      loadError: "지금은 링크 정보를 확인할 수 없습니다.",
      tokenLabel: null,
    };
  }

  const validation = await validateReadOnlyBrowseToken(userId, rawToken);
  if (!validation.ok) {
    return {
      accessPath,
      accessToken: null,
      accessIssue: validation.reason,
      actor: null,
      authorized: false,
      candidates: [],
      browseSelections: [],
      receivedInterests: [],
      browseLimit: MAX_NEW_USER_MARKS,
      browseSubmitted: false,
      canSubmitInterests: false,
      databaseConnected: validation.reason !== "database_unavailable",
      loadError: validation.reason === "database_unavailable" ? "지금은 링크 정보를 확인할 수 없습니다." : null,
      tokenLabel: null,
    };
  }

  const memberData = await getMemberDashboardData(
    undefined,
    {
      includeIntroCases: true,
      includeRoles: false,
      includeMainPhotos: false,
    },
  );
  const actor = memberData.allUsers.find((user) => user.id === Number(userId)) ?? null;

  if (!memberData.databaseConnected) {
    return {
      accessPath,
      accessToken: rawToken?.trim() ?? null,
      accessIssue: null,
      actor,
      authorized: true,
      candidates: [],
      browseSelections: [],
      receivedInterests: [],
      browseLimit: MAX_NEW_USER_MARKS,
      browseSubmitted: false,
      canSubmitInterests: false,
      databaseConnected: false,
      loadError: memberData.loadError,
      tokenLabel: validation.label,
    };
  }

  if (!actor) {
    return {
      accessPath,
      accessToken: rawToken?.trim() ?? null,
      accessIssue: null,
      actor: null,
      authorized: true,
      candidates: [],
      browseSelections: [],
      receivedInterests: [],
      browseLimit: MAX_NEW_USER_MARKS,
      browseSubmitted: false,
      canSubmitInterests: false,
      databaseConnected: false,
      loadError: "열람 대상 사용자를 찾을 수 없습니다.",
      tokenLabel: validation.label,
    };
  }

  const outgoingBrowse = await loadReadOnlyBrowseInterests(userId).catch(() => []);
  const incomingBrowse = await loadReceivedReadOnlyBrowseInterests(userId).catch(() => []);
  const browseSelections = outgoingBrowse.map((interest) => toParticipantInterestSelection(interest, memberData.allUsers));
  const receivedPhotosByUserId = await getPhotosByUserIds(incomingBrowse.map((interest) => BigInt(interest.from_user_id)));
  const receivedInterests = incomingBrowse.map((interest) =>
    toReadOnlyReceivedInterest(interest, memberData.allUsers, outgoingBrowse, receivedPhotosByUserId),
  );
  const browseSubmitted = outgoingBrowse.length > 0;

  const activeIntroUserIds = new Set(
    memberData.introCases
      .filter((introCase) => activeIntroStatuses.includes(introCase.status))
      .flatMap((introCase) => introCase.participantIds),
  );
  const historicalPairKeys = new Set(
    memberData.introCases
      .filter((introCase) => introCase.participantIds.length === 2)
      .map((introCase) => {
        const [userAId, userBId] = introCase.participantIds as [number, number];
        return pairKey(userAId, userBId);
      }),
  );

  const candidateUsers = memberData.allUsers.filter((candidate) =>
    isReadOnlyBrowseCandidate(actor, candidate, activeIntroUserIds),
  );
  const photosByUserId = await getPhotosByUserIds(candidateUsers.map((candidate) => BigInt(candidate.id)));
  const candidates = candidateUsers.map((candidate) => ({
    ...candidate,
    photos: photosByUserId.get(candidate.id) ?? [],
    hasIntroHistory: historicalPairKeys.has(pairKey(actor.id, candidate.id)),
  }));

  return {
    accessPath,
    accessToken: rawToken?.trim() ?? null,
    accessIssue: null,
    actor,
    authorized: true,
    candidates,
    browseSelections,
    receivedInterests,
    browseLimit: MAX_NEW_USER_MARKS,
    browseSubmitted,
    canSubmitInterests:
      actor.status === "READY" &&
      actor.openLevel !== "PRIVATE" &&
      actor.exposureConsent &&
      !actor.exposurePaused &&
      !activeIntroUserIds.has(actor.id),
    databaseConnected: true,
    loadError: null,
    tokenLabel: validation.label,
  };
}

export async function validateReadOnlyBrowseToken(
  userId: bigint,
  rawToken: string | null,
): Promise<ValidationResult> {
  if (!hasReadOnlyBrowseStorageConfig()) {
    return { ok: false, reason: "database_unavailable" };
  }

  const normalizedToken = rawToken?.trim();
  if (!normalizedToken) {
    return { ok: false, reason: "missing_token" };
  }

  const tokenHash = hashReadOnlyBrowseToken(normalizedToken);

  const token = hasDatabaseUrl()
    ? await prisma.readOnlyBrowseToken.findFirst({
        where: {
          userId,
          tokenHash,
        },
      })
    : (
        await supabaseRest<SupabaseReadOnlyBrowseTokenRow[]>(
          `/read_only_browse_tokens?select=id,user_id,label,token_hash,token_hint,expires_at,last_used_at,revoked_at,created_at&user_id=eq.${userId.toString()}&token_hash=eq.${tokenHash}&limit=1`,
        )
      )[0];

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

  await touchReadOnlyBrowseToken(record);

  return {
    ok: true,
    label: record.label,
    expiresAt,
  };
}

function generateReadOnlyBrowseToken() {
  return `${READ_ONLY_BROWSE_TOKEN_PREFIX}${randomBytes(24).toString("hex")}`;
}

function hashReadOnlyBrowseToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

function toReadOnlyBrowseTokenSummary(token: ReadOnlyBrowseTokenRecord): ReadOnlyBrowseTokenSummary {
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

async function touchReadOnlyBrowseToken(token: ReadOnlyBrowseTokenRecord) {
  if (token.lastUsedAt) {
    const lastUsedAt = new Date(token.lastUsedAt);
    if (!Number.isNaN(lastUsedAt.getTime()) && Date.now() - lastUsedAt.getTime() < READ_ONLY_BROWSE_TOUCH_WINDOW_MS) {
      return;
    }
  }

  const timestamp = new Date();
  if (hasDatabaseUrl()) {
    await prisma.readOnlyBrowseToken.update({
      where: { id: BigInt(token.id) },
      data: { lastUsedAt: timestamp },
    });
    return;
  }

  await supabaseRest(`/read_only_browse_tokens?id=eq.${token.id}`, {
    method: "PATCH",
    body: JSON.stringify({ last_used_at: timestamp.toISOString() }),
  });
}

async function getPhotosByUserIds(userIds: bigint[]) {
  const normalizedIds = [...new Set(userIds.map((userId) => Number(userId)))];
  const photosByUserId = new Map<number, DashboardUserPhoto[]>();
  if (normalizedIds.length === 0) return photosByUserId;

  const photoRecords = hasDatabaseUrl()
    ? (
        await prisma.userPhoto.findMany({
          where: {
            userId: { in: normalizedIds.map((userId) => BigInt(userId)) },
            deletedAt: null,
          },
          select: {
            id: true,
            userId: true,
            originalFileName: true,
            filePath: true,
            fileUrl: true,
            sortOrder: true,
            isMain: true,
            uploadedAt: true,
          },
          orderBy: [{ userId: "asc" }, { isMain: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
        })
      ).map((photo) => ({
        id: Number(photo.id),
        userId: Number(photo.userId),
        originalFileName: photo.originalFileName,
        filePath: photo.filePath,
        fileUrl: photo.fileUrl,
        sortOrder: photo.sortOrder,
        isMain: photo.isMain,
        uploadedAt: photo.uploadedAt.toISOString(),
      }))
    : await supabaseRest<SupabaseUserPhotoRow[]>(
        `/user_photos?select=id,user_id,original_file_name,file_path,file_url,sort_order,is_main,uploaded_at&user_id=in.(${normalizedIds.join(",")})&deleted_at=is.null&order=user_id.asc,sort_order.asc,id.asc`,
      );

  for (const photo of photoRecords) {
    const photoRow = toUserPhotoRecord(photo);
    const bucket = photosByUserId.get(photoRow.userId) ?? [];
    bucket.push(
      toDashboardPhotoLike({
        id: photoRow.id,
        fileUrl: photoRow.fileUrl,
        filePath: photoRow.filePath,
        originalFileName: photoRow.originalFileName,
        isMain: photoRow.isMain,
        sortOrder: photoRow.sortOrder,
        uploadedAt: photoRow.uploadedAt,
      }),
    );
    photosByUserId.set(photoRow.userId, bucket);
  }

  for (const [userId, photos] of photosByUserId.entries()) {
    photosByUserId.set(userId, sortUserPhotosForDisplay(photos));
  }

  return photosByUserId;
}

function isReadOnlyBrowseCandidate(
  actor: DashboardUser,
  candidate: DashboardUser,
  activeIntroUserIds: Set<number>,
) {
  if (candidate.id === actor.id) return false;
  if (!isOppositeGender(actor, candidate)) return false;
  if (candidate.status !== "READY") return false;
  if (activeIntroUserIds.has(candidate.id)) return false;
  if (!candidate.exposureConsent) return false;
  if (candidate.exposurePaused) return false;
  return candidate.openLevel === "SEMI_OPEN" || candidate.openLevel === "FULL_OPEN";
}

function isOppositeGender(actor: DashboardUser, candidate: DashboardUser) {
  if (actor.genderCode === "FEMALE") return candidate.genderCode === "MALE";
  if (actor.genderCode === "MALE") return candidate.genderCode === "FEMALE";
  return candidate.genderCode === "FEMALE" || candidate.genderCode === "MALE";
}

function pairKey(userAId: number, userBId: number) {
  return userAId < userBId ? `${userAId}:${userBId}` : `${userBId}:${userAId}`;
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
    throw new Error("리드 온리 토큰을 발급할 사용자를 찾을 수 없습니다.");
  }
}

function hasReadOnlyBrowseStorageConfig() {
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
    | ReadOnlyBrowseTokenRecord
    | SupabaseReadOnlyBrowseTokenRow
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
): ReadOnlyBrowseTokenRecord {
  if (isSupabaseReadOnlyBrowseTokenRow(token)) {
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

  if (isReadOnlyBrowseTokenRecord(token)) {
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

function toUserPhotoRecord(
  photo:
    | UserPhotoRecord
    | SupabaseUserPhotoRow
    | {
        id: bigint;
        userId: bigint;
        originalFileName: string;
        filePath: string;
        fileUrl: string | null;
        sortOrder: number;
        isMain: boolean;
        uploadedAt: Date;
      },
): UserPhotoRecord {
  if (isSupabaseUserPhotoRow(photo)) {
    return {
      id: photo.id,
      userId: photo.user_id,
      originalFileName: photo.original_file_name,
      filePath: photo.file_path,
      fileUrl: photo.file_url,
      sortOrder: photo.sort_order,
      isMain: photo.is_main,
      uploadedAt: photo.uploaded_at,
    };
  }

  if (isUserPhotoRecord(photo)) {
    return photo;
  }

  return {
    id: Number(photo.id),
    userId: Number(photo.userId),
    originalFileName: photo.originalFileName,
    filePath: photo.filePath,
    fileUrl: photo.fileUrl,
    sortOrder: photo.sortOrder,
    isMain: photo.isMain,
    uploadedAt: photo.uploadedAt.toISOString(),
  };
}

type ReadOnlyBrowseInterestRow = {
  id: number;
  from_user_id: number;
  to_user_id: number;
  source: InterestSource;
  status: InterestStatus;
  created_at: string;
};

type ReadOnlyBrowseReceivedInterestRow = {
  id: number;
  from_user_id: number;
  to_user_id: number;
  source: InterestSource;
  status: InterestStatus;
  created_at: string;
};

async function loadReadOnlyBrowseInterests(userId: bigint) {
  if (hasDatabaseUrl()) {
    const interests = await prisma.interest.findMany({
      where: {
        fromUserId: userId,
        source: "NEW_MEMBER_BROWSE",
        status: { not: "WITHDRAWN" },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: MAX_NEW_USER_MARKS,
      select: {
        id: true,
        fromUserId: true,
        toUserId: true,
        source: true,
        status: true,
        createdAt: true,
      },
    });

    return interests.map((interest) => ({
      id: Number(interest.id),
      from_user_id: Number(interest.fromUserId),
      to_user_id: Number(interest.toUserId),
      source: interest.source,
      status: interest.status,
      created_at: interest.createdAt.toISOString(),
    })) satisfies ReadOnlyBrowseInterestRow[];
  }

  const interests = await supabaseRest<ReadOnlyBrowseInterestRow[]>(
    `/interests?select=id,from_user_id,to_user_id,source,status,created_at&from_user_id=eq.${userId.toString()}&source=eq.NEW_MEMBER_BROWSE&status=neq.WITHDRAWN&order=created_at.desc,id.desc&limit=${MAX_NEW_USER_MARKS}`,
  );
  return interests;
}

async function loadReceivedReadOnlyBrowseInterests(userId: bigint) {
  if (hasDatabaseUrl()) {
    const interests = await prisma.interest.findMany({
      where: {
        toUserId: userId,
        status: "ACTIVE",
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
      select: {
        id: true,
        fromUserId: true,
        toUserId: true,
        source: true,
        status: true,
        createdAt: true,
      },
    });

    return interests.map((interest) => ({
      id: Number(interest.id),
      from_user_id: Number(interest.fromUserId),
      to_user_id: Number(interest.toUserId),
      source: interest.source,
      status: interest.status,
      created_at: interest.createdAt.toISOString(),
    })) satisfies ReadOnlyBrowseReceivedInterestRow[];
  }

  const interests = await supabaseRest<ReadOnlyBrowseReceivedInterestRow[]>(
    `/interests?select=id,from_user_id,to_user_id,source,status,created_at&to_user_id=eq.${userId.toString()}&status=eq.ACTIVE&order=created_at.desc,id.desc&limit=100`,
  );
  return interests;
}

function toParticipantInterestSelection(
  interest: ReadOnlyBrowseInterestRow,
  users: DashboardUser[],
): ParticipantInterestSelection {
  return {
    id: interest.id,
    toUserId: interest.to_user_id,
    toUserName: userNameById(users, interest.to_user_id),
    source: interest.source,
    createdAt: formatShortDateTime(interest.created_at),
  };
}

function toReadOnlyReceivedInterest(
  interest: ReadOnlyBrowseReceivedInterestRow,
  users: DashboardUser[],
  outgoingBrowse: ReadOnlyBrowseInterestRow[],
  photosByUserId: Map<number, DashboardUserPhoto[]>,
): ReadOnlyBrowseReceivedInterest {
  const hasMutualInterest = outgoingBrowse.some(
    (outgoing) => outgoing.to_user_id === interest.from_user_id && outgoing.status === "ACTIVE",
  );

  return {
    id: interest.id,
    fromUserId: interest.from_user_id,
    fromUserName: userNameById(users, interest.from_user_id),
    source: interest.source,
    status: interest.status,
    createdAt: formatShortDateTime(interest.created_at),
    isMutual: hasMutualInterest,
    photos: photosByUserId.get(interest.from_user_id) ?? [],
  };
}

function userNameById(users: DashboardUser[], userId: number) {
  return users.find((user) => user.id === userId)?.name ?? `User ${userId}`;
}

function isSupabaseReadOnlyBrowseTokenRow(token: object): token is SupabaseReadOnlyBrowseTokenRow {
  return "user_id" in token;
}

function isReadOnlyBrowseTokenRecord(token: object): token is ReadOnlyBrowseTokenRecord {
  return "userId" in token && "createdAt" in token && typeof (token as ReadOnlyBrowseTokenRecord).createdAt === "string";
}

function isSupabaseUserPhotoRow(photo: object): photo is SupabaseUserPhotoRow {
  return "user_id" in photo && "uploaded_at" in photo;
}

function isUserPhotoRecord(photo: object): photo is UserPhotoRecord {
  return "userId" in photo && "uploadedAt" in photo && typeof (photo as UserPhotoRecord).uploadedAt === "string";
}
