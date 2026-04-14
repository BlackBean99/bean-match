import {
  activeIntroStatuses,
  type DashboardEntryQueueItem,
  type DashboardRound,
  type DashboardRoundSelection,
  type DashboardUser,
  type EntryQueueStatus,
  type OpenLevel,
  type ParticipantRoundData,
  type RoundStatus,
} from "@/lib/domain";
import { getMemberDashboardData } from "@/lib/member-repository";

type RoundRow = {
  id: number;
  title: string;
  status: RoundStatus;
  start_at: string;
  end_at: string;
  selection_limit: number;
};

type RoundSelectionRow = {
  id: number;
  round_id: number;
  from_user_id: number;
  to_user_id: number;
  created_at: string;
};

type EntryQueueRow = {
  id: number;
  user_id: number;
  status: EntryQueueStatus;
  joined_at: string;
  memo: string | null;
};

export type RoundDashboardData = {
  users: DashboardUser[];
  candidates: DashboardUser[];
  rounds: DashboardRound[];
  selections: DashboardRoundSelection[];
  entryQueue: DashboardEntryQueueItem[];
  databaseConnected: boolean;
  loadError: string | null;
};

export type RoundInput = {
  title: string;
  startAt: Date;
  endAt: Date;
  status: RoundStatus;
};

export type OnboardingInput = {
  name: string;
  gender: "FEMALE" | "MALE" | "OTHER" | "UNDISCLOSED";
  ageText: string | null;
  jobTitle: string | null;
  heightCm: number | null;
  selfIntro: string | null;
  idealTypeDescription: string | null;
  openLevel: OpenLevel;
  invitorUserId: bigint | null;
};

export type RoundEntryInput = {
  userId: bigint;
  name: string;
  invitorUserId: bigint | null;
};

export async function getRoundDashboardData(): Promise<RoundDashboardData> {
  const memberData = await getMemberDashboardData();
  if (!hasSupabaseRestConfig()) {
    return {
      users: memberData.allUsers,
      candidates: [],
      rounds: [],
      selections: [],
      entryQueue: [],
      databaseConnected: false,
      loadError: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.",
    };
  }

  try {
    const [roundRows, selectionRows, queueRows] = await Promise.all([
      supabaseRest<RoundRow[]>("/rounds?select=*&order=start_at.desc,id.desc&limit=20"),
      supabaseRest<RoundSelectionRow[]>("/round_selections?select=*&order=created_at.desc,id.desc&limit=200"),
      supabaseRest<EntryQueueRow[]>("/entry_queue?select=*&order=joined_at.asc,id.asc&limit=100"),
    ]);
    const usersById = new Map(memberData.allUsers.map((user) => [user.id, user]));
    const activeIntroUserIds = activeIntroUserIdSet(memberData.introCases);
    const candidates = memberData.allUsers.filter(
      (user) => user.status === "READY" && user.openLevel === "FULL_OPEN" && !activeIntroUserIds.has(user.id),
    );
    const selections = selectionRows.map((selection) => toDashboardSelection(selection, usersById, selectionRows));
    const selectionsByRoundId = groupSelectionsByRoundId(selectionRows);

    return {
      users: memberData.allUsers,
      candidates,
      rounds: roundRows.map((round) =>
        toDashboardRound(round, candidates.length, selectionsByRoundId.get(round.id) ?? []),
      ),
      selections,
      entryQueue: queueRows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        userName: usersById.get(row.user_id)?.name ?? `User ${row.user_id}`,
        status: row.status,
        joinedAt: formatDateTime(new Date(row.joined_at)),
        memo: row.memo ?? undefined,
      })),
      databaseConnected: true,
      loadError: null,
    };
  } catch (error) {
    return {
      users: memberData.allUsers,
      candidates: [],
      rounds: [],
      selections: [],
      entryQueue: [],
      databaseConnected: false,
      loadError: error instanceof Error ? error.message : "Round query failed.",
    };
  }
}

export async function createRound(input: RoundInput) {
  return supabaseRest<RoundRow[]>("/rounds?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      title: input.title,
      status: input.status,
      start_at: input.startAt.toISOString(),
      end_at: input.endAt.toISOString(),
      selection_limit: 2,
    }),
  });
}

export async function updateRoundStatus(roundId: bigint, status: RoundStatus) {
  return supabaseRest<RoundRow[]>(`/rounds?id=eq.${roundId.toString()}&select=*`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status }),
  });
}

export async function createRoundSelection(roundId: bigint, fromUserId: bigint, toUserId: bigint) {
  if (fromUserId === toUserId) throw new Error("자기 자신은 선택할 수 없습니다.");

  return supabaseRest<RoundSelectionRow[]>("/round_selections?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      round_id: Number(roundId),
      from_user_id: Number(fromUserId),
      to_user_id: Number(toUserId),
    }),
  });
}

export async function createRoundSelections(roundId: bigint, fromUserId: bigint, toUserIds: bigint[]) {
  const uniqueToUserIds = [...new Set(toUserIds.map((id) => id.toString()))].map((id) => BigInt(id));
  if (uniqueToUserIds.length === 0) throw new Error("선택할 후보를 1명 이상 고르세요.");
  if (uniqueToUserIds.length > 2) throw new Error("한 라운드에서 최대 2명만 선택할 수 있습니다.");

  const round = await getRoundOrNull(roundId);
  if (!round) throw new Error("라운드를 찾을 수 없습니다.");
  if (round.status !== "OPEN") throw new Error("선택 가능한 라운드가 아닙니다.");

  const existingSelections = await supabaseRest<RoundSelectionRow[]>(
    `/round_selections?select=*&round_id=eq.${roundId.toString()}&from_user_id=eq.${fromUserId.toString()}`,
  );
  const existingToUserIds = new Set(existingSelections.map((selection) => selection.to_user_id));
  const newToUserIds = uniqueToUserIds.filter((toUserId) => !existingToUserIds.has(Number(toUserId)));
  if (existingSelections.length + newToUserIds.length > round.selection_limit) {
    throw new Error(`한 라운드에서 최대 ${round.selection_limit}명만 선택할 수 있습니다.`);
  }

  for (const toUserId of newToUserIds) {
    await createRoundSelection(roundId, fromUserId, toUserId);
  }
}

export async function createOnboardingUser(input: OnboardingInput) {
  const [user] = await supabaseRest<{ id: number }[]>("/users?select=id", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      name: input.name,
      gender: input.gender,
      status: "READY",
      open_level: input.openLevel,
      age_text: input.ageText,
      job_title: input.jobTitle,
      height_cm: input.heightCm,
      self_intro: input.selfIntro,
      ideal_type_description: input.idealTypeDescription,
      invited_by_user_id: input.invitorUserId ? Number(input.invitorUserId) : null,
    }),
  });

  await supabaseRest("/user_roles", {
    method: "POST",
    body: JSON.stringify({ user_id: user.id, role: "PARTICIPANT" }),
  });

  await supabaseRest("/entry_queue", {
    method: "POST",
    body: JSON.stringify({
      user_id: user.id,
      status: input.openLevel === "FULL_OPEN" ? "READY" : "WAITING",
      memo: input.invitorUserId ? `onboarding:invitor=${input.invitorUserId.toString()}` : "onboarding",
    }),
  });

  return user;
}

export async function joinCurrentRoundWithExistingUser(input: RoundEntryInput) {
  const user = await getRoundEntryUser(input.userId);
  if (!user) throw new Error("입력한 ID에 해당하는 사용자 정보를 찾을 수 없습니다.");
  if (normalizeName(user.name) !== normalizeName(input.name)) {
    throw new Error("입력한 이름이 기존 사용자 정보와 일치하지 않습니다.");
  }
  if (user.status === "PROGRESSING") {
    throw new Error("소개 진행 중인 사용자는 현재 라운드에 참여할 수 없습니다.");
  }
  if (["STOP_REQUESTED", "ARCHIVED", "BLOCKED"].includes(user.status)) {
    throw new Error("운영 제한 또는 보관 상태의 사용자는 라운드에 참여할 수 없습니다.");
  }
  if (input.invitorUserId && user.invited_by_user_id && user.invited_by_user_id !== Number(input.invitorUserId)) {
    throw new Error("모집인 초대 정보가 기존 사용자 데이터와 일치하지 않습니다.");
  }

  const round = await getCurrentOpenRound();
  if (!round) throw new Error("현재 참여 가능한 OPEN 라운드가 없습니다.");

  await supabaseRest(`/users?id=eq.${input.userId.toString()}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "READY",
      open_level: "FULL_OPEN",
      invited_by_user_id: input.invitorUserId ? Number(input.invitorUserId) : user.invited_by_user_id,
    }),
  });
  await upsertReadyEntryQueue(input.userId, input.invitorUserId);

  return {
    roundId: BigInt(round.id),
    userId: input.userId,
  };
}

export async function getParticipantRoundData(roundId: bigint, userId: bigint): Promise<ParticipantRoundData> {
  const memberData = await getMemberDashboardData();
  const actor = memberData.allUsers.find((user) => user.id === Number(userId)) ?? null;

  if (!hasSupabaseRestConfig()) {
    return {
      actor,
      round: null,
      candidates: [],
      selectedCount: 0,
      selectionLimit: 2,
      isTestMode: false,
      databaseConnected: false,
      loadError: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.",
    };
  }

  try {
    const [round, selectionRows] = await Promise.all([
      getRoundOrNull(roundId),
      supabaseRest<RoundSelectionRow[]>(
        `/round_selections?select=*&round_id=eq.${roundId.toString()}&order=created_at.asc,id.asc`,
      ),
    ]);
    if (!actor || actor.status !== "READY" || actor.openLevel !== "FULL_OPEN") {
      return {
        actor,
        round: round ? toDashboardRound(round, 0, selectionRows) : null,
        candidates: [],
        selectedCount: 0,
        selectionLimit: round?.selection_limit ?? 2,
        isTestMode: false,
        databaseConnected: true,
        loadError: "READY + FULL_OPEN 사용자만 현재 라운드 후보를 볼 수 있습니다.",
      };
    }

    const activeIntroUserIds = activeIntroUserIdSet(memberData.introCases);
    const selectedToUserIds = new Set(
      selectionRows.filter((selection) => selection.from_user_id === Number(userId)).map((selection) => selection.to_user_id),
    );
    const candidates = memberData.allUsers
      .filter(
        (user) =>
          user.id !== Number(userId) &&
          user.status === "READY" &&
          user.openLevel === "FULL_OPEN" &&
          !activeIntroUserIds.has(user.id),
      )
      .map((user) => ({ ...user, alreadySelected: selectedToUserIds.has(user.id) }));

    return {
      actor,
      round: round ? toDashboardRound(round, candidates.length, selectionRows) : null,
      candidates,
      selectedCount: selectedToUserIds.size,
      selectionLimit: round?.selection_limit ?? 2,
      isTestMode: false,
      databaseConnected: true,
      loadError: null,
    };
  } catch (error) {
    return {
      actor,
      round: null,
      candidates: [],
      selectedCount: 0,
      selectionLimit: 2,
      isTestMode: false,
      databaseConnected: false,
      loadError: error instanceof Error ? error.message : "Participant round query failed.",
    };
  }
}

export async function getAdminTestRoundData(roundId: bigint): Promise<ParticipantRoundData> {
  const memberData = await getMemberDashboardData();
  const testActor = createAdminTestActor();

  if (!hasSupabaseRestConfig()) {
    return {
      actor: testActor,
      round: null,
      candidates: [],
      selectedCount: 0,
      selectionLimit: 2,
      isTestMode: true,
      databaseConnected: false,
      loadError: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.",
    };
  }

  try {
    const [round, selectionRows] = await Promise.all([
      getRoundOrNull(roundId),
      supabaseRest<RoundSelectionRow[]>(
        `/round_selections?select=*&round_id=eq.${roundId.toString()}&order=created_at.asc,id.asc`,
      ),
    ]);
    const activeIntroUserIds = activeIntroUserIdSet(memberData.introCases);
    const candidates = memberData.allUsers
      .filter((user) => user.status === "READY" && user.openLevel === "FULL_OPEN" && !activeIntroUserIds.has(user.id))
      .map((user) => ({ ...user, alreadySelected: false }));

    return {
      actor: testActor,
      round: round ? toDashboardRound(round, candidates.length, selectionRows) : null,
      candidates,
      selectedCount: 0,
      selectionLimit: round?.selection_limit ?? 2,
      isTestMode: true,
      databaseConnected: true,
      loadError: null,
    };
  } catch (error) {
    return {
      actor: testActor,
      round: null,
      candidates: [],
      selectedCount: 0,
      selectionLimit: 2,
      isTestMode: true,
      databaseConnected: false,
      loadError: error instanceof Error ? error.message : "Admin test round query failed.",
    };
  }
}

function activeIntroUserIdSet(introCases: { status: string; participantIds: [number, number] | [] }[]) {
  const active = new Set<string>(activeIntroStatuses);
  const ids = new Set<number>();
  for (const introCase of introCases) {
    if (!active.has(introCase.status)) continue;
    for (const userId of introCase.participantIds) ids.add(userId);
  }
  return ids;
}

async function getRoundOrNull(roundId: bigint) {
  const [round] = await supabaseRest<RoundRow[]>(
    `/rounds?select=*&id=eq.${roundId.toString()}&limit=1`,
  );
  return round ?? null;
}

async function getCurrentOpenRound() {
  const [round] = await supabaseRest<RoundRow[]>(
    "/rounds?select=*&status=eq.OPEN&order=end_at.asc,start_at.asc,id.asc&limit=1",
  );
  return round ?? null;
}

async function getRoundEntryUser(userId: bigint) {
  const [user] = await supabaseRest<
    {
      id: number;
      name: string;
      status: string;
      open_level: OpenLevel | null;
      invited_by_user_id: number | null;
    }[]
  >(`/users?select=id,name,status,open_level,invited_by_user_id&id=eq.${userId.toString()}&limit=1`);
  return user ?? null;
}

async function upsertReadyEntryQueue(userId: bigint, invitorUserId: bigint | null) {
  const [existing] = await supabaseRest<{ id: number }[]>(
    `/entry_queue?select=id&user_id=eq.${userId.toString()}&status=eq.READY&limit=1`,
  );
  const payload = {
    ready_at: new Date().toISOString(),
    memo: invitorUserId ? `round-entry:update:invitor=${invitorUserId.toString()}` : "round-entry:update",
  };

  if (existing) {
    await supabaseRest(`/entry_queue?id=eq.${existing.id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return;
  }

  await supabaseRest("/entry_queue", {
    method: "POST",
    body: JSON.stringify({
      user_id: Number(userId),
      status: "READY",
      ...payload,
    }),
  });
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
}

function createAdminTestActor(): DashboardUser {
  return {
    id: 0,
    name: "관리자 테스트 계정",
    age: 0,
    ageSortValue: 0,
    gender: "비공개",
    genderCode: "UNDISCLOSED",
    heightCm: 0,
    jobTitle: "운영 테스트",
    status: "READY",
    openLevel: "FULL_OPEN",
    roles: ["ADMIN"],
    hasMainPhoto: false,
    lastChangedAt: "test",
  };
}

function groupSelectionsByRoundId(rows: RoundSelectionRow[]) {
  const map = new Map<number, RoundSelectionRow[]>();
  for (const row of rows) {
    map.set(row.round_id, [...(map.get(row.round_id) ?? []), row]);
  }
  return map;
}

function toDashboardRound(round: RoundRow, participantCount: number, selections: RoundSelectionRow[]): DashboardRound {
  return {
    id: round.id,
    title: round.title,
    status: round.status,
    startAt: formatDateTime(new Date(round.start_at)),
    endAt: formatDateTime(new Date(round.end_at)),
    selectionLimit: round.selection_limit,
    participantCount,
    selectionCount: selections.length,
    mutualCount: countMutualSelections(selections),
  };
}

function toDashboardSelection(
  selection: RoundSelectionRow,
  usersById: Map<number, DashboardUser>,
  allSelections: RoundSelectionRow[],
): DashboardRoundSelection {
  return {
    id: selection.id,
    roundId: selection.round_id,
    fromUserId: selection.from_user_id,
    toUserId: selection.to_user_id,
    fromUserName: usersById.get(selection.from_user_id)?.name ?? `User ${selection.from_user_id}`,
    toUserName: usersById.get(selection.to_user_id)?.name ?? `User ${selection.to_user_id}`,
    isMutual: allSelections.some(
      (other) =>
        other.round_id === selection.round_id &&
        other.from_user_id === selection.to_user_id &&
        other.to_user_id === selection.from_user_id,
    ),
    createdAt: formatDateTime(new Date(selection.created_at)),
  };
}

function countMutualSelections(selections: RoundSelectionRow[]) {
  const seen = new Set<string>();
  let count = 0;
  for (const selection of selections) {
    const pair = [selection.from_user_id, selection.to_user_id].sort((a, b) => a - b).join(":");
    if (seen.has(pair)) continue;
    const mutual = selections.some(
      (other) => other.from_user_id === selection.to_user_id && other.to_user_id === selection.from_user_id,
    );
    if (mutual) count += 1;
    seen.add(pair);
  }
  return count;
}

function hasSupabaseRestConfig() {
  return Boolean(getSupabaseUrl() && getSupabaseServerKey());
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

function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}

function getSupabaseServerKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
