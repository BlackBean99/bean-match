import {
  IntroCandidateSource,
  IntroCandidateStatus,
  InterestSource,
  InterestStatus,
  NotificationType,
  Prisma,
  type Gender,
  type OpenLevel as PrismaOpenLevel,
  type UserStatus,
} from "@prisma/client";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import {
  activeIntroStatuses,
  type DashboardExposureData,
  type DashboardExposureQueueItem,
  type DashboardExposureSignalUser,
  type DashboardIntroCandidate,
  type DashboardInterest,
  type DashboardUser,
  type DashboardIntroCase,
  type OpenLevel,
  type ParticipantExposureCandidate,
  type ParticipantExposureData,
  type ParticipantInterestSelection,
  type ParticipantNewMemberNotification,
} from "@/lib/domain";
import { createIntroCase, getMemberDashboardData } from "@/lib/member-repository";

export const MAX_NEW_USER_MARKS = 3;
export const MAX_EXISTING_USER_MARKS_PER_NEW_MEMBER = 1;
export const MAX_ACTIVE_INCOMING_INTERESTS = 5;
export const MAX_ACTIVE_INTRO_CASES = 1;
export const INTEREST_TTL_DAYS = 21;

type InterestRow = {
  id: number;
  from_user_id: number;
  to_user_id: number;
  source: InterestSource;
  status: InterestStatus;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
};

type IntroCandidateRow = {
  id: number;
  user_a_id: number;
  user_b_id: number;
  reason: string;
  source: IntroCandidateSource;
  status: IntroCandidateStatus;
  created_at: string;
  updated_at: string;
};

type NotificationRow = {
  id: number;
  user_id: number;
  subject_user_id: number | null;
  type: NotificationType;
  title: string;
  body: string;
  link_path: string | null;
  created_at: string;
  read_at: string | null;
};

type ReadyEntryRow = {
  user_id: number;
  ready_at: string | null;
  joined_at: string;
};

type AutomationUserRow = {
  id: number;
  name: string;
  gender: Gender;
  status: UserStatus;
  open_level: PrismaOpenLevel | null;
  exposure_consent: boolean;
  new_member_notifications_enabled: boolean;
  exposure_paused: boolean;
  invited_by_user_id: number | null;
};

type AutomationState = {
  users: DashboardUser[];
  introCases: DashboardIntroCase[];
  interests: InterestRow[];
  introCandidates: IntroCandidateRow[];
  notifications: NotificationRow[];
  readyEntries: ReadyEntryRow[];
};

type BrowseInterestInput = {
  userId: bigint;
  targetUserIds: bigint[];
};

type JoinAutoExposureInput = {
  userId: bigint;
  name: string;
  invitorUserId: bigint | null;
  openLevel: OpenLevel;
  exposureConsent: boolean;
  newMemberNotificationsEnabled: boolean;
};

type ManualIntroCandidateInput = {
  userAId: bigint;
  userBId: bigint;
  reason: string;
};

export async function getExposureDashboardData(): Promise<DashboardExposureData> {
  const memberData = await getMemberDashboardData();
  if (!hasAutomationDataConfig()) {
    return {
      users: memberData.allUsers,
      queue: [],
      interests: [],
      introCandidates: [],
      highDemandUsers: [],
      noInterestUsers: [],
      lowExposureUsers: [],
      databaseConnected: false,
      loadError: "DATABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.",
    };
  }

  try {
    const state = await loadAutomationState();
    return buildExposureDashboard(state);
  } catch (error) {
    return {
      users: memberData.allUsers,
      queue: [],
      interests: [],
      introCandidates: [],
      highDemandUsers: [],
      noInterestUsers: [],
      lowExposureUsers: [],
      databaseConnected: false,
      loadError: error instanceof Error ? error.message : "Auto exposure query failed.",
    };
  }
}

export async function getParticipantExposureData(userId: bigint): Promise<ParticipantExposureData> {
  const memberData = await getMemberDashboardData();
  const actor = memberData.allUsers.find((user) => user.id === Number(userId)) ?? null;

  if (!hasAutomationDataConfig()) {
    return emptyParticipantExposureData(actor, "DATABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  try {
    const state = await loadAutomationState(Number(userId));
    return buildParticipantExposureData(state, Number(userId));
  } catch (error) {
    return emptyParticipantExposureData(actor, error instanceof Error ? error.message : "Participant exposure query failed.");
  }
}

export async function joinAutoExposureWithExistingUser(input: JoinAutoExposureInput) {
  const actor = await findAutomationUserRow(input.userId);
  if (!actor) throw new Error("입력한 ID에 해당하는 사용자 정보를 찾을 수 없습니다.");
  if (normalizeName(actor.name) !== normalizeName(input.name)) {
    throw new Error("입력한 이름이 기존 사용자 정보와 일치하지 않습니다.");
  }
  if (actor.status === "PROGRESSING") {
    throw new Error("소개 진행 중인 사용자는 자동 노출 풀에 참여할 수 없습니다.");
  }
  if (["HOLD", "STOP_REQUESTED", "ARCHIVED", "BLOCKED"].includes(actor.status)) {
    throw new Error("현재 상태에서는 자동 노출 풀에 참여할 수 없습니다.");
  }
  if (input.invitorUserId && actor.invited_by_user_id && actor.invited_by_user_id !== Number(input.invitorUserId)) {
    throw new Error("모집인 초대 정보가 기존 사용자 데이터와 일치하지 않습니다.");
  }

  const exposureConsent = input.openLevel === "PRIVATE" ? false : input.exposureConsent;
  const notificationConsent = exposureConsent ? input.newMemberNotificationsEnabled : false;
  if (input.openLevel !== "PRIVATE" && !exposureConsent) {
    throw new Error("제한 노출 또는 전체 노출에 참여하려면 프로필 노출 동의가 필요합니다.");
  }

  if (hasDatabaseUrl()) {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: input.userId },
        data: {
          status: "READY",
          openLevel: input.openLevel,
          exposureConsent,
          newMemberNotificationsEnabled: notificationConsent,
          exposurePaused: false,
          exposurePausedAt: null,
          invitedByUserId: input.invitorUserId ?? (actor.invited_by_user_id ? BigInt(actor.invited_by_user_id) : null),
        },
      });
      await upsertReadyEntryQueueWithPrisma(tx, input.userId, "auto-exposure:onboarding");
    });
    if (input.openLevel !== "PRIVATE" && exposureConsent) {
      await createNewMemberNotificationsWithPrisma(input.userId);
    }
    return { userId: input.userId };
  }

  const userId = Number(input.userId);
  await supabaseRest(`/users?id=eq.${input.userId.toString()}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "READY",
      open_level: input.openLevel,
      exposure_consent: exposureConsent,
      new_member_notifications_enabled: notificationConsent,
      exposure_paused: false,
      exposure_paused_at: null,
      invited_by_user_id: input.invitorUserId ? Number(input.invitorUserId) : actor.invited_by_user_id,
    }),
  });
  await upsertReadyEntryQueueWithSupabase(userId, "auto-exposure:onboarding");
  if (input.openLevel !== "PRIVATE" && exposureConsent) {
    await createNewMemberNotificationsWithSupabase(userId);
  }

  return { userId: input.userId };
}

export async function submitBrowseInterests(input: BrowseInterestInput) {
  const userId = Number(input.userId);
  const targetIds = [...new Set(input.targetUserIds.map((value) => Number(value)))];
  const data = await getParticipantExposureData(input.userId);
  if (!data.actor) throw new Error("사용자 정보를 찾을 수 없습니다.");
  if (!data.canBrowse) throw new Error("지금은 신규 탐색 관심 표시를 제출할 수 없습니다.");
  if (targetIds.length === 0) throw new Error("관심 표시할 대상을 1명 이상 선택해 주세요.");
  if (targetIds.length > MAX_NEW_USER_MARKS) {
    throw new Error(`신규 가입자는 최대 ${MAX_NEW_USER_MARKS}명까지만 관심 표시할 수 있습니다.`);
  }

  const candidateIds = new Set(data.browseCandidates.map((candidate) => candidate.id));
  for (const targetId of targetIds) {
    if (!candidateIds.has(targetId)) {
      throw new Error("자동 노출 대상이 아닌 사용자가 포함되어 있습니다.");
    }
  }

  if (hasDatabaseUrl()) {
    await prisma.$transaction(async (tx) => {
      for (const targetId of targetIds) {
        await tx.interest.upsert({
          where: {
            fromUserId_toUserId_source: {
              fromUserId: input.userId,
              toUserId: BigInt(targetId),
              source: "NEW_MEMBER_BROWSE",
            },
          },
          create: {
            fromUserId: input.userId,
            toUserId: BigInt(targetId),
            source: "NEW_MEMBER_BROWSE",
            status: "ACTIVE",
            expiresAt: interestExpiryDate(),
          },
          update: {
            status: "ACTIVE",
            expiresAt: interestExpiryDate(),
          },
        });
        await ensureMutualIntroCandidateWithPrisma(tx, input.userId, BigInt(targetId));
      }
    });
    return;
  }

  for (const targetId of targetIds) {
    await upsertInterestWithSupabase({
      fromUserId: userId,
      toUserId: targetId,
      source: "NEW_MEMBER_BROWSE",
    });
    await ensureMutualIntroCandidateWithSupabase(userId, targetId);
  }
}

export async function createBroadcastInterest(userId: bigint, targetUserId: bigint) {
  const data = await getParticipantExposureData(userId);
  const notification = data.newMemberNotifications.find((item) => item.subject.id === Number(targetUserId));
  if (!notification) throw new Error("신규 가입 알림 대상이 아닙니다.");
  if (notification.interestSent) {
    throw new Error("이미 관심 표시를 남긴 신규 가입자입니다.");
  }

  if (hasDatabaseUrl()) {
    await prisma.$transaction(async (tx) => {
      await tx.interest.upsert({
        where: {
          fromUserId_toUserId_source: {
            fromUserId: userId,
            toUserId: targetUserId,
            source: "NEW_MEMBER_BROADCAST",
          },
        },
        create: {
          fromUserId: userId,
          toUserId: targetUserId,
          source: "NEW_MEMBER_BROADCAST",
          status: "ACTIVE",
          expiresAt: interestExpiryDate(),
        },
        update: {
          status: "ACTIVE",
          expiresAt: interestExpiryDate(),
        },
      });
      await tx.notification.update({
        where: { id: BigInt(notification.id) },
        data: { readAt: new Date() },
      });
      await ensureMutualIntroCandidateWithPrisma(tx, userId, targetUserId);
    });
    return;
  }

  await upsertInterestWithSupabase({
    fromUserId: Number(userId),
    toUserId: Number(targetUserId),
    source: "NEW_MEMBER_BROADCAST",
  });
  await supabaseRest(`/notifications?id=eq.${notification.id}`, {
    method: "PATCH",
    body: JSON.stringify({ read_at: new Date().toISOString() }),
  });
  await ensureMutualIntroCandidateWithSupabase(Number(userId), Number(targetUserId));
}

export async function updateAutoExposureSettings(
  userId: bigint,
  input: {
    openLevel: OpenLevel;
    exposureConsent: boolean;
    newMemberNotificationsEnabled: boolean;
    exposurePaused: boolean;
  },
) {
  const exposureConsent = input.openLevel === "PRIVATE" ? false : input.exposureConsent;
  const notificationConsent = exposureConsent ? input.newMemberNotificationsEnabled : false;

  if (hasDatabaseUrl()) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        openLevel: input.openLevel,
        exposureConsent,
        newMemberNotificationsEnabled: notificationConsent,
        exposurePaused: input.exposurePaused,
        exposurePausedAt: input.exposurePaused ? new Date() : null,
      },
    });
  }

  return supabaseRest(`/users?id=eq.${userId.toString()}`, {
    method: "PATCH",
    body: JSON.stringify({
      open_level: input.openLevel,
      exposure_consent: exposureConsent,
      new_member_notifications_enabled: notificationConsent,
      exposure_paused: input.exposurePaused,
      exposure_paused_at: input.exposurePaused ? new Date().toISOString() : null,
    }),
  });
}

export async function createManualIntroCandidate(input: ManualIntroCandidateInput) {
  const [userAId, userBId] = normalizePair(input.userAId, input.userBId);
  if (userAId === userBId) throw new Error("같은 사용자를 짝지을 수 없습니다.");

  if (hasDatabaseUrl()) {
    await prisma.introCandidate.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      create: {
        userAId,
        userBId,
        reason: input.reason.trim() || "운영자 수동 후보 생성",
        source: "ADMIN_CREATED",
        status: "PENDING_ADMIN_REVIEW",
      },
      update: {
        reason: input.reason.trim() || "운영자 수동 후보 생성",
        source: "ADMIN_CREATED",
        status: "PENDING_ADMIN_REVIEW",
      },
    });
    return;
  }

  await upsertIntroCandidateWithSupabase({
    userAId: Number(userAId),
    userBId: Number(userBId),
    reason: input.reason.trim() || "운영자 수동 후보 생성",
    source: "ADMIN_CREATED",
    status: "PENDING_ADMIN_REVIEW",
  });
}

export async function approveIntroCandidate(id: bigint) {
  if (hasDatabaseUrl()) {
    return prisma.introCandidate.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
      },
    });
  }

  return supabaseRest(`/intro_candidates?id=eq.${id.toString()}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "APPROVED",
      approved_at: new Date().toISOString(),
    }),
  });
}

export async function rejectIntroCandidate(id: bigint) {
  if (hasDatabaseUrl()) {
    return prisma.introCandidate.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectedAt: new Date(),
      },
    });
  }

  return supabaseRest(`/intro_candidates?id=eq.${id.toString()}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "REJECTED",
      rejected_at: new Date().toISOString(),
    }),
  });
}

export async function convertIntroCandidateToIntroCase(id: bigint) {
  if (hasDatabaseUrl()) {
    const candidate = await prisma.introCandidate.findUniqueOrThrow({ where: { id } });
    await createIntroCase({
      status: "OFFERED",
      personAId: candidate.userAId,
      personBId: candidate.userBId,
      invitorUserId: null,
      memo: `[auto-interest] ${candidate.reason}`,
    });
    await prisma.introCandidate.update({
      where: { id },
      data: {
        status: "CONVERTED_TO_INTRO_CASE",
        convertedAt: new Date(),
        approvedAt: candidate.approvedAt ?? new Date(),
      },
    });
    return prisma.interest.updateMany({
      where: {
        OR: [
          { fromUserId: candidate.userAId, toUserId: candidate.userBId },
          { fromUserId: candidate.userBId, toUserId: candidate.userAId },
        ],
        status: "ACTIVE",
      },
      data: { status: "CONVERTED_TO_INTRO" },
    });
  }

  const [candidate] = await supabaseRest<IntroCandidateRow[]>(
    `/intro_candidates?id=eq.${id.toString()}&select=*&limit=1`,
  );
  if (!candidate) throw new Error("소개 후보를 찾을 수 없습니다.");

  await createIntroCase({
    status: "OFFERED",
    personAId: BigInt(candidate.user_a_id),
    personBId: BigInt(candidate.user_b_id),
    invitorUserId: null,
    memo: `[auto-interest] ${candidate.reason}`,
  });
  await supabaseRest(`/intro_candidates?id=eq.${id.toString()}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "CONVERTED_TO_INTRO_CASE",
      converted_at: new Date().toISOString(),
      approved_at: new Date().toISOString(),
    }),
  });
  await markPairInterestsConvertedWithSupabase(candidate.user_a_id, candidate.user_b_id);
}

export async function expireStaleInterests() {
  const now = new Date().toISOString();
  const cutoff = staleInterestCutoffDate();
  if (hasDatabaseUrl()) {
    return prisma.interest.updateMany({
      where: {
        status: "ACTIVE",
        OR: [{ expiresAt: { lt: new Date() } }, { createdAt: { lt: cutoff } }],
      },
      data: { status: "EXPIRED" },
    });
  }

  return supabaseRest(
    `/interests?status=eq.ACTIVE&or=(expires_at.lt.${encodeURIComponent(now)},created_at.lt.${encodeURIComponent(cutoff.toISOString())})`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: "EXPIRED" }),
    },
  );
}

async function loadAutomationState(notificationUserId?: number): Promise<AutomationState> {
  const memberData = await getMemberDashboardData();
  const [interests, introCandidates, notifications, readyEntries] = hasDatabaseUrl()
    ? await Promise.all([
        prisma.interest.findMany({
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 300,
        }),
        prisma.introCandidate.findMany({
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 200,
        }),
        prisma.notification.findMany({
          where: notificationUserId ? { userId: BigInt(notificationUserId) } : undefined,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: notificationUserId ? 50 : 300,
        }),
        prisma.entryQueue.findMany({
          where: { status: "READY" },
          select: { userId: true, readyAt: true, joinedAt: true },
        }),
      ])
    : await Promise.all([
        supabaseRest<InterestRow[]>("/interests?select=*&order=created_at.desc,id.desc&limit=300"),
        supabaseRest<IntroCandidateRow[]>("/intro_candidates?select=*&order=created_at.desc,id.desc&limit=200"),
        supabaseRest<NotificationRow[]>(
          notificationUserId
            ? `/notifications?select=*&user_id=eq.${notificationUserId}&order=created_at.desc,id.desc&limit=50`
            : "/notifications?select=*&order=created_at.desc,id.desc&limit=300",
        ),
        supabaseRest<ReadyEntryRow[]>(
          "/entry_queue?select=user_id,ready_at,joined_at&status=eq.READY&order=ready_at.desc,joined_at.desc&limit=200",
        ),
      ]);

  return {
    users: memberData.allUsers,
    introCases: memberData.introCases,
    interests: interests.map(toInterestRow),
    introCandidates: introCandidates.map(toIntroCandidateRow),
    notifications: notifications.map(toNotificationRow),
    readyEntries: readyEntries.map(toReadyEntryRow),
  };
}

function buildExposureDashboard(state: AutomationState): DashboardExposureData {
  const activeInterestKeySet = buildActiveInterestKeySet(state.interests);
  const incomingCounts = countByUserId(state.interests, "to_user_id");
  const outgoingCounts = countByUserId(state.interests, "from_user_id");
  const mutualCounts = countMutualInterestsByUserId(state.interests, activeInterestKeySet);
  const exposureCounts = countExposureByUserId(state.notifications);
  const activeIntroUserIds = activeIntroUserIdSet(state.introCases);
  const readyAtByUserId = new Map(state.readyEntries.map((row) => [row.user_id, row.ready_at ?? row.joined_at]));

  const queue = state.users
    .filter((user) => isAutomationReadyUser(user, activeIntroUserIds))
    .map((user) => ({
      userId: user.id,
      userName: user.name,
      readyAt: formatShortDateTime(readyAtByUserId.get(user.id) ?? user.lastChangedAt),
      openLevel: user.openLevel,
      outgoingInterestCount: outgoingCounts.get(user.id) ?? 0,
      incomingInterestCount: incomingCounts.get(user.id) ?? 0,
      mutualInterestCount: mutualCounts.get(user.id) ?? 0,
      exposureCount: exposureCounts.get(user.id) ?? 0,
      exposurePaused: user.exposurePaused,
    }))
    .sort((a, b) => b.exposureCount - a.exposureCount || b.incomingInterestCount - a.incomingInterestCount || a.userId - b.userId);

  return {
    users: state.users,
    queue,
    interests: state.interests.map((interest) => toDashboardInterest(interest, state.users, activeInterestKeySet)),
    introCandidates: state.introCandidates.map((candidate) => toDashboardIntroCandidate(candidate, state.users)),
    highDemandUsers: buildSignalUsers(queue, (item) => item.incomingInterestCount >= 2, (item) => `${item.incomingInterestCount}건 수신`),
    noInterestUsers: buildSignalUsers(queue, (item) => item.incomingInterestCount === 0 && item.outgoingInterestCount === 0, () => "관심 기록 없음"),
    lowExposureUsers: buildSignalUsers(queue, (item) => item.exposureCount <= 1, (item) => `노출 ${item.exposureCount}회`),
    databaseConnected: true,
    loadError: null,
  };
}

function buildParticipantExposureData(state: AutomationState, userId: number): ParticipantExposureData {
  const actor = state.users.find((user) => user.id === userId) ?? null;
  if (!actor) return emptyParticipantExposureData(null, "사용자 정보를 찾을 수 없습니다.");

  const activeIntroUserIds = activeIntroUserIdSet(state.introCases);
  const existingPairKeys = pairKeySetFromIntroCases(state.introCases);
  const activeInterestKeySet = buildActiveInterestKeySet(state.interests);
  const incomingCounts = countByUserId(state.interests, "to_user_id");
  const exposureCounts = countExposureByUserId(state.notifications);
  const outgoingBrowse = state.interests.filter(
    (interest) => interest.from_user_id === userId && interest.source === "NEW_MEMBER_BROWSE" && interest.status !== "WITHDRAWN",
  );
  const browseSubmitted = outgoingBrowse.length > 0;
  const canBrowse = isAutomationReadyUser(actor, activeIntroUserIds) && !browseSubmitted;
  const browseSelections = outgoingBrowse.map((interest) => toParticipantInterestSelection(interest, state.users));

  const browseCandidates = canBrowse
    ? state.users
        .filter((candidate) => isEligibleBrowseCandidate(actor, candidate, activeIntroUserIds, existingPairKeys, incomingCounts))
        .sort((a, b) => browseCandidateScore(a, incomingCounts, exposureCounts) - browseCandidateScore(b, incomingCounts, exposureCounts))
        .map((candidate) =>
          toParticipantExposureCandidate(candidate, {
            alreadyInterested: activeInterestKeySet.has(`${userId}:${candidate.id}`),
            activeIncomingInterestCount: incomingCounts.get(candidate.id) ?? 0,
            exposureCount: exposureCounts.get(candidate.id) ?? 0,
          }),
        )
    : [];

  const newMemberNotifications = state.notifications
    .filter((notification) => notification.user_id === userId && notification.type === "NEW_ELIGIBLE_MEMBER")
    .map((notification) => {
      const subject = state.users.find((user) => user.id === notification.subject_user_id);
      if (!subject) return null;
      return {
        id: notification.id,
        createdAt: formatShortDateTime(notification.created_at),
        title: notification.title,
        body: notification.body,
        interestSent: state.interests.some(
          (interest) =>
            interest.from_user_id === userId &&
            interest.to_user_id === subject.id &&
            interest.source === "NEW_MEMBER_BROADCAST" &&
            interest.status === "ACTIVE",
        ),
        subject: toParticipantExposureCandidate(subject, {
          alreadyInterested: activeInterestKeySet.has(`${userId}:${subject.id}`),
          activeIncomingInterestCount: incomingCounts.get(subject.id) ?? 0,
          exposureCount: exposureCounts.get(subject.id) ?? 0,
        }),
      } satisfies ParticipantNewMemberNotification;
    })
    .filter((value): value is ParticipantNewMemberNotification => value !== null);

  return {
    actor,
    browseCandidates,
    browseSelections,
    newMemberNotifications,
    browseLimit: MAX_NEW_USER_MARKS,
    existingMemberInterestLimit: MAX_EXISTING_USER_MARKS_PER_NEW_MEMBER,
    browseSubmitted,
    canBrowse,
    databaseConnected: true,
    loadError: null,
  };
}

function emptyParticipantExposureData(actor: DashboardUser | null, loadError: string): ParticipantExposureData {
  return {
    actor,
    browseCandidates: [],
    browseSelections: [],
    newMemberNotifications: [],
    browseLimit: MAX_NEW_USER_MARKS,
    existingMemberInterestLimit: MAX_EXISTING_USER_MARKS_PER_NEW_MEMBER,
    browseSubmitted: false,
    canBrowse: false,
    databaseConnected: false,
    loadError,
  };
}

function toDashboardInterest(interest: InterestRow, users: DashboardUser[], activeInterestKeySet: Set<string>): DashboardInterest {
  return {
    id: interest.id,
    fromUserId: interest.from_user_id,
    toUserId: interest.to_user_id,
    fromUserName: userNameById(users, interest.from_user_id),
    toUserName: userNameById(users, interest.to_user_id),
    source: interest.source,
    status: interest.status,
    createdAt: formatShortDateTime(interest.created_at),
    createdAtIso: interest.created_at,
    expiresAt: interest.expires_at ? formatShortDateTime(interest.expires_at) : undefined,
    isMutual:
      interest.status === "ACTIVE" && activeInterestKeySet.has(`${interest.to_user_id}:${interest.from_user_id}`),
  };
}

function toDashboardIntroCandidate(candidate: IntroCandidateRow, users: DashboardUser[]): DashboardIntroCandidate {
  return {
    id: candidate.id,
    userAId: candidate.user_a_id,
    userBId: candidate.user_b_id,
    userAName: userNameById(users, candidate.user_a_id),
    userBName: userNameById(users, candidate.user_b_id),
    reason: candidate.reason,
    source: candidate.source,
    status: candidate.status,
    createdAt: formatShortDateTime(candidate.created_at),
    updatedAt: formatShortDateTime(candidate.updated_at),
  };
}

function buildSignalUsers(
  queue: DashboardExposureQueueItem[],
  predicate: (item: DashboardExposureQueueItem) => boolean,
  detailFor: (item: DashboardExposureQueueItem) => string,
): DashboardExposureSignalUser[] {
  return queue
    .filter(predicate)
    .slice(0, 8)
    .map((item) => ({
      userId: item.userId,
      userName: item.userName,
      count: item.incomingInterestCount,
      detail: detailFor(item),
    }));
}

function toParticipantInterestSelection(interest: InterestRow, users: DashboardUser[]): ParticipantInterestSelection {
  return {
    id: interest.id,
    toUserId: interest.to_user_id,
    toUserName: userNameById(users, interest.to_user_id),
    source: interest.source,
    createdAt: formatShortDateTime(interest.created_at),
  };
}

function toParticipantExposureCandidate(
  user: DashboardUser,
  meta: { alreadyInterested: boolean; activeIncomingInterestCount: number; exposureCount: number },
): ParticipantExposureCandidate {
  return {
    ...user,
    photos: [],
    alreadyInterested: meta.alreadyInterested,
    activeIncomingInterestCount: meta.activeIncomingInterestCount,
    exposureCount: meta.exposureCount,
  };
}

function isEligibleBrowseCandidate(
  actor: DashboardUser,
  candidate: DashboardUser,
  activeIntroUserIds: Set<number>,
  existingPairKeys: Set<string>,
  incomingCounts: Map<number, number>,
) {
  if (candidate.id === actor.id) return false;
  if (!isOppositeGender(actor, candidate)) return false;
  if (!isAutomationReadyUser(candidate, activeIntroUserIds)) return false;
  if (incomingCounts.get(candidate.id) ?? 0 >= MAX_ACTIVE_INCOMING_INTERESTS) return false;
  if (existingPairKeys.has(pairKey(actor.id, candidate.id))) return false;
  return true;
}

function isAutomationReadyUser(user: DashboardUser, activeIntroUserIds: Set<number>) {
  if (user.status !== "READY") return false;
  if (activeIntroUserIds.has(user.id)) return false;
  if (!user.exposureConsent) return false;
  if (user.exposurePaused) return false;
  return user.openLevel === "SEMI_OPEN" || user.openLevel === "FULL_OPEN";
}

function isOppositeGender(actor: DashboardUser, candidate: DashboardUser) {
  if (actor.genderCode === "FEMALE") return candidate.genderCode === "MALE";
  if (actor.genderCode === "MALE") return candidate.genderCode === "FEMALE";
  return candidate.genderCode === "FEMALE" || candidate.genderCode === "MALE";
}

function browseCandidateScore(
  candidate: DashboardUser,
  incomingCounts: Map<number, number>,
  exposureCounts: Map<number, number>,
) {
  return (incomingCounts.get(candidate.id) ?? 0) * 10 + (exposureCounts.get(candidate.id) ?? 0);
}

function activeIntroUserIdSet(introCases: DashboardIntroCase[]) {
  return new Set(
    introCases
      .filter((introCase) => activeIntroStatuses.includes(introCase.status))
      .flatMap((introCase) => introCase.participantIds),
  );
}

function pairKeySetFromIntroCases(introCases: DashboardIntroCase[]) {
  return new Set(
    introCases
      .filter((introCase) => introCase.participantIds.length === 2)
      .map((introCase) => {
        const [userAId, userBId] = introCase.participantIds as [number, number];
        return pairKey(userAId, userBId);
      }),
  );
}

function pairKey(userAId: number, userBId: number) {
  return userAId < userBId ? `${userAId}:${userBId}` : `${userBId}:${userAId}`;
}

function buildActiveInterestKeySet(interests: InterestRow[]) {
  return new Set(
    interests
      .filter((interest) => interest.status === "ACTIVE")
      .map((interest) => `${interest.from_user_id}:${interest.to_user_id}`),
  );
}

function countByUserId(interests: InterestRow[], key: "from_user_id" | "to_user_id") {
  const counts = new Map<number, number>();
  for (const interest of interests) {
    if (interest.status !== "ACTIVE") continue;
    counts.set(interest[key], (counts.get(interest[key]) ?? 0) + 1);
  }
  return counts;
}

function countMutualInterestsByUserId(interests: InterestRow[], activeInterestKeySet: Set<string>) {
  const counts = new Map<number, number>();
  const handledPairs = new Set<string>();

  for (const interest of interests) {
    if (interest.status !== "ACTIVE") continue;
    if (!activeInterestKeySet.has(`${interest.to_user_id}:${interest.from_user_id}`)) continue;
    const key = pairKey(interest.from_user_id, interest.to_user_id);
    if (handledPairs.has(key)) continue;
    handledPairs.add(key);
    counts.set(interest.from_user_id, (counts.get(interest.from_user_id) ?? 0) + 1);
    counts.set(interest.to_user_id, (counts.get(interest.to_user_id) ?? 0) + 1);
  }

  return counts;
}

function countExposureByUserId(notifications: NotificationRow[]) {
  const counts = new Map<number, number>();
  for (const notification of notifications) {
    if (!notification.subject_user_id) continue;
    counts.set(notification.subject_user_id, (counts.get(notification.subject_user_id) ?? 0) + 1);
  }
  return counts;
}

async function findAutomationUserRow(userId: bigint): Promise<AutomationUserRow | null> {
  if (hasDatabaseUrl()) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        gender: true,
        status: true,
        openLevel: true,
        exposureConsent: true,
        newMemberNotificationsEnabled: true,
        exposurePaused: true,
        invitedByUserId: true,
      },
    });
    if (!user) return null;
    return {
      id: Number(user.id),
      name: user.name,
      gender: user.gender,
      status: user.status,
      open_level: user.openLevel,
      exposure_consent: user.exposureConsent,
      new_member_notifications_enabled: user.newMemberNotificationsEnabled,
      exposure_paused: user.exposurePaused,
      invited_by_user_id: user.invitedByUserId ? Number(user.invitedByUserId) : null,
    };
  }

  const [user] = await supabaseRest<AutomationUserRow[]>(
    `/users?id=eq.${userId.toString()}&select=id,name,gender,status,open_level,exposure_consent,new_member_notifications_enabled,exposure_paused,invited_by_user_id&limit=1`,
  );
  return user ?? null;
}

async function createNewMemberNotificationsWithPrisma(userId: bigint) {
  const state = await loadAutomationState();
  const subject = state.users.find((user) => user.id === Number(userId));
  if (!subject) return;

  const activeIntroUserIds = activeIntroUserIdSet(state.introCases);
  const existingPairKeys = pairKeySetFromIntroCases(state.introCases);
  const incomingCounts = countByUserId(state.interests, "to_user_id");
  const recipients = state.users.filter((user) => {
    if (user.id === subject.id) return false;
    if (!user.newMemberNotificationsEnabled) return false;
    if (!isEligibleBrowseCandidate(user, subject, activeIntroUserIds, existingPairKeys, incomingCounts)) return false;
    return true;
  });

  for (const recipient of recipients) {
    const existing = await prisma.notification.findFirst({
      where: {
        userId: BigInt(recipient.id),
        subjectUserId: userId,
        type: "NEW_ELIGIBLE_MEMBER",
      },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.notification.create({
      data: {
        userId: BigInt(recipient.id),
        subjectUserId: userId,
        type: "NEW_ELIGIBLE_MEMBER",
        title: "새로운 멤버가 풀에 들어왔어요",
        body: `${subject.name}님의 프로필이 새로 열렸습니다. 관심이 있다면 한 번 남겨보세요.`,
        linkPath: `/pool/${recipient.id}`,
      },
    });
  }
}

async function createNewMemberNotificationsWithSupabase(userId: number) {
  const state = await loadAutomationState();
  const subject = state.users.find((user) => user.id === userId);
  if (!subject) return;

  const activeIntroUserIds = activeIntroUserIdSet(state.introCases);
  const existingPairKeys = pairKeySetFromIntroCases(state.introCases);
  const incomingCounts = countByUserId(state.interests, "to_user_id");
  const recipients = state.users.filter((user) => {
    if (user.id === subject.id) return false;
    if (!user.newMemberNotificationsEnabled) return false;
    if (!isEligibleBrowseCandidate(user, subject, activeIntroUserIds, existingPairKeys, incomingCounts)) return false;
    return true;
  });

  for (const recipient of recipients) {
    const existing = await supabaseRest<Pick<NotificationRow, "id">[]>(
      `/notifications?select=id&user_id=eq.${recipient.id}&subject_user_id=eq.${userId}&type=eq.NEW_ELIGIBLE_MEMBER&limit=1`,
    );
    if (existing.length > 0) continue;

    await supabaseRest("/notifications", {
      method: "POST",
      body: JSON.stringify({
        user_id: recipient.id,
        subject_user_id: userId,
        type: "NEW_ELIGIBLE_MEMBER",
        title: "새로운 멤버가 풀에 들어왔어요",
        body: `${subject.name}님의 프로필이 새로 열렸습니다. 관심이 있다면 한 번 남겨보세요.`,
        link_path: `/pool/${recipient.id}`,
      }),
    });
  }
}

async function upsertReadyEntryQueueWithPrisma(tx: Prisma.TransactionClient, userId: bigint, memo: string) {
  const ready = await tx.entryQueue.findUnique({
    where: { userId_status: { userId, status: "READY" } },
    select: { id: true },
  });
  if (ready) {
    await tx.entryQueue.update({
      where: { id: ready.id },
      data: { readyAt: new Date(), memo },
    });
    return;
  }

  const waiting = await tx.entryQueue.findUnique({
    where: { userId_status: { userId, status: "WAITING" } },
    select: { id: true },
  });
  if (waiting) {
    await tx.entryQueue.update({
      where: { id: waiting.id },
      data: { status: "READY", readyAt: new Date(), memo },
    });
    return;
  }

  await tx.entryQueue.create({
    data: { userId, status: "READY", readyAt: new Date(), memo },
  });
}

async function upsertReadyEntryQueueWithSupabase(userId: number, memo: string) {
  const [ready] = await supabaseRest<{ id: number }[]>(
    `/entry_queue?select=id&user_id=eq.${userId}&status=eq.READY&limit=1`,
  );
  if (ready) {
    await supabaseRest(`/entry_queue?id=eq.${ready.id}`, {
      method: "PATCH",
      body: JSON.stringify({ ready_at: new Date().toISOString(), memo }),
    });
    return;
  }

  const [waiting] = await supabaseRest<{ id: number }[]>(
    `/entry_queue?select=id&user_id=eq.${userId}&status=eq.WAITING&limit=1`,
  );
  if (waiting) {
    await supabaseRest(`/entry_queue?id=eq.${waiting.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "READY", ready_at: new Date().toISOString(), memo }),
    });
    return;
  }

  await supabaseRest("/entry_queue", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, status: "READY", ready_at: new Date().toISOString(), memo }),
  });
}

async function ensureMutualIntroCandidateWithPrisma(tx: Prisma.TransactionClient, fromUserId: bigint, toUserId: bigint) {
  const reverse = await tx.interest.findFirst({
    where: {
      fromUserId: toUserId,
      toUserId: fromUserId,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  if (!reverse) return;

  const [userAId, userBId] = normalizePair(fromUserId, toUserId);
  const participants = await tx.introCaseParticipant.findMany({
    where: {
      userId: { in: [userAId, userBId] },
    },
    select: {
      introCaseId: true,
      userId: true,
    },
  });
  const introCaseMap = new Map<string, Set<string>>();
  for (const participant of participants) {
    const introCaseId = participant.introCaseId.toString();
    introCaseMap.set(
      introCaseId,
      new Set([...(introCaseMap.get(introCaseId) ?? []), participant.userId.toString()]),
    );
  }
  for (const userIds of introCaseMap.values()) {
    if (userIds.size === 2 && userIds.has(userAId.toString()) && userIds.has(userBId.toString())) return;
  }

  await tx.introCandidate.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    create: {
      userAId,
      userBId,
      reason: "상호 관심이 확인되어 운영 검토 후보로 생성되었습니다.",
      source: "MUTUAL_INTEREST",
      status: "PENDING_ADMIN_REVIEW",
    },
    update: {
      reason: "상호 관심이 확인되어 운영 검토 후보로 생성되었습니다.",
      source: "MUTUAL_INTEREST",
      status: "PENDING_ADMIN_REVIEW",
    },
  });
}

async function ensureMutualIntroCandidateWithSupabase(fromUserId: number, toUserId: number) {
  const reverse = await supabaseRest<Pick<InterestRow, "id">[]>(
    `/interests?select=id&from_user_id=eq.${toUserId}&to_user_id=eq.${fromUserId}&status=eq.ACTIVE&limit=1`,
  );
  if (reverse.length === 0) return;

  const [userAId, userBId] = normalizePair(BigInt(fromUserId), BigInt(toUserId)).map((value) => Number(value));
  const existingParticipants = await supabaseRest<{ intro_case_id: number; user_id: number }[]>(
    `/intro_case_participants?select=intro_case_id,user_id&user_id=in.(${userAId},${userBId})&limit=200`,
  );
  const introCaseMap = new Map<number, Set<number>>();
  for (const participant of existingParticipants) {
    introCaseMap.set(
      participant.intro_case_id,
      new Set([...(introCaseMap.get(participant.intro_case_id) ?? []), participant.user_id]),
    );
  }
  for (const userIds of introCaseMap.values()) {
    if (userIds.size === 2 && userIds.has(userAId) && userIds.has(userBId)) return;
  }

  await upsertIntroCandidateWithSupabase({
    userAId,
    userBId,
    reason: "상호 관심이 확인되어 운영 검토 후보로 생성되었습니다.",
    source: "MUTUAL_INTEREST",
    status: "PENDING_ADMIN_REVIEW",
  });
}

async function upsertInterestWithSupabase(input: { fromUserId: number; toUserId: number; source: InterestSource }) {
  const existing = await supabaseRest<Pick<InterestRow, "id">[]>(
    `/interests?select=id&from_user_id=eq.${input.fromUserId}&to_user_id=eq.${input.toUserId}&source=eq.${input.source}&limit=1`,
  );
  const payload = {
    from_user_id: input.fromUserId,
    to_user_id: input.toUserId,
    source: input.source,
    status: "ACTIVE",
    expires_at: interestExpiryDate().toISOString(),
  };

  if (existing.length > 0) {
    await supabaseRest(`/interests?id=eq.${existing[0].id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return;
  }

  await supabaseRest("/interests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function upsertIntroCandidateWithSupabase(input: {
  userAId: number;
  userBId: number;
  reason: string;
  source: IntroCandidateSource;
  status: IntroCandidateStatus;
}) {
  const existing = await supabaseRest<Pick<IntroCandidateRow, "id">[]>(
    `/intro_candidates?select=id&user_a_id=eq.${input.userAId}&user_b_id=eq.${input.userBId}&limit=1`,
  );
  const payload = {
    user_a_id: input.userAId,
    user_b_id: input.userBId,
    reason: input.reason,
    source: input.source,
    status: input.status,
  };

  if (existing.length > 0) {
    await supabaseRest(`/intro_candidates?id=eq.${existing[0].id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return;
  }

  await supabaseRest("/intro_candidates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function markPairInterestsConvertedWithSupabase(userAId: number, userBId: number) {
  await supabaseRest(
    `/interests?or=(and(from_user_id.eq.${userAId},to_user_id.eq.${userBId}),and(from_user_id.eq.${userBId},to_user_id.eq.${userAId}))&status=eq.ACTIVE`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: "CONVERTED_TO_INTRO" }),
    },
  );
}

function normalizePair(userAId: bigint, userBId: bigint): [bigint, bigint] {
  return userAId < userBId ? [userAId, userBId] : [userBId, userAId];
}

function interestExpiryDate() {
  const date = new Date();
  date.setDate(date.getDate() + INTEREST_TTL_DAYS);
  return date;
}

function staleInterestCutoffDate() {
  const date = new Date();
  date.setDate(date.getDate() - INTEREST_TTL_DAYS);
  return date;
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

function userNameById(users: DashboardUser[], userId: number) {
  return users.find((user) => user.id === userId)?.name ?? `User ${userId}`;
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
}

function toInterestRow(row: {
  id: bigint | number;
  fromUserId?: bigint;
  from_user_id?: number;
  toUserId?: bigint;
  to_user_id?: number;
  source: InterestSource;
  status: InterestStatus;
  createdAt?: Date;
  created_at?: string;
  updatedAt?: Date;
  updated_at?: string;
  expiresAt?: Date | null;
  expires_at?: string | null;
}): InterestRow {
  return {
    id: Number(row.id),
    from_user_id: row.from_user_id ?? Number(row.fromUserId),
    to_user_id: row.to_user_id ?? Number(row.toUserId),
    source: row.source,
    status: row.status,
    created_at: row.created_at ?? row.createdAt?.toISOString() ?? new Date().toISOString(),
    updated_at: row.updated_at ?? row.updatedAt?.toISOString() ?? new Date().toISOString(),
    expires_at: row.expires_at ?? row.expiresAt?.toISOString() ?? null,
  };
}

function toIntroCandidateRow(row: {
  id: bigint | number;
  userAId?: bigint;
  user_a_id?: number;
  userBId?: bigint;
  user_b_id?: number;
  reason: string;
  source: IntroCandidateSource;
  status: IntroCandidateStatus;
  createdAt?: Date;
  created_at?: string;
  updatedAt?: Date;
  updated_at?: string;
}): IntroCandidateRow {
  return {
    id: Number(row.id),
    user_a_id: row.user_a_id ?? Number(row.userAId),
    user_b_id: row.user_b_id ?? Number(row.userBId),
    reason: row.reason,
    source: row.source,
    status: row.status,
    created_at: row.created_at ?? row.createdAt?.toISOString() ?? new Date().toISOString(),
    updated_at: row.updated_at ?? row.updatedAt?.toISOString() ?? new Date().toISOString(),
  };
}

function toNotificationRow(row: {
  id: bigint | number;
  userId?: bigint;
  user_id?: number;
  subjectUserId?: bigint | null;
  subject_user_id?: number | null;
  type: NotificationType;
  title: string;
  body: string;
  linkPath?: string | null;
  link_path?: string | null;
  createdAt?: Date;
  created_at?: string;
  readAt?: Date | null;
  read_at?: string | null;
}): NotificationRow {
  return {
    id: Number(row.id),
    user_id: row.user_id ?? Number(row.userId),
    subject_user_id: row.subject_user_id ?? (row.subjectUserId ? Number(row.subjectUserId) : null),
    type: row.type,
    title: row.title,
    body: row.body,
    link_path: row.link_path ?? row.linkPath ?? null,
    created_at: row.created_at ?? row.createdAt?.toISOString() ?? new Date().toISOString(),
    read_at: row.read_at ?? row.readAt?.toISOString() ?? null,
  };
}

function toReadyEntryRow(row: {
  userId?: bigint;
  user_id?: number;
  readyAt?: Date | null;
  ready_at?: string | null;
  joinedAt?: Date;
  joined_at?: string;
}): ReadyEntryRow {
  return {
    user_id: row.user_id ?? Number(row.userId),
    ready_at: row.ready_at ?? row.readyAt?.toISOString() ?? null,
    joined_at: row.joined_at ?? row.joinedAt?.toISOString() ?? new Date().toISOString(),
  };
}

function hasAutomationDataConfig() {
  return hasDatabaseUrl() || Boolean(getSupabaseUrl() && getSupabaseServerKey());
}

function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}

function getSupabaseServerKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
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
