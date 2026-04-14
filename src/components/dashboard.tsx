import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  introStatusLabels,
  openLevelLabels,
  userStatusLabels,
  type DashboardIntroCase,
  type DashboardUser,
  type IntroStatus,
  type MemberFilterState,
  type OpenLevel,
  type UserStatus,
} from "@/lib/domain";
import { StatusBadge } from "@/components/status-badge";
import {
  createIntroCaseAction,
  createMemberAction,
  deleteIntroCaseAction,
  deleteMemberAction,
  updateIntroCaseAction,
  updateMemberAction,
} from "@/app/actions";

const statusOrder: UserStatus[] = [
  "INCOMPLETE",
  "READY",
  "PROGRESSING",
  "HOLD",
  "STOP_REQUESTED",
  "ARCHIVED",
  "BLOCKED",
];

const introStatusOrder: IntroStatus[] = [
  "OFFERED",
  "A_INTERESTED",
  "B_OFFERED",
  "WAITING_RESPONSE",
  "MATCHED",
  "CONNECTED",
  "MEETING_DONE",
  "RESULT_PENDING",
  "SUCCESS",
  "FAILED",
  "DECLINED",
  "EXPIRED",
  "CANCELLED",
];

const genderOptions = [
  ["FEMALE", "여성"],
  ["MALE", "남성"],
  ["OTHER", "기타"],
  ["UNDISCLOSED", "비공개"],
] as const;

const roleOptions = ["PARTICIPANT", "INVITOR", "ADMIN"] as const;
const openLevelOptions: OpenLevel[] = ["PRIVATE", "SEMI_OPEN", "FULL_OPEN"];

type DashboardProps = {
  users: DashboardUser[];
  allUsers: DashboardUser[];
  introCases: DashboardIntroCase[];
  databaseConnected: boolean;
  loadError: string | null;
  filters: MemberFilterState;
};

export function UsersDashboard({ users, databaseConnected, loadError, filters }: DashboardProps) {
  return (
    <>
      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <FilterForm filters={filters} />
      </section>
      <section className="space-y-4">
        <ConnectionStatus databaseConnected={databaseConnected} loadError={loadError} />
        <MemberCreatePanel disabled={!databaseConnected} />
        <MemberTable users={users} editable={databaseConnected} />
      </section>
    </>
  );
}

export function MatchesDashboard({ allUsers, introCases, databaseConnected, loadError, filters }: DashboardProps) {
  const selectedUser = allUsers.find((user) => user.id.toString() === filters.recommendationFor) ?? null;
  const recommendations = selectedUser ? getOppositeGenderRecommendations(selectedUser, allUsers, introCases) : [];

  return (
    <>
      <ConnectionStatus databaseConnected={databaseConnected} loadError={loadError} />
      <RecommendationPanel
        users={allUsers}
        selectedUser={selectedUser}
        recommendations={recommendations}
        filters={filters}
      />
      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <IntroCreatePanel users={allUsers} disabled={!databaseConnected} />
        <IntroCaseTable introCases={introCases} editable={databaseConnected} />
      </section>
    </>
  );
}

export function Dashboard({ users, allUsers, introCases, databaseConnected, loadError, filters }: DashboardProps) {
  const readyCount = users.filter((user) => user.status === "READY").length;
  const progressingCount = users.filter((user) => user.status === "PROGRESSING").length;
  const activeMatchCount = introCases.filter((introCase) =>
    ["OFFERED", "WAITING_RESPONSE", "MATCHED", "CONNECTED", "MEETING_DONE", "RESULT_PENDING"].includes(
      introCase.status,
    ),
  ).length;
  const selectedUser = allUsers.find((user) => user.id.toString() === filters.recommendationFor) ?? null;
  const maleRecommendations = selectedUser ? getOppositeGenderRecommendations(selectedUser, allUsers, introCases) : [];

  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-5 py-6">
        <header className="rounded-lg border border-red-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#E00E0E]">Blackbean Match Ops</p>
              <h1 className="mt-2 text-3xl font-bold text-zinc-950">소개팅 풀 운영</h1>
              <p className="mt-2 text-sm text-zinc-600">
                사용자 정보, 필터링, 소개 진행 기록을 한 화면에서 관리합니다.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="필터 결과" value={users.length} />
              <Metric label="소개 가능" value={readyCount} />
              <Metric label="매칭 진행" value={progressingCount + activeMatchCount} />
            </div>
          </div>
          <p className={databaseConnected ? "mt-4 text-sm font-semibold text-[#E00E0E]" : "mt-4 text-sm text-zinc-500"}>
            {databaseConnected ? "Supabase 연결됨" : "Supabase 연결 대기"}
          </p>
          {loadError ? <p className="mt-2 text-xs text-zinc-500">{loadError}</p> : null}
        </header>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <DashboardTabs filters={filters} />
          <FilterForm filters={filters} />
        </section>

        {filters.view === "recommend" ? (
          <RecommendationPanel
            users={allUsers}
            selectedUser={selectedUser}
            recommendations={maleRecommendations}
            filters={filters}
          />
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
          <div className="space-y-4">
            <MemberCreatePanel disabled={!databaseConnected} />
            <MemberTable users={users} editable={databaseConnected} />
          </div>

          <div className="space-y-4">
            <IntroCreatePanel users={allUsers} disabled={!databaseConnected} />
            <IntroCaseTable introCases={introCases} editable={databaseConnected} />
          </div>
        </section>
      </div>
    </main>
  );
}

function ConnectionStatus({ databaseConnected, loadError }: { databaseConnected: boolean; loadError: string | null }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
      <p className={databaseConnected ? "font-semibold text-[#E00E0E]" : "text-zinc-500"}>
        {databaseConnected ? "Supabase 연결됨" : "Supabase 연결 대기"}
      </p>
      {loadError ? <p className="mt-2 text-xs text-zinc-500">{loadError}</p> : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-32 rounded-lg border border-red-100 bg-red-50 px-4 py-3">
      <p className="text-xs font-semibold text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#E00E0E]">{value}</p>
    </div>
  );
}

function DashboardTabs({ filters }: { filters: MemberFilterState }) {
  const tabClassName = (active: boolean) =>
    active
      ? "rounded-lg bg-[#FF3131] px-4 py-2 text-sm font-bold text-white"
      : "rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-zinc-600 hover:border-red-200 hover:text-[#E00E0E]";

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <Link href={dashboardHref(filters, { view: "pool" }, "/users")} className={tabClassName(filters.view === "pool")}>
        전체 풀
      </Link>
      <Link href={dashboardHref(filters, { view: "recommend" }, "/matches")} className={tabClassName(filters.view === "recommend")}>
        상대 추천 매칭
      </Link>
    </div>
  );
}

function FilterForm({ filters }: { filters: MemberFilterState }) {
  return (
    <form className="grid gap-3 md:grid-cols-7" method="get">
      <input type="hidden" name="view" value={filters.view} />
      <input type="hidden" name="recommendationFor" value={filters.recommendationFor} />
      <Field label="성별">
        <select name="gender" defaultValue={filters.gender} className={inputClassName}>
          <option value="ALL">전체</option>
          {genderOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="나이 최소">
        <input name="ageMin" type="number" min="0" defaultValue={filters.ageMin} className={inputClassName} />
      </Field>
      <Field label="나이 최대">
        <input name="ageMax" type="number" min="0" defaultValue={filters.ageMax} className={inputClassName} />
      </Field>
      <Field label="키 최소">
        <input name="heightMin" type="number" min="0" defaultValue={filters.heightMin} className={inputClassName} />
      </Field>
      <Field label="키 최대">
        <input name="heightMax" type="number" min="0" defaultValue={filters.heightMax} className={inputClassName} />
      </Field>
      <Field label="정렬">
        <select name="sort" defaultValue={filters.sort} className={inputClassName}>
          <option value="updated_desc">최근 수정순</option>
          <option value="name_asc">이름순</option>
          <option value="age_asc">나이 낮은순</option>
          <option value="age_desc">나이 높은순</option>
          <option value="height_asc">키 낮은순</option>
          <option value="height_desc">키 높은순</option>
          <option value="gender_asc">성별순</option>
        </select>
      </Field>
      <div className="flex items-end gap-2">
        <button className="h-10 rounded-lg bg-[#FF3131] px-4 text-sm font-bold text-white hover:bg-[#E00E0E]">
          적용
        </button>
        <Link className="flex h-10 items-center rounded-lg border border-zinc-300 px-4 text-sm font-semibold text-zinc-700" href="/">
          초기화
        </Link>
      </div>
    </form>
  );
}

function RecommendationPanel({
  users,
  selectedUser,
  recommendations,
  filters,
}: {
  users: DashboardUser[];
  selectedUser: DashboardUser | null;
  recommendations: DashboardUser[];
  filters: MemberFilterState;
}) {
  return (
    <section className="rounded-lg border border-red-100 bg-red-50/70 p-4 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="rounded-lg border border-red-100 bg-white p-4">
          <h2 className="text-lg font-bold text-zinc-950">상대 추천 매칭</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-600">
            기준 사용자를 선택하면 소개 가능 상태의 상대 이성 후보를 키, 나이, 프로필 완성도 기준으로 정렬합니다.
          </p>
          <form className="mt-4 grid gap-3" method="get">
            <input type="hidden" name="view" value="recommend" />
            <input type="hidden" name="gender" value={filters.gender} />
            <input type="hidden" name="ageMin" value={filters.ageMin} />
            <input type="hidden" name="ageMax" value={filters.ageMax} />
            <input type="hidden" name="heightMin" value={filters.heightMin} />
            <input type="hidden" name="heightMax" value={filters.heightMax} />
            <input type="hidden" name="sort" value={filters.sort} />
            <Field label="기준 사용자">
              <UserSelect name="recommendationFor" users={users} required selectedValue={filters.recommendationFor} />
            </Field>
            <button className={primaryButtonClassName}>추천 보기</button>
          </form>
        </div>

        <div className="min-w-0 overflow-hidden rounded-lg border border-red-100 bg-white">
          <div className="flex items-center justify-between border-b border-red-100 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-zinc-950">
                {selectedUser ? `${selectedUser.name} 기준 추천` : "기준 사용자를 선택하세요"}
              </p>
              <p className="mt-1 text-xs text-zinc-500">이미 진행 중인 사용자와 같은 성별 사용자는 제외합니다.</p>
            </div>
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-[#E00E0E]">
              {recommendations.length}명
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] table-fixed text-left text-sm">
              <thead className="bg-zinc-50 text-xs font-bold text-zinc-500">
                <tr>
                  <th className="w-32 px-3 py-3">추천도</th>
                  <th className="w-36 px-3 py-3">이름</th>
                  <th className="w-24 px-3 py-3">나이</th>
                  <th className="w-24 px-3 py-3">키</th>
                  <th className="w-44 px-3 py-3">직업</th>
                  <th className="px-3 py-3">소개</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {recommendations.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-zinc-500" colSpan={6}>
                      추천 후보가 없습니다.
                    </td>
                  </tr>
                ) : (
                  recommendations.map((user) => (
                    <tr key={user.id} className="hover:bg-red-50/50">
                      <td className="px-3 py-3">
                        <span className="rounded-full bg-[#FF3131] px-2.5 py-1 text-xs font-bold text-white">
                          {recommendationLabel(selectedUser, user)}
                        </span>
                      </td>
                      <td className="truncate px-3 py-3 font-semibold text-zinc-950">{user.name}</td>
                      <td className="px-3 py-3 text-zinc-700">{formatAge(user)}</td>
                      <td className="px-3 py-3 text-zinc-700">{user.heightCm > 0 ? `${user.heightCm}cm` : "-"}</td>
                      <td className="truncate px-3 py-3 text-zinc-700">{user.jobTitle}</td>
                      <td className="px-3 py-3 text-xs leading-5 text-zinc-600">
                        <p className="line-clamp-2 break-words">{user.selfIntro || "-"}</p>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function MemberCreatePanel({ disabled }: { disabled: boolean }) {
  return (
    <details className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <summary className="cursor-pointer text-sm font-bold text-[#E00E0E]">사용자 등록</summary>
      <form action={createMemberAction} className="mt-4 grid gap-4">
        <MemberFields />
        <button disabled={disabled} className={primaryButtonClassName}>
          사용자 등록
        </button>
      </form>
    </details>
  );
}

function MemberTable({ users, editable }: { users: DashboardUser[]; editable: boolean }) {
  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <h2 className="text-lg font-bold text-zinc-950">사용자 목록</h2>
        <p className="text-xs text-zinc-500">연락처는 목록에 표시하지 않습니다.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1160px] table-fixed border-collapse text-left text-sm">
          <thead className="bg-zinc-50 text-xs font-bold uppercase text-zinc-500">
            <tr>
              <th className="w-16 px-3 py-3">사진</th>
              <th className="w-36 px-3 py-3">이름</th>
              <th className="w-20 px-3 py-3">성별</th>
              <th className="w-24 px-3 py-3">나이</th>
              <th className="w-20 px-3 py-3">키</th>
              <th className="w-44 px-3 py-3">직업 / 회사</th>
              <th className="w-32 px-3 py-3">상태</th>
              <th className="w-36 px-3 py-3">역할</th>
              <th className="px-3 py-3">소개 / 이상형</th>
              <th className="w-32 px-3 py-3">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {users.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-zinc-500" colSpan={10}>
                  조건에 맞는 사용자가 없습니다.
                </td>
              </tr>
            ) : (
              users.map((user) => <MemberRow key={user.id} user={user} editable={editable} />)
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MemberRow({ user, editable }: { user: DashboardUser; editable: boolean }) {
  return (
    <tr className="align-middle hover:bg-red-50/50">
      <td className="px-3 py-2">
        <div
          className={
            user.mainPhotoUrl
              ? "photo-skeleton relative h-12 w-12 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100"
              : "relative h-12 w-12 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100"
          }
        >
          {user.mainPhotoUrl ? (
            <Image
              src={user.mainPhotoUrl}
              alt={`${user.name} 대표 사진`}
              fill
              sizes="48px"
              className="relative z-10 object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-zinc-400">없음</div>
          )}
        </div>
      </td>
      <td className="truncate px-3 py-2 font-semibold text-zinc-950" title={user.name}>
        {user.name}
      </td>
      <td className="px-3 py-2 text-zinc-700">{user.gender}</td>
      <td className="truncate px-3 py-2 text-zinc-700" title={formatAge(user)}>
        {formatAge(user)}
      </td>
      <td className="px-3 py-2 text-zinc-700">{user.heightCm > 0 ? `${user.heightCm}cm` : "-"}</td>
      <td className="px-3 py-2 text-zinc-700">
        <p className="truncate font-medium" title={user.jobTitle}>
          {user.jobTitle}
        </p>
        {user.companyName ? (
          <p className="truncate text-xs text-zinc-500" title={user.companyName}>
            {user.companyName}
          </p>
        ) : null}
      </td>
      <td className="px-3 py-2">
        <StatusBadge status={user.status} />
        <p className="mt-1 text-[11px] font-semibold text-[#E00E0E]">{openLevelLabels[user.openLevel]}</p>
      </td>
      <td className="px-3 py-2">
        <div className="flex max-h-14 flex-col gap-1 overflow-hidden">
          {user.roles.slice(0, 2).map((role) => (
            <span key={role} className="w-fit max-w-full truncate rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-600">
              {role}
            </span>
          ))}
          {user.roles.length > 2 ? <span className="text-[11px] font-semibold text-zinc-400">+{user.roles.length - 2}</span> : null}
        </div>
      </td>
      <td className="px-3 py-2 text-xs leading-5 text-zinc-600">
        <p className="line-clamp-2 break-words">{user.selfIntro || "-"}</p>
        {user.idealTypeDescription ? (
          <p className="mt-1 line-clamp-1 break-words text-zinc-400">이상형 {user.idealTypeDescription}</p>
        ) : null}
      </td>
      <td className="px-3 py-2">
        {editable ? (
          <div className="flex items-center gap-3">
          <Link href={`/users/${user.id}`} className="text-xs font-bold text-zinc-600 hover:text-[#E00E0E]">
            자세히
          </Link>
          <details className="relative w-14">
            <summary className="cursor-pointer text-xs font-bold text-[#E00E0E]">수정</summary>
            <form action={updateMemberAction} className="absolute right-0 z-20 mt-3 grid w-80 gap-3 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg">
              <input type="hidden" name="id" value={user.id} />
              <MemberFields user={user} compact />
              <button className={primaryButtonClassName}>저장</button>
            </form>
            <form action={deleteMemberAction} className="mt-2">
              <input type="hidden" name="id" value={user.id} />
              <button className="text-xs font-bold text-zinc-500 hover:text-[#E00E0E]">삭제</button>
            </form>
          </details>
          </div>
        ) : null}
      </td>
    </tr>
  );
}

function IntroCreatePanel({ users, disabled }: { users: DashboardUser[]; disabled: boolean }) {
  return (
    <details className="overflow-hidden rounded-lg border border-zinc-200 bg-white p-4 shadow-sm" open>
      <summary className="cursor-pointer text-lg font-bold text-zinc-950">매칭 기록 생성</summary>
      <form action={createIntroCaseAction} className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
        <IntroCaseFields users={users} />
        <button disabled={disabled} className={`${primaryButtonClassName} sm:col-span-2`}>
          매칭 기록 추가
        </button>
      </form>
    </details>
  );
}

function IntroCaseTable({
  introCases,
  editable,
}: {
  introCases: DashboardIntroCase[];
  editable: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-4 py-3">
        <h2 className="text-lg font-bold text-zinc-950">매칭 기록</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] table-fixed text-left text-sm">
          <thead className="bg-zinc-50 text-xs font-bold uppercase text-zinc-500">
            <tr>
              <th className="w-16 px-3 py-3">ID</th>
              <th className="w-32 px-3 py-3">상태</th>
              <th className="w-48 px-3 py-3">참여자</th>
              <th className="w-32 px-3 py-3">주선자</th>
              <th className="px-3 py-3">메모</th>
              <th className="w-20 px-3 py-3">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {introCases.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-zinc-500" colSpan={6}>
                  매칭 기록이 없습니다.
                </td>
              </tr>
            ) : (
              introCases.map((introCase) => (
                <tr key={introCase.id} className="align-top hover:bg-red-50/50">
                  <td className="px-3 py-3 font-semibold text-zinc-700">#{introCase.id}</td>
                  <td className="px-3 py-3">
                    <IntroStatusBadge status={introCase.status} />
                  </td>
                  <td className="truncate px-3 py-3 text-zinc-700" title={formatParticipants(introCase)}>
                    {formatParticipants(introCase)}
                  </td>
                  <td className="truncate px-3 py-3 text-zinc-700" title={introCase.invitor}>
                    {introCase.invitor}
                  </td>
                  <td className="px-3 py-3 text-xs leading-5 text-zinc-500">
                    <p className="line-clamp-2 break-words">{introCase.memo || "-"}</p>
                  </td>
                  <td className="px-3 py-3">
                    {editable ? (
                      <details className="relative w-16">
                        <summary className="cursor-pointer text-xs font-bold text-[#E00E0E]">수정</summary>
                        <form action={updateIntroCaseAction} className="absolute right-0 z-20 mt-3 grid w-72 gap-3 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg">
                          <input type="hidden" name="id" value={introCase.id} />
                          <Field label="상태">
                            <select name="status" defaultValue={introCase.status} className={inputClassName}>
                              {introStatusOrder.map((status) => (
                                <option key={status} value={status}>
                                  {introStatusLabels[status]}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label="메모">
                            <textarea name="memo" defaultValue={introCase.memo} rows={3} className={inputClassName} />
                          </Field>
                          <button className={primaryButtonClassName}>저장</button>
                        </form>
                        <form action={deleteIntroCaseAction} className="mt-2">
                          <input type="hidden" name="id" value={introCase.id} />
                          <button className="text-xs font-bold text-zinc-500 hover:text-[#E00E0E]">삭제</button>
                        </form>
                      </details>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MemberFields({ user, compact = false }: { user?: DashboardUser; compact?: boolean }) {
  return (
    <div className={compact ? "grid gap-3" : "grid gap-4 md:grid-cols-2"}>
      <Field label="이름">
        <input name="name" required defaultValue={user?.name} className={inputClassName} />
      </Field>
      <Field label="성별">
        <select name="gender" defaultValue={genderCodeFromLabel(user?.gender)} className={inputClassName}>
          {genderOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="상태">
        <select name="status" defaultValue={user?.status ?? "INCOMPLETE"} className={inputClassName}>
          {statusOrder.map((status) => (
            <option key={status} value={status}>
              {userStatusLabels[status]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="오픈 레벨">
        <select name="openLevel" defaultValue={user?.openLevel ?? "PRIVATE"} className={inputClassName}>
          {openLevelOptions.map((level) => (
            <option key={level} value={level}>
              {openLevelLabels[level]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="나이">
        <input name="ageText" defaultValue={user?.ageText} placeholder="예: 95, 98, 30" className={inputClassName} />
      </Field>
      <Field label="생년월일">
        <input name="birthDate" type="date" defaultValue={user?.birthDateInput} className={inputClassName} />
      </Field>
      <Field label="키">
        <input name="heightCm" type="number" min="0" defaultValue={user?.heightCm || ""} className={inputClassName} />
      </Field>
      <Field label="직업">
        <input name="jobTitle" defaultValue={user?.jobTitle === "직업 미입력" ? "" : user?.jobTitle} className={inputClassName} />
      </Field>
      <Field label="회사">
        <input name="companyName" defaultValue={user?.companyName} className={inputClassName} />
      </Field>
      <Field label="연락처">
        <input name="phone" className={inputClassName} />
      </Field>
      <div className={compact ? "" : "md:col-span-2"}>
        <Field label="자기소개">
          <textarea name="selfIntro" rows={compact ? 2 : 3} defaultValue={user?.selfIntro} className={inputClassName} />
        </Field>
      </div>
      <div className={compact ? "" : "md:col-span-2"}>
        <Field label="이상형">
          <textarea name="idealTypeDescription" rows={compact ? 2 : 3} defaultValue={user?.idealTypeDescription} className={inputClassName} />
        </Field>
      </div>
      <fieldset className={compact ? "grid gap-2" : "grid gap-2 md:col-span-2"}>
        <legend className="text-xs font-semibold text-zinc-600">역할</legend>
        <div className="flex flex-wrap gap-2">
          {roleOptions.map((role) => (
            <label key={role} className="inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-700">
              <input type="checkbox" name="roles" value={role} defaultChecked={user ? user.roles.includes(role) : role === "PARTICIPANT"} />
              {role}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function IntroCaseFields({ users }: { users: DashboardUser[] }) {
  return (
    <>
      <Field label="참여자 A">
        <UserSelect name="personAId" users={users} required />
      </Field>
      <Field label="참여자 B">
        <UserSelect name="personBId" users={users} required />
      </Field>
      <Field label="주선자">
        <UserSelect name="invitorUserId" users={users} />
      </Field>
      <Field label="상태">
        <select name="status" defaultValue="OFFERED" className={inputClassName}>
          {introStatusOrder.map((status) => (
            <option key={status} value={status}>
              {introStatusLabels[status]}
            </option>
          ))}
        </select>
      </Field>
      <div className="sm:col-span-2">
        <Field label="메모">
        <textarea name="memo" rows={3} className={inputClassName} />
        </Field>
      </div>
    </>
  );
}

function UserSelect({
  name,
  users,
  required = false,
  selectedValue = "",
}: {
  name: string;
  users: DashboardUser[];
  required?: boolean;
  selectedValue?: string;
}) {
  return (
    <select name={name} required={required} defaultValue={selectedValue} className={inputClassName}>
      <option value="">{required ? "선택" : "미지정"}</option>
      {users.map((user) => (
        <option key={user.id} value={user.id}>
          {user.name} · {user.gender} · {formatAge(user)}
        </option>
      ))}
    </select>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-zinc-600">
      {label}
      {children}
    </label>
  );
}

function IntroStatusBadge({ status }: { status: IntroStatus }) {
  return (
    <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-[#E00E0E]">
      {introStatusLabels[status]}
    </span>
  );
}

function genderCodeFromLabel(gender?: DashboardUser["gender"]) {
  if (!gender) return "UNDISCLOSED";
  if (gender === "여성") return "FEMALE";
  if (gender === "남성") return "MALE";
  if (gender === "기타") return "OTHER";
  return "UNDISCLOSED";
}

function formatAge(user: DashboardUser) {
  if (user.age > 0 && user.ageText) return `${user.age}세 (${user.ageText})`;
  if (user.age > 0) return `${user.age}세`;
  if (user.ageText) return user.ageText;
  return "-";
}

function formatParticipants(introCase: DashboardIntroCase) {
  return introCase.participants.length === 2 ? `${introCase.participants[0]} · ${introCase.participants[1]}` : "미확인";
}

function getOppositeGenderRecommendations(
  selectedUser: DashboardUser,
  users: DashboardUser[],
  introCases: DashboardIntroCase[],
) {
  const activeUserIds = new Set(
    introCases
      .filter((introCase) =>
        ["OFFERED", "WAITING_RESPONSE", "MATCHED", "CONNECTED", "MEETING_DONE", "RESULT_PENDING"].includes(
          introCase.status,
        ),
      )
      .flatMap((introCase) => introCase.participantIds),
  );

  return users
    .filter((user) => {
      if (user.id === selectedUser.id) return false;
      if (!isOppositeGender(selectedUser, user)) return false;
      if (user.status !== "READY") return false;
      return !activeUserIds.has(user.id);
    })
    .sort((a, b) => recommendationScore(selectedUser, b) - recommendationScore(selectedUser, a));
}

function isOppositeGender(selectedUser: DashboardUser, candidate: DashboardUser) {
  if (selectedUser.genderCode === "FEMALE") return candidate.genderCode === "MALE";
  if (selectedUser.genderCode === "MALE") return candidate.genderCode === "FEMALE";
  return candidate.genderCode === "FEMALE" || candidate.genderCode === "MALE";
}

function recommendationScore(selectedUser: DashboardUser, candidate: DashboardUser) {
  let score = 0;

  if (candidate.heightCm >= 175) score += 20;
  if (candidate.hasMainPhoto) score += 15;
  if (candidate.selfIntro) score += 10;
  if (candidate.idealTypeDescription) score += 5;

  if (selectedUser.ageSortValue > 0 && candidate.ageSortValue > 0) {
    const ageGap = Math.abs(selectedUser.ageSortValue - candidate.ageSortValue);
    score += Math.max(0, 30 - ageGap * 5);
  }

  if (selectedUser.heightCm > 0 && candidate.heightCm > 0) {
    score += candidate.heightCm >= selectedUser.heightCm ? 10 : 4;
  }

  return score;
}

function recommendationLabel(selectedUser: DashboardUser | null, candidate: DashboardUser) {
  if (!selectedUser) return "추천";
  const score = recommendationScore(selectedUser, candidate);
  if (score >= 70) return "상";
  if (score >= 45) return "중";
  return "검토";
}

function dashboardHref(filters: MemberFilterState, overrides: Partial<MemberFilterState>, pathname = "/") {
  const nextFilters = { ...filters, ...overrides };
  const params = new URLSearchParams();

  if (nextFilters.view !== "pool") params.set("view", nextFilters.view);
  if (nextFilters.recommendationFor) params.set("recommendationFor", nextFilters.recommendationFor);
  if (nextFilters.gender !== "ALL") params.set("gender", nextFilters.gender);
  if (nextFilters.ageMin) params.set("ageMin", nextFilters.ageMin);
  if (nextFilters.ageMax) params.set("ageMax", nextFilters.ageMax);
  if (nextFilters.heightMin) params.set("heightMin", nextFilters.heightMin);
  if (nextFilters.heightMax) params.set("heightMax", nextFilters.heightMax);
  if (nextFilters.sort !== "updated_desc") params.set("sort", nextFilters.sort);

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

const inputClassName =
  "w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-[#FF3131] focus:ring-2 focus:ring-red-100 disabled:bg-zinc-100";

const primaryButtonClassName =
  "rounded-lg bg-[#FF3131] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#E00E0E] disabled:cursor-not-allowed disabled:bg-zinc-300";
