import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  AdminMutedSection,
  AdminSection,
  AdminStatCard,
  AdminTableSection,
  adminInputClassName,
  adminPrimaryButtonClassName,
  adminSecondaryButtonClassName,
} from "@/components/admin-ui";
import { FormPendingFieldset } from "@/components/form-pending-fieldset";
import { FormSubmitButton } from "@/components/form-submit-button";
import { IntroCaseCreateForm } from "@/components/intro-case-create-form";
import { MatchNetworkDashboard } from "@/components/match-network-dashboard";
import { NavigationSubmitButton } from "@/components/navigation-submit-button";
import {
  activeIntroStatuses,
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
  const openCount = users.filter((user) => user.openLevel === "FULL_OPEN").length;
  const waitingCount = users.filter((user) => user.status === "INCOMPLETE" || user.status === "HOLD").length;

  return (
    <div className="grid gap-5">
      <section className="grid gap-4 xl:grid-cols-4">
        <AdminStatCard label="전체 회원 수" value={users.length} detail="현재 필터에 포함된 회원 기준입니다." />
        <AdminStatCard label="프로필 오픈 가능" value={openCount} tone="green" detail="FULL_OPEN 동의 기준" />
        <AdminStatCard label="검토 필요" value={waitingCount} tone="amber" detail="미완료 또는 보류 상태" />
        <AdminStatCard label="운영 연결" value={databaseConnected ? "ON" : "OFF"} tone="blue" detail={loadError ?? "Supabase 연결 상태"} />
      </section>

      <AdminSection className="p-4 sm:p-5">
        <FilterForm filters={filters} />
      </AdminSection>

      <section className="space-y-5">
        <ConnectionStatus databaseConnected={databaseConnected} loadError={loadError} />
        <MemberCreatePanel disabled={!databaseConnected} />
        <MemberTable users={users} editable={databaseConnected} />
      </section>
    </div>
  );
}

export function MatchesDashboard({ allUsers, introCases, databaseConnected, loadError, filters }: DashboardProps) {
  const selectedUser = allUsers.find((user) => user.id.toString() === filters.recommendationFor) ?? null;
  const recommendations = selectedUser ? getOppositeGenderRecommendations(selectedUser, allUsers, introCases) : [];
  const filteredIntroCases =
    filters.introStatus === "ALL" ? introCases : introCases.filter((introCase) => introCase.status === filters.introStatus);
  const profileOpenCount = allUsers.filter((user) => user.openLevel === "FULL_OPEN").length;
  const activeCaseCount = introCases.filter((introCase) => activeIntroStatuses.includes(introCase.status)).length;

  return (
    <div className="grid gap-5">
      <section className="grid gap-4 xl:grid-cols-4">
        <AdminStatCard label="전체 풀" value={allUsers.length} detail="매칭 검토가 가능한 전체 회원" />
        <AdminStatCard label="프로필 오픈 동의" value={profileOpenCount} tone="green" detail="FULL_OPEN 기준" />
        <AdminStatCard label="매칭 대기" value={activeCaseCount} tone="amber" detail="활성 소개 상태 기준" />
        <AdminStatCard label="추천 후보" value={recommendations.length} tone="blue" detail={selectedUser ? `${selectedUser.name} 기준` : "기준 사용자를 선택하세요"} />
      </section>

      <ConnectionStatus databaseConnected={databaseConnected} loadError={loadError} />

      <AdminSection className="p-4 sm:p-5">
        <DashboardTabs filters={filters} />
        <FilterForm filters={filters} showIntroStatus />
      </AdminSection>

      {filters.view === "graph" ? (
        <MatchNetworkDashboard users={allUsers} introCases={introCases} initialStatusFilter={filters.introStatus} />
      ) : (
        <>
          <RecommendationPanel
            users={allUsers}
            selectedUser={selectedUser}
            recommendations={recommendations}
            filters={filters}
          />
          <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
            <IntroCreatePanel users={allUsers} disabled={!databaseConnected} />
            <IntroCaseTable introCases={filteredIntroCases} editable={databaseConnected} />
          </section>
        </>
      )}
    </div>
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
    <div className="grid gap-5">
      <section className="grid gap-4 xl:grid-cols-4">
        <AdminStatCard label="필터 결과" value={users.length} detail="현재 목록 기준" />
        <AdminStatCard label="소개 가능" value={readyCount} tone="green" />
        <AdminStatCard label="매칭 진행" value={progressingCount + activeMatchCount} tone="amber" />
        <AdminStatCard label="추천 후보" value={maleRecommendations.length} tone="blue" />
      </section>

      <ConnectionStatus databaseConnected={databaseConnected} loadError={loadError} />

      <AdminSection className="p-4 sm:p-5">
        <DashboardTabs filters={filters} />
        <FilterForm filters={filters} showIntroStatus={filters.view !== "pool"} />
      </AdminSection>

      {filters.view === "recommend" ? (
        <RecommendationPanel
          users={allUsers}
          selectedUser={selectedUser}
          recommendations={maleRecommendations}
          filters={filters}
        />
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
        <div className="space-y-5">
          <MemberCreatePanel disabled={!databaseConnected} />
          <MemberTable users={users} editable={databaseConnected} />
        </div>

        <div className="space-y-5">
          <IntroCreatePanel users={allUsers} disabled={!databaseConnected} />
          <IntroCaseTable introCases={introCases} editable={databaseConnected} />
        </div>
      </section>
    </div>
  );
}

function ConnectionStatus({ databaseConnected, loadError }: { databaseConnected: boolean; loadError: string | null }) {
  return (
    <div className="rounded-[24px] border border-white/80 bg-white/90 px-5 py-4 text-sm shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
      <p className={databaseConnected ? "font-semibold text-[#e63a68]" : "text-zinc-500"}>
        {databaseConnected ? "Supabase 연결됨" : "Supabase 연결 대기"}
      </p>
      {loadError ? <p className="mt-2 text-xs text-zinc-500">{loadError}</p> : null}
    </div>
  );
}

function DashboardTabs({ filters }: { filters: MemberFilterState }) {
  const tabClassName = (active: boolean) =>
    active
      ? "rounded-2xl bg-[linear-gradient(135deg,#ff4f7a,#ff6a3d)] px-4 py-2.5 text-sm font-bold text-white shadow-[0_16px_30px_rgba(255,79,122,0.24)]"
      : "rounded-2xl border border-[#ececf2] bg-white px-4 py-2.5 text-sm font-bold text-zinc-500 transition hover:border-[#ffc6d5] hover:text-[#e63a68]";

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <Link href={dashboardHref(filters, { view: "pool", introStatus: "ALL" }, "/users")} className={tabClassName(filters.view === "pool")}>
        전체 풀
      </Link>
      <Link href={dashboardHref(filters, { view: "recommend" }, "/matches")} className={tabClassName(filters.view === "recommend")}>
        상대 추천 매칭
      </Link>
      <Link href={dashboardHref(filters, { view: "graph" }, "/matches")} className={tabClassName(filters.view === "graph")}>
        관계 그래프
      </Link>
    </div>
  );
}

function FilterForm({ filters, showIntroStatus = false }: { filters: MemberFilterState; showIntroStatus?: boolean }) {
  return (
    <form className={showIntroStatus ? "grid gap-3 xl:grid-cols-8" : "grid gap-3 xl:grid-cols-7"} method="get">
      <input type="hidden" name="view" value={filters.view} />
      <input type="hidden" name="recommendationFor" value={filters.recommendationFor} />
      {showIntroStatus ? (
        <Field label="관계 상태">
          <select name="introStatus" defaultValue={filters.introStatus} className={inputClassName}>
            <option value="ALL">전체</option>
            {introStatusOrder.map((status) => (
              <option key={status} value={status}>
                {introStatusLabels[status]}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
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
        <NavigationSubmitButton
          label="적용"
          pendingLabel="적용 중..."
          className={adminPrimaryButtonClassName}
        />
        <Link className={adminSecondaryButtonClassName} href="/">
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
    <AdminMutedSection className="p-4 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="rounded-[24px] border border-white/80 bg-white p-5">
          <h2 className="text-lg font-bold text-zinc-950">상대 추천 매칭</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-600">
            기준 사용자를 선택하면 소개 가능 상태의 상대 이성 후보를 키, 나이, 프로필 완성도 기준으로 정렬합니다.
          </p>
          <form className="mt-4 grid gap-3" method="get">
            <input type="hidden" name="view" value="recommend" />
            <input type="hidden" name="introStatus" value={filters.introStatus} />
            <input type="hidden" name="gender" value={filters.gender} />
            <input type="hidden" name="ageMin" value={filters.ageMin} />
            <input type="hidden" name="ageMax" value={filters.ageMax} />
            <input type="hidden" name="heightMin" value={filters.heightMin} />
            <input type="hidden" name="heightMax" value={filters.heightMax} />
            <input type="hidden" name="sort" value={filters.sort} />
            <Field label="기준 사용자">
              <UserSelect name="recommendationFor" users={users} required selectedValue={filters.recommendationFor} />
            </Field>
            <NavigationSubmitButton label="추천 보기" pendingLabel="불러오는 중..." className={primaryButtonClassName} />
          </form>
        </div>

        <div className="min-w-0 overflow-hidden rounded-[24px] border border-white/80 bg-white">
          <div className="flex items-center justify-between border-b border-[#ffe0e8] px-4 py-3">
            <div>
              <p className="text-sm font-bold text-zinc-950">
                {selectedUser ? `${selectedUser.name} 기준 추천` : "기준 사용자를 선택하세요"}
              </p>
              <p className="mt-1 text-xs text-zinc-500">이미 진행 중인 사용자와 같은 성별 사용자는 제외합니다.</p>
            </div>
            <span className="rounded-full bg-[#fff1f5] px-3 py-1 text-xs font-bold text-[#e63a68]">
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
                    <tr key={user.id} className="hover:bg-[#fff7fa]">
                      <td className="px-3 py-3">
                        <span className="rounded-full bg-[linear-gradient(135deg,#ff4f7a,#ff6a3d)] px-2.5 py-1 text-xs font-bold text-white">
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
    </AdminMutedSection>
  );
}

function MemberCreatePanel({ disabled }: { disabled: boolean }) {
  return (
    <details className="rounded-[28px] border border-white/80 bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
      <summary className="cursor-pointer text-sm font-bold text-[#e63a68]">회원 추가</summary>
      <form action={createMemberAction} className="mt-4 grid gap-4">
        <FormPendingFieldset className="grid gap-4">
          <MemberFields />
          <FormSubmitButton label="사용자 등록" pendingLabel="등록 중..." disabled={disabled} className={primaryButtonClassName} />
        </FormPendingFieldset>
      </form>
    </details>
  );
}

function MemberTable({ users, editable }: { users: DashboardUser[]; editable: boolean }) {
  return (
    <AdminTableSection>
      <div className="flex items-center justify-between border-b border-[#f1f5f9] px-5 py-4">
        <h2 className="text-lg font-bold text-zinc-950">사용자 목록</h2>
        <p className="text-xs text-zinc-500">연락처는 목록에 표시하지 않습니다.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1160px] table-fixed border-collapse text-left text-sm">
          <thead className="bg-[#fafafc] text-xs font-bold uppercase text-zinc-500">
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
    </AdminTableSection>
  );
}

function MemberRow({ user, editable }: { user: DashboardUser; editable: boolean }) {
  return (
    <tr className="align-middle hover:bg-[#fff7fa]">
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
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-zinc-400">없음</div>
          )}
        </div>
      </td>
      <td className="px-3 py-2" title={user.name}>
        <p className="truncate font-semibold text-zinc-950">{user.name}</p>
        <p className="mt-1 text-[11px] font-semibold text-zinc-500">ID {user.id}</p>
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
            <Link href={`/users/${user.id}`} className="text-xs font-bold text-zinc-600 hover:text-[#e63a68]">
              자세히
            </Link>
            <details className="relative w-14">
              <summary className="cursor-pointer text-xs font-bold text-[#e63a68]">수정</summary>
              <form action={updateMemberAction} className="absolute right-0 z-20 mt-3 grid w-80 gap-3 rounded-[24px] border border-[#f1f5f9] bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.14)]">
                <FormPendingFieldset className="grid gap-3">
                  <input type="hidden" name="id" value={user.id} />
                  <MemberFields user={user} compact />
                  <FormSubmitButton label="저장" pendingLabel="저장 중..." className={adminPrimaryButtonClassName} />
                </FormPendingFieldset>
              </form>
              <form action={deleteMemberAction} className="mt-2">
                <FormPendingFieldset className="contents">
                  <input type="hidden" name="id" value={user.id} />
                  <FormSubmitButton
                    label="삭제"
                    pendingLabel="삭제 중..."
                    className="text-xs font-bold text-zinc-500 hover:text-[#e63a68] disabled:text-zinc-300"
                  />
                </FormPendingFieldset>
              </form>
            </details>
          </div>
        ) : null}
      </td>
    </tr>
  );
}

function IntroCreatePanel({ users, disabled }: { users: DashboardUser[]; disabled: boolean }) {
  const eligibleUsers = users.filter((user) => user.status === "READY");

  return (
    <details className="overflow-hidden rounded-[28px] border border-white/80 bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)]" open>
      <summary className="cursor-pointer text-lg font-bold text-zinc-950">매칭 기록 생성</summary>
      <p className="mt-3 text-sm leading-6 text-zinc-500">
        신규 매칭은 현재 `READY` 상태 사용자만 선택할 수 있습니다. 이미 진행 중이거나 기존 매칭 이력이 있는 조합은 추가되지 않습니다.
      </p>
      <IntroCaseCreateForm
        users={eligibleUsers}
        invitors={users}
        introStatuses={introStatusOrder.map((status) => ({ value: status, label: introStatusLabels[status] }))}
        inputClassName={inputClassName}
        fieldClassName="grid gap-1 text-xs font-semibold text-zinc-600"
        buttonClassName={primaryButtonClassName}
        disabled={disabled || eligibleUsers.length < 2}
      />
      {eligibleUsers.length < 2 ? (
        <p className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
          매칭을 추가하려면 `READY` 상태 사용자가 최소 2명 필요합니다.
        </p>
      ) : null}
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
    <AdminTableSection>
      <div className="border-b border-[#f1f5f9] px-5 py-4">
        <h2 className="text-lg font-bold text-zinc-950">매칭 기록</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] table-fixed text-left text-sm">
          <thead className="bg-[#fafafc] text-xs font-bold uppercase text-zinc-500">
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
                <tr key={introCase.id} className="align-top hover:bg-[#fff7fa]">
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
                        <summary className="cursor-pointer text-xs font-bold text-[#e63a68]">수정</summary>
                        <form action={updateIntroCaseAction} className="absolute right-0 z-20 mt-3 grid w-72 gap-3 rounded-[24px] border border-[#f1f5f9] bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.14)]">
                          <FormPendingFieldset className="grid gap-3">
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
                            <FormSubmitButton label="저장" pendingLabel="저장 중..." className={adminPrimaryButtonClassName} />
                          </FormPendingFieldset>
                        </form>
                        <form action={deleteIntroCaseAction} className="mt-2">
                          <FormPendingFieldset className="contents">
                            <input type="hidden" name="id" value={introCase.id} />
                            <FormSubmitButton
                              label="삭제"
                              pendingLabel="삭제 중..."
                              className="text-xs font-bold text-zinc-500 hover:text-[#e63a68] disabled:text-zinc-300"
                            />
                          </FormPendingFieldset>
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
    </AdminTableSection>
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
            <label key={role} className="inline-flex items-center gap-2 rounded-2xl bg-[#f4f5f8] px-3 py-2 text-xs text-zinc-700">
              <input type="checkbox" name="roles" value={role} defaultChecked={user ? user.roles.includes(role) : role === "PARTICIPANT"} />
              {role}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
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
    <span className="inline-flex rounded-full border border-[#ffd5df] bg-[#fff1f5] px-2.5 py-1 text-xs font-bold text-[#e63a68]">
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
  if (selectedUser.status !== "READY") return [];

  const activeUserIds = new Set(
    introCases
      .filter((introCase) => activeIntroStatuses.includes(introCase.status))
      .flatMap((introCase) => introCase.participantIds),
  );
  const previouslyMatchedUserIds = new Set(
    introCases
      .filter((introCase) => participantIdsInclude(introCase.participantIds, selectedUser.id))
      .flatMap((introCase) => introCase.participantIds)
      .filter((userId) => userId !== selectedUser.id),
  );

  return users
    .filter((user) => {
      if (user.id === selectedUser.id) return false;
      if (!isOppositeGender(selectedUser, user)) return false;
      if (user.status !== "READY") return false;
      if (previouslyMatchedUserIds.has(user.id)) return false;
      return !activeUserIds.has(user.id);
    })
    .sort((a, b) => recommendationScore(selectedUser, b) - recommendationScore(selectedUser, a));
}

function participantIdsInclude(participantIds: DashboardIntroCase["participantIds"], userId: number) {
  return participantIds.some((participantId) => participantId === userId);
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
  if (nextFilters.introStatus !== "ALL") params.set("introStatus", nextFilters.introStatus);
  if (nextFilters.gender !== "ALL") params.set("gender", nextFilters.gender);
  if (nextFilters.ageMin) params.set("ageMin", nextFilters.ageMin);
  if (nextFilters.ageMax) params.set("ageMax", nextFilters.ageMax);
  if (nextFilters.heightMin) params.set("heightMin", nextFilters.heightMin);
  if (nextFilters.heightMax) params.set("heightMax", nextFilters.heightMax);
  if (nextFilters.sort !== "updated_desc") params.set("sort", nextFilters.sort);

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

const inputClassName = adminInputClassName;
const primaryButtonClassName = adminPrimaryButtonClassName;
