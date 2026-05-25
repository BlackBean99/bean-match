import { prisma, hasDatabaseUrl } from "@/lib/prisma";
import {
  activeIntroStatuses,
  openLevelLabels,
  type DashboardIntroCase,
  type DashboardUser,
  type MemberFilterState,
} from "@/lib/domain";

type GenderCode = NonNullable<DashboardUser["genderCode"]>;

type UserPreferenceProfile = {
  userId: number;
  preferredGender: GenderCode | null;
  preferredAgeMin: number | null;
  preferredAgeMax: number | null;
  preferredHeightMin: number | null;
  preferredHeightMax: number | null;
  preferredJobText: string | null;
  preferredStyleText: string | null;
};

type ScoreBreakdown = {
  label: string;
  points: number;
};

type MatchContext = {
  activeIntroUserIds: Set<number>;
  pairedUserIdsByUserId: Map<number, Set<number>>;
  introCountByUserId: Map<number, number>;
};

type RecommendationInput = {
  selectedUser: DashboardUser;
  users: DashboardUser[];
  introCases: DashboardIntroCase[];
  filters: MemberFilterState;
  preferenceMap: Map<number, UserPreferenceProfile>;
  previousPartnerIds?: Set<number>;
};

type SupabaseUserPreferenceRow = {
  user_id: number;
  preferred_gender: GenderCode | null;
  preferred_age_min: number | null;
  preferred_age_max: number | null;
  preferred_height_min: number | null;
  preferred_height_max: number | null;
  preferred_job_text: string | null;
  preferred_style_text: string | null;
};

export type MatchRecommendation = {
  candidate: DashboardUser;
  score: number;
  label: "상" | "중" | "검토";
  reasons: string[];
  visibilityLabel: string;
};

export function getRecommendationActors(users: DashboardUser[], introCases: DashboardIntroCase[]) {
  const context = buildMatchContext(introCases);
  return users.filter((user) => user.status === "READY" && !context.activeIntroUserIds.has(user.id));
}

export function getPairedUserIdsFromIntroCases(userId: number, introCases: DashboardIntroCase[]) {
  const pairedUserIds = new Set<number>();

  for (const introCase of introCases) {
    if (introCase.participantIds.length !== 2) continue;
    const [leftUserId, rightUserId] = introCase.participantIds;
    if (leftUserId === userId) pairedUserIds.add(rightUserId);
    if (rightUserId === userId) pairedUserIds.add(leftUserId);
  }

  return pairedUserIds;
}

export function mergePartnerIdSets(...sets: Array<Set<number> | null | undefined>) {
  const merged = new Set<number>();

  for (const set of sets) {
    if (!set) continue;
    for (const userId of set) merged.add(userId);
  }

  return merged;
}

export function resolveRecommendationActor(recommendationFor: string, actors: DashboardUser[]) {
  return actors.find((user) => user.id.toString() === recommendationFor) ?? actors[0] ?? null;
}

export function getRoundCandidateUsers(
  actor: DashboardUser | null,
  users: DashboardUser[],
  introCases: DashboardIntroCase[],
  previousPartnerIds?: Set<number>,
) {
  if (!actor) return [];
  const context = buildMatchContext(introCases);
  return users.filter((candidate) =>
    canRecommendPair(actor, candidate, context, {
      requireCandidateFullOpen: true,
      previousPartnerIds,
    }),
  );
}

export function getManualMatchRecommendations({
  selectedUser,
  users,
  introCases,
  filters,
  preferenceMap,
  previousPartnerIds,
}: RecommendationInput): MatchRecommendation[] {
  const context = buildMatchContext(introCases);

  if (selectedUser.status !== "READY" || context.activeIntroUserIds.has(selectedUser.id)) {
    return [];
  }

  return users
    .filter((candidate) => canRecommendPair(selectedUser, candidate, context, { previousPartnerIds }))
    .filter((candidate) => matchesRecommendationFilter(candidate, filters))
    .map((candidate) => toRecommendation(selectedUser, candidate, context, preferenceMap))
    .sort((a, b) => compareRecommendations(a, b, filters.sort));
}

export async function getUserPreferenceMap(userIds: number[]) {
  if (userIds.length === 0) return new Map<number, UserPreferenceProfile>();

  if (hasDatabaseUrl()) {
    const rows = await prisma.userPreference.findMany({
      where: {
        userId: {
          in: userIds.map((userId) => BigInt(userId)),
        },
      },
      select: {
        userId: true,
        preferredGender: true,
        preferredAgeMin: true,
        preferredAgeMax: true,
        preferredHeightMin: true,
        preferredHeightMax: true,
        preferredJobText: true,
        preferredStyleText: true,
      },
    });

    return new Map(
      rows.map((row) => [
        Number(row.userId),
        {
          userId: Number(row.userId),
          preferredGender: row.preferredGender,
          preferredAgeMin: row.preferredAgeMin,
          preferredAgeMax: row.preferredAgeMax,
          preferredHeightMin: row.preferredHeightMin,
          preferredHeightMax: row.preferredHeightMax,
          preferredJobText: row.preferredJobText,
          preferredStyleText: row.preferredStyleText,
        },
      ]),
    );
  }

  if (!hasSupabaseRestConfig()) {
    return new Map<number, UserPreferenceProfile>();
  }

  const rows = await supabaseRest<SupabaseUserPreferenceRow[]>(
    `/user_preferences?select=user_id,preferred_gender,preferred_age_min,preferred_age_max,preferred_height_min,preferred_height_max,preferred_job_text,preferred_style_text&user_id=in.(${userIds.join(",")})`,
  );

  return new Map(
    rows.map((row) => [
      row.user_id,
      {
        userId: row.user_id,
        preferredGender: row.preferred_gender,
        preferredAgeMin: row.preferred_age_min,
        preferredAgeMax: row.preferred_age_max,
        preferredHeightMin: row.preferred_height_min,
        preferredHeightMax: row.preferred_height_max,
        preferredJobText: row.preferred_job_text,
        preferredStyleText: row.preferred_style_text,
      },
    ]),
  );
}

export async function getHistoricalPartnerIds(userId: number) {
  if (hasDatabaseUrl()) {
    const participations = await prisma.introCaseParticipant.findMany({
      where: { userId: BigInt(userId) },
      select: { introCaseId: true },
    });
    if (participations.length === 0) return new Set<number>();

    const partners = await prisma.introCaseParticipant.findMany({
      where: {
        introCaseId: {
          in: participations.map((participation) => participation.introCaseId),
        },
        userId: {
          not: BigInt(userId),
        },
      },
      select: { userId: true },
    });

    return new Set(partners.map((partner) => Number(partner.userId)));
  }

  if (!hasSupabaseRestConfig()) {
    return new Set<number>();
  }

  const participations = await supabaseRest<{ intro_case_id: number }[]>(
    `/intro_case_participants?select=intro_case_id&user_id=eq.${userId}&limit=2000`,
  );
  if (participations.length === 0) return new Set<number>();

  const introCaseIds = participations.map((participation) => participation.intro_case_id);
  const partners = await supabaseRest<{ user_id: number }[]>(
    `/intro_case_participants?select=user_id&intro_case_id=in.(${introCaseIds.join(",")})&user_id=neq.${userId}&limit=4000`,
  );

  return new Set(partners.map((partner) => partner.user_id));
}

function toRecommendation(
  selectedUser: DashboardUser,
  candidate: DashboardUser,
  context: MatchContext,
  preferenceMap: Map<number, UserPreferenceProfile>,
): MatchRecommendation {
  const selectedPreference = preferenceMap.get(selectedUser.id) ?? null;
  const candidatePreference = preferenceMap.get(candidate.id) ?? null;
  const breakdowns = buildScoreBreakdowns(selectedUser, candidate, selectedPreference, candidatePreference, context);
  const score = breakdowns.reduce((total, item) => total + item.points, 0);
  const reasons = breakdowns
    .filter((item) => item.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3)
    .map((item) => item.label);

  return {
    candidate,
    score,
    label: recommendationLabel(score),
    reasons: reasons.length > 0 ? reasons : ["기본 매칭 조건 충족"],
    visibilityLabel: openLevelLabels[candidate.openLevel],
  };
}

function buildScoreBreakdowns(
  selectedUser: DashboardUser,
  candidate: DashboardUser,
  selectedPreference: UserPreferenceProfile | null,
  candidatePreference: UserPreferenceProfile | null,
  context: MatchContext,
) {
  const breakdowns: ScoreBreakdown[] = [];

  addGenderPreferenceScore(breakdowns, selectedPreference, candidate.genderCode, 8, "선호 성별 일치");
  addRangeScore(
    breakdowns,
    candidate.ageSortValue,
    selectedPreference?.preferredAgeMin ?? null,
    selectedPreference?.preferredAgeMax ?? null,
    18,
    2,
    "선호 나이 범위 일치",
    "선호 나이와 근접",
  );
  addRangeScore(
    breakdowns,
    candidate.heightCm,
    selectedPreference?.preferredHeightMin ?? null,
    selectedPreference?.preferredHeightMax ?? null,
    12,
    5,
    "선호 키 범위 일치",
    "선호 키와 근접",
  );
  addKeywordScore(
    breakdowns,
    selectedPreference?.preferredJobText ?? null,
    `${candidate.jobTitle} ${candidate.companyName}`,
    8,
    "선호 직업 키워드 일치",
  );
  addKeywordScore(
    breakdowns,
    selectedPreference?.preferredStyleText ?? null,
    `${candidate.selfIntro} ${candidate.idealTypeDescription}`,
    6,
    "선호 스타일 키워드 일치",
  );

  addGenderPreferenceScore(breakdowns, candidatePreference, selectedUser.genderCode, 6, "상대도 선호 성별 일치");
  addRangeScore(
    breakdowns,
    selectedUser.ageSortValue,
    candidatePreference?.preferredAgeMin ?? null,
    candidatePreference?.preferredAgeMax ?? null,
    12,
    2,
    "상대도 선호 나이 범위 일치",
    "상대 선호 나이와 근접",
  );
  addRangeScore(
    breakdowns,
    selectedUser.heightCm,
    candidatePreference?.preferredHeightMin ?? null,
    candidatePreference?.preferredHeightMax ?? null,
    8,
    5,
    "상대도 선호 키 범위 일치",
    "상대 선호 키와 근접",
  );
  addKeywordScore(
    breakdowns,
    candidatePreference?.preferredJobText ?? null,
    `${selectedUser.jobTitle} ${selectedUser.companyName}`,
    6,
    "상대 직업 선호와 일치",
  );
  addKeywordScore(
    breakdowns,
    candidatePreference?.preferredStyleText ?? null,
    `${selectedUser.selfIntro} ${selectedUser.idealTypeDescription}`,
    4,
    "상대 스타일 선호와 일치",
  );

  addAgeGapFallbackScore(breakdowns, selectedUser, candidate, selectedPreference);
  addHeightFallbackScore(breakdowns, selectedUser, candidate, selectedPreference);
  addProfileCompletenessScore(breakdowns, candidate);
  addVisibilityScore(breakdowns, candidate);
  addExposureScore(breakdowns, candidate, context);

  return breakdowns;
}

function addGenderPreferenceScore(
  breakdowns: ScoreBreakdown[],
  preference: UserPreferenceProfile | null,
  genderCode: DashboardUser["genderCode"],
  points: number,
  label: string,
) {
  if (!preference?.preferredGender || !genderCode) return;
  if (preference.preferredGender === genderCode) {
    breakdowns.push({ label, points });
  }
}

function addRangeScore(
  breakdowns: ScoreBreakdown[],
  value: number,
  min: number | null,
  max: number | null,
  points: number,
  grace: number,
  matchLabel: string,
  nearLabel: string,
) {
  if (value <= 0) return;
  const hasMin = min !== null;
  const hasMax = max !== null;
  if (!hasMin && !hasMax) return;

  const effectiveMin = hasMin ? min : Number.NEGATIVE_INFINITY;
  const effectiveMax = hasMax ? max : Number.POSITIVE_INFINITY;

  if (value >= effectiveMin && value <= effectiveMax) {
    breakdowns.push({ label: matchLabel, points });
    return;
  }

  if (value >= effectiveMin - grace && value <= effectiveMax + grace) {
    breakdowns.push({ label: nearLabel, points: Math.max(2, Math.floor(points / 2)) });
  }
}

function addKeywordScore(
  breakdowns: ScoreBreakdown[],
  preferredText: string | null,
  candidateText: string,
  points: number,
  label: string,
) {
  const keywords = tokenizePreference(preferredText);
  if (keywords.length === 0) return;
  const haystack = normalizeText(candidateText);
  if (!haystack) return;

  if (keywords.some((keyword) => haystack.includes(keyword))) {
    breakdowns.push({ label, points });
  }
}

function addAgeGapFallbackScore(
  breakdowns: ScoreBreakdown[],
  selectedUser: DashboardUser,
  candidate: DashboardUser,
  selectedPreference: UserPreferenceProfile | null,
) {
  if (selectedPreference?.preferredAgeMin != null || selectedPreference?.preferredAgeMax != null) return;
  if (selectedUser.ageSortValue <= 0 || candidate.ageSortValue <= 0) return;

  const ageGap = Math.abs(selectedUser.ageSortValue - candidate.ageSortValue);
  const points = Math.max(0, 10 - ageGap * 2);
  if (points > 0) {
    breakdowns.push({ label: "나이 차이 안정적", points });
  }
}

function addHeightFallbackScore(
  breakdowns: ScoreBreakdown[],
  selectedUser: DashboardUser,
  candidate: DashboardUser,
  selectedPreference: UserPreferenceProfile | null,
) {
  if (selectedPreference?.preferredHeightMin != null || selectedPreference?.preferredHeightMax != null) return;
  if (selectedUser.heightCm <= 0 || candidate.heightCm <= 0) return;

  const points = candidate.heightCm >= selectedUser.heightCm ? 6 : 3;
  breakdowns.push({ label: "키 밸런스 무난", points });
}

function addProfileCompletenessScore(breakdowns: ScoreBreakdown[], candidate: DashboardUser) {
  if (candidate.hasMainPhoto) breakdowns.push({ label: "대표 사진 등록", points: 10 });
  if (candidate.selfIntro) breakdowns.push({ label: "자기소개 작성", points: 6 });
  if (candidate.idealTypeDescription) breakdowns.push({ label: "이상형 정보 작성", points: 4 });
  if (candidate.companyName) breakdowns.push({ label: "회사 정보 확인 가능", points: 3 });
  if (candidate.jobTitle && candidate.jobTitle !== "직업 미입력") {
    breakdowns.push({ label: "직업 정보 명확", points: 3 });
  }
}

function addVisibilityScore(breakdowns: ScoreBreakdown[], candidate: DashboardUser) {
  if (candidate.openLevel === "FULL_OPEN") {
    breakdowns.push({ label: "전체 라운드 노출 가능", points: 4 });
    return;
  }

  if (candidate.openLevel === "SEMI_OPEN") {
    breakdowns.push({ label: "제한 노출 운영 가능", points: 2 });
  }
}

function addExposureScore(breakdowns: ScoreBreakdown[], candidate: DashboardUser, context: MatchContext) {
  const introCount = context.introCountByUserId.get(candidate.id) ?? 0;
  if (introCount === 0) {
    breakdowns.push({ label: "이전 소개 이력 적음", points: 4 });
    return;
  }

  if (introCount === 1) {
    breakdowns.push({ label: "소개 이력 과다하지 않음", points: 2 });
  }
}

function recommendationLabel(score: number): MatchRecommendation["label"] {
  if (score >= 70) return "상";
  if (score >= 42) return "중";
  return "검토";
}

function compareRecommendations(
  a: MatchRecommendation,
  b: MatchRecommendation,
  sort: MemberFilterState["sort"],
) {
  if (b.score !== a.score) return b.score - a.score;

  if (sort === "name_asc") return a.candidate.name.localeCompare(b.candidate.name, "ko-KR");
  if (sort === "age_asc") return compareNullableNumber(a.candidate.ageSortValue, b.candidate.ageSortValue, "asc");
  if (sort === "age_desc") return compareNullableNumber(a.candidate.ageSortValue, b.candidate.ageSortValue, "desc");
  if (sort === "height_asc") return compareNullableNumber(a.candidate.heightCm, b.candidate.heightCm, "asc");
  if (sort === "height_desc") return compareNullableNumber(a.candidate.heightCm, b.candidate.heightCm, "desc");
  if (sort === "gender_asc") {
    return (a.candidate.genderCode ?? "").localeCompare(b.candidate.genderCode ?? "", "ko-KR");
  }

  return a.candidate.name.localeCompare(b.candidate.name, "ko-KR");
}

function compareNullableNumber(a: number, b: number, direction: "asc" | "desc") {
  if (a === 0 && b === 0) return 0;
  if (a === 0) return 1;
  if (b === 0) return -1;
  return direction === "asc" ? a - b : b - a;
}

function matchesRecommendationFilter(candidate: DashboardUser, filters: MemberFilterState) {
  const ageMin = parseOptionalNumber(filters.ageMin);
  const ageMax = parseOptionalNumber(filters.ageMax);
  const heightMin = parseOptionalNumber(filters.heightMin);
  const heightMax = parseOptionalNumber(filters.heightMax);

  if (filters.gender !== "ALL" && candidate.genderCode !== filters.gender) return false;
  if (ageMin !== null && (candidate.ageSortValue === 0 || candidate.ageSortValue < ageMin)) return false;
  if (ageMax !== null && (candidate.ageSortValue === 0 || candidate.ageSortValue > ageMax)) return false;
  if (heightMin !== null && (candidate.heightCm === 0 || candidate.heightCm < heightMin)) return false;
  if (heightMax !== null && (candidate.heightCm === 0 || candidate.heightCm > heightMax)) return false;

  return true;
}

function canRecommendPair(
  actor: DashboardUser,
  candidate: DashboardUser,
  context: MatchContext,
  options: { requireCandidateFullOpen?: boolean; previousPartnerIds?: Set<number> } = {},
) {
  if (actor.id === candidate.id) return false;
  if (candidate.status !== "READY") return false;
  if (!isOppositeGender(actor, candidate)) return false;
  if (context.activeIntroUserIds.has(candidate.id)) return false;
  if (options.previousPartnerIds?.has(candidate.id)) return false;
  if (context.pairedUserIdsByUserId.get(actor.id)?.has(candidate.id)) return false;
  if (options.requireCandidateFullOpen && candidate.openLevel !== "FULL_OPEN") return false;
  return true;
}

function buildMatchContext(introCases: DashboardIntroCase[]): MatchContext {
  const activeIntroUserIds = new Set<number>();
  const pairedUserIdsByUserId = new Map<number, Set<number>>();
  const introCountByUserId = new Map<number, number>();
  const activeStatusSet = new Set(activeIntroStatuses);

  for (const introCase of introCases) {
    if (introCase.participantIds.length !== 2) continue;
    const [leftUserId, rightUserId] = introCase.participantIds;

    introCountByUserId.set(leftUserId, (introCountByUserId.get(leftUserId) ?? 0) + 1);
    introCountByUserId.set(rightUserId, (introCountByUserId.get(rightUserId) ?? 0) + 1);

    pairedUserIdsByUserId.set(
      leftUserId,
      new Set([...(pairedUserIdsByUserId.get(leftUserId) ?? []), rightUserId]),
    );
    pairedUserIdsByUserId.set(
      rightUserId,
      new Set([...(pairedUserIdsByUserId.get(rightUserId) ?? []), leftUserId]),
    );

    if (!activeStatusSet.has(introCase.status)) continue;
    activeIntroUserIds.add(leftUserId);
    activeIntroUserIds.add(rightUserId);
  }

  return {
    activeIntroUserIds,
    pairedUserIdsByUserId,
    introCountByUserId,
  };
}

function isOppositeGender(selectedUser: DashboardUser, candidate: DashboardUser) {
  if (selectedUser.genderCode === "FEMALE") return candidate.genderCode === "MALE";
  if (selectedUser.genderCode === "MALE") return candidate.genderCode === "FEMALE";
  return candidate.genderCode === "FEMALE" || candidate.genderCode === "MALE";
}

function tokenizePreference(value: string | null | undefined) {
  if (!value) return [];
  const normalized = normalizeText(value);
  if (!normalized) return [];

  return [...new Set(normalized.split(/\s+/).filter((token) => token.length >= 2))];
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseOptionalNumber(value: string) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasSupabaseRestConfig() {
  return Boolean(getSupabaseUrl() && getSupabaseServerKey());
}

async function supabaseRest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const target = `${getSupabaseUrl()}/rest/v1${path}`;
  let response: Response;
  try {
    response = await fetch(target, {
      ...init,
      headers: {
        apikey: getSupabaseServerKey(),
        Authorization: `Bearer ${getSupabaseServerKey()}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  } catch (error) {
    throw new Error(formatSupabaseNetworkError(target, error));
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase REST ${response.status}: ${text}`);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}

function getSupabaseServerKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
}

function formatSupabaseNetworkError(target: string, error: unknown) {
  const host = safeHostFromUrl(target);
  const cause =
    error instanceof Error && "cause" in error && error.cause instanceof Error
      ? `${error.cause.name}: ${error.cause.message}`
      : error instanceof Error
        ? error.message
        : String(error);
  return `Supabase REST network failure for ${host}: ${cause}`;
}

function safeHostFromUrl(value: string) {
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}
