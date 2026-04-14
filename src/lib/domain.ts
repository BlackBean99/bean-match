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

export type UserStatus = keyof typeof userStatusLabels;
export type IntroStatus = keyof typeof introStatusLabels;

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
  roles: string[];
  hasMainPhoto: boolean;
  mainPhotoUrl?: string;
  lastChangedAt: string;
};

export type OpenLevel = "PRIVATE" | "SEMI_OPEN" | "FULL_OPEN";
export type RoundStatus = "DRAFT" | "OPEN" | "CLOSED" | "MATCHING" | "COMPLETED";
export type EntryQueueStatus = "WAITING" | "READY" | "PROMOTED" | "CANCELLED";

export const openLevelLabels: Record<OpenLevel, string> = {
  PRIVATE: "Operator 매칭",
  SEMI_OPEN: "제한 노출",
  FULL_OPEN: "전체 라운드",
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
  READY: "다음 라운드 준비",
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
};

export type ParticipantRoundData = {
  actor: DashboardUser | null;
  round: DashboardRound | null;
  candidates: ParticipantRoundCandidate[];
  selectedCount: number;
  selectionLimit: number;
  isTestMode: boolean;
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
  view: "pool" | "recommend";
  recommendationFor: string;
  gender: "ALL" | "FEMALE" | "MALE" | "OTHER" | "UNDISCLOSED";
  ageMin: string;
  ageMax: string;
  heightMin: string;
  heightMax: string;
  sort: "updated_desc" | "name_asc" | "age_asc" | "age_desc" | "height_asc" | "height_desc" | "gender_asc";
};
