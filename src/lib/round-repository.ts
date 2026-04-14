import {
  activeIntroStatuses,
  type DashboardEntryQueueItem,
  type DashboardRound,
  type DashboardRoundSelection,
  type DashboardUser,
  type EntryQueueStatus,
  type OpenLevel,
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
      memo: "onboarding",
    }),
  });

  return user;
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
