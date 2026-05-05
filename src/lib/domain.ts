export const userStatusLabels = {
  INCOMPLETE: "정보 미완성",
  READY: "소개 가능",
  PROGRESSING: "소개 진행 중",
  HOLD: "잠시 보류",
  STOP_REQUESTED: "탈퇴 요청",
  ARCHIVED: "보관 완료",
  BLOCKED: "운영 제한",
} as const;

export const introStatusLabels = {
  OFFERED: "제안 전달",
  A_INTERESTED: "A 관심",
  B_OFFERED: "B 제안",
  WAITING_RESPONSE: "응답 대기",
  MATCHED: "양측 수락",
  CONNECTED: "연락 연결",
  MEETING_DONE: "만남 완료",
  RESULT_PENDING: "결과 확인 대기",
  SUCCESS: "성사",
  FAILED: "불발",
  DECLINED: "거절",
  EXPIRED: "만료",
  CANCELLED: "취소",
} as const;

export const interestSourceLabels = {
  NEW_MEMBER_BROWSE: "신규 가입자 탐색",
  NEW_MEMBER_BROADCAST: "신규 가입 알림",
  ADMIN_CREATED: "운영자 생성",
} as const;

export const interestStatusLabels = {
  ACTIVE: "활성",
  WITHDRAWN: "철회",
  EXPIRED: "만료",
  CONVERTED_TO_INTRO: "소개 전환",
} as const;

export const introCandidateStatusLabels = {
  PENDING_ADMIN_REVIEW: "관리자 검토 대기",
  APPROVED: "승인",
  REJECTED: "반려",
  CONVERTED_TO_INTRO_CASE: "소개 전환 완료",
} as const;

export const introCandidateSourceLabels = {
  MUTUAL_INTEREST: "상호 관심",
  ADMIN_CREATED: "운영자 생성",
} as const;

export type UserStatus = keyof typeof userStatusLabels;
export type IntroStatus = keyof typeof introStatusLabels;
export type InterestSource = keyof typeof interestSourceLabels;
export type InterestStatus = keyof typeof interestStatusLabels;
export type IntroCandidateStatus = keyof typeof introCandidateStatusLabels;
export type IntroCandidateSource = keyof typeof introCandidateSourceLabels;

export const activeIntroStatuses: IntroStatus[] = [
  "OFFERED",
  "A_INTERESTED",
  "B_OFFERED",
  "WAITING_RESPONSE",
  "MATCHED",
  "CONNECTED",
  "MEETING_DONE",
  "RESULT_PENDING",
];

export type DashboardUser = {
  id: number;
  name: string;
  age: number;
  ageSortValue: number;
  ageText?: string;
  gender: "여성" | "남성" | "기타" | "비공개";
  genderCode?: "FEMALE" | "MALE" | "OTHER" | "UNDISCLOSED";
  birthDateInput?: string;
  heightCm: number;
  jobTitle: string;
  companyName?: string;
  selfIntro?: string;
  idealTypeDescription?: string;
  status: UserStatus;
  openLevel: OpenLevel;
  exposureConsent: boolean;
  newMemberNotificationsEnabled: boolean;
  exposurePaused: boolean;
  roles: string[];
  hasMainPhoto: boolean;
  mainPhotoUrl?: string;
  lastChangedAt: string;
};

export type OpenLevel = "PRIVATE" | "SEMI_OPEN" | "FULL_OPEN";
export type RoundStatus = "DRAFT" | "OPEN" | "CLOSED" | "MATCHING" | "COMPLETED";
export type EntryQueueStatus = "WAITING" | "READY" | "PROMOTED" | "CANCELLED";

export const openLevelLabels: Record<OpenLevel, string> = {
  PRIVATE: "운영자 검토 전용",
  SEMI_OPEN: "제한 자동 노출",
  FULL_OPEN: "전체 자동 노출",
};

export const roundStatusLabels: Record<RoundStatus, string> = {
  DRAFT: "준비",
  OPEN: "선택 진행",
  CLOSED: "선택 마감",
  MATCHING: "운영자 조율",
  COMPLETED: "완료",
};

export const entryQueueStatusLabels: Record<EntryQueueStatus, string> = {
  WAITING: "대기",
  READY: "자동 노출 준비",
  PROMOTED: "라운드 반영",
  CANCELLED: "취소",
};

export type DashboardIntroCase = {
  id: number;
  status: IntroStatus;
  participantIds: [number, number] | [];
  participants: [string, string] | [];
  invitorId?: number;
  invitor: string;
  memo?: string;
  updatedAt: string;
  updatedAtIso?: string;
};

export type DashboardUserPhoto = {
  id: number;
  url: string;
  sourceUrl: string;
  originalFileName: string;
  isMain: boolean;
  sortOrder: number;
  uploadedAt: string;
};

export type DashboardUserDetail = DashboardUser & {
  photos: DashboardUserPhoto[];
};

export type DashboardInterest = {
  id: number;
  fromUserId: number;
  toUserId: number;
  fromUserName: string;
  toUserName: string;
  source: InterestSource;
  status: InterestStatus;
  createdAt: string;
  createdAtIso?: string;
  expiresAt?: string;
  isMutual: boolean;
};

export type DashboardIntroCandidate = {
  id: number;
  userAId: number;
  userBId: number;
  userAName: string;
  userBName: string;
  reason: string;
  source: IntroCandidateSource;
  status: IntroCandidateStatus;
  createdAt: string;
  updatedAt: string;
};

export type DashboardExposureQueueItem = {
  userId: number;
  userName: string;
  readyAt: string;
  openLevel: OpenLevel;
  outgoingInterestCount: number;
  incomingInterestCount: number;
  mutualInterestCount: number;
  exposureCount: number;
  exposurePaused: boolean;
};

export type DashboardExposureSignalUser = {
  userId: number;
  userName: string;
  count: number;
  detail: string;
};

export type DashboardExposureData = {
  users: DashboardUser[];
  queue: DashboardExposureQueueItem[];
  interests: DashboardInterest[];
  introCandidates: DashboardIntroCandidate[];
  highDemandUsers: DashboardExposureSignalUser[];
  noInterestUsers: DashboardExposureSignalUser[];
  lowExposureUsers: DashboardExposureSignalUser[];
  databaseConnected: boolean;
  loadError: string | null;
};

export type DashboardRound = {
  id: number;
  title: string;
  status: RoundStatus;
  startAt: string;
  endAt: string;
  selectionLimit: number;
  participantCount: number;
  selectionCount: number;
  mutualCount: number;
  passCount: number;
};

export type DashboardRoundSelection = {
  id: number;
  roundId: number;
  fromUserId: number;
  toUserId: number;
  fromUserName: string;
  toUserName: string;
  isMutual: boolean;
  createdAt: string;
};

export type ParticipantRoundCandidate = DashboardUser & {
  alreadySelected: boolean;
  photos: DashboardUserPhoto[];
};

export type ParticipantExposureCandidate = DashboardUser & {
  photos: DashboardUserPhoto[];
  alreadyInterested: boolean;
  activeIncomingInterestCount: number;
  exposureCount: number;
};

export type ParticipantNewMemberNotification = {
  id: number;
  createdAt: string;
  title: string;
  body: string;
  interestSent: boolean;
  subject: ParticipantExposureCandidate;
};

export type ParticipantInterestSelection = {
  id: number;
  toUserId: number;
  toUserName: string;
  source: InterestSource;
  createdAt: string;
};

export type ParticipantRoundData = {
  actor: DashboardUser | null;
  round: DashboardRound | null;
  candidates: ParticipantRoundCandidate[];
  selectedCount: number;
  selectionLimit: number;
  hasPassed: boolean;
  passedAt?: string;
  passReason?: string;
  isTestMode: boolean;
  databaseConnected: boolean;
  loadError: string | null;
};

export type ParticipantExposureData = {
  actor: DashboardUser | null;
  browseCandidates: ParticipantExposureCandidate[];
  browseSelections: ParticipantInterestSelection[];
  newMemberNotifications: ParticipantNewMemberNotification[];
  browseLimit: number;
  existingMemberInterestLimit: number;
  browseSubmitted: boolean;
  canBrowse: boolean;
  databaseConnected: boolean;
  loadError: string | null;
};

export type DashboardEntryQueueItem = {
  id: number;
  userId: number;
  userName: string;
  status: EntryQueueStatus;
  joinedAt: string;
  memo?: string;
};

export type MemberFilterState = {
  view: "pool" | "recommend" | "graph";
  recommendationFor: string;
  introStatus: "ALL" | IntroStatus;
  gender: "ALL" | "FEMALE" | "MALE" | "OTHER" | "UNDISCLOSED";
  ageMin: string;
  ageMax: string;
  heightMin: string;
  heightMax: string;
  sort: "updated_desc" | "name_asc" | "age_asc" | "age_desc" | "height_asc" | "height_desc" | "gender_asc";
};
