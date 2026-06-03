import type { ReactNode } from "react";
import {
  approveIntroCandidateAction,
  convertIntroCandidateAction,
  createManualIntroCandidateAction,
  expireStaleInterestsAction,
  rejectIntroCandidateAction,
  updateAutoExposureSettingsAction,
} from "@/app/exposure-actions";
import {
  AdminMutedSection,
  AdminSection,
  AdminStatCard,
  AdminTableSection,
  adminInputClassName,
  adminPrimaryButtonClassName,
  adminSmallInputClassName,
} from "@/components/admin-ui";
import { FormPendingFieldset } from "@/components/form-pending-fieldset";
import { FormSubmitButton } from "@/components/form-submit-button";
import {
  introCandidateSourceLabels,
  introCandidateStatusLabels,
  interestSourceLabels,
  interestStatusLabels,
  openLevelLabels,
  type DashboardExposureData,
  type DashboardUser,
} from "@/lib/domain";

type ExposureDashboardProps = DashboardExposureData & {
  canManage?: boolean;
};

export function ExposureDashboard({
  users,
  queue,
  interests,
  introCandidates,
  highDemandUsers,
  noInterestUsers,
  lowExposureUsers,
  canManage = false,
  databaseConnected,
  loadError,
}: ExposureDashboardProps) {
  const activeInterestCount = interests.filter((interest) => interest.status === "ACTIVE").length;
  const pendingCandidateCount = introCandidates.filter((candidate) => candidate.status === "PENDING_ADMIN_REVIEW").length;
  const eligibleUsers = users.filter((user) => user.status === "READY");

  return (
    <div className="grid gap-6">
      <AdminMutedSection className="p-5 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-sm font-bold text-[#e63a68]">Auto exposure & interest</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-zinc-950">
              라운드를 열지 않아도 조용히 기회가 쌓이는 운영 흐름
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              READY 상태 진입 시 자동 노출과 신규 멤버 알림을 발생시키고, 상호 관심은 운영자 검토 후보로만 승격합니다.
            </p>
            {loadError ? <p className="mt-3 text-xs font-semibold text-red-700">{loadError}</p> : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <AdminStatCard label="자동 노출 큐" value={queue.length} />
            <AdminStatCard label="활성 관심" value={activeInterestCount} tone="amber" />
            <AdminStatCard label="검토 후보" value={pendingCandidateCount} tone="blue" />
            <AdminStatCard label="과열 사용자" value={highDemandUsers.length} tone="green" />
          </div>
        </div>
      </AdminMutedSection>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <QueuePanel queue={queue} users={users} disabled={!databaseConnected || !canManage} />
        <AdminSection className="grid gap-6 p-5">
          <ManualCandidatePanel users={eligibleUsers} disabled={!databaseConnected || !canManage} />
          <ExpireInterestPanel disabled={!databaseConnected || !canManage} />
          <SignalPanel title="과열 사용자" items={highDemandUsers} emptyMessage="과열 사용자 없음" />
          <SignalPanel title="무반응 사용자" items={noInterestUsers} emptyMessage="모든 사용자에 최소 한 번 이상 반응이 있습니다." />
          <SignalPanel title="저노출 사용자" items={lowExposureUsers} emptyMessage="노출이 낮은 사용자가 없습니다." />
        </AdminSection>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <InterestTable interests={interests} />
        <CandidateTable introCandidates={introCandidates} disabled={!databaseConnected || !canManage} />
      </section>
    </div>
  );
}

function QueuePanel({
  queue,
  users,
  disabled,
}: {
  queue: ExposureDashboardProps["queue"];
  users: DashboardUser[];
  disabled: boolean;
}) {
  return (
    <AdminTableSection>
      <div className="border-b border-[#f1f5f9] px-5 py-4">
        <h2 className="text-lg font-bold text-zinc-950">New Member Queue</h2>
        <p className="mt-1 text-sm text-zinc-500">최근 READY 진입 사용자와 현재 자동 노출 설정을 함께 관리합니다.</p>
      </div>
      <div className="max-h-[760px] overflow-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-[#fafafc] text-xs text-zinc-500">
            <tr>
              <th className="px-3 py-3">회원</th>
              <th className="px-3 py-3">READY 시각</th>
              <th className="px-3 py-3">관심 보냄</th>
              <th className="px-3 py-3">관심 받음</th>
              <th className="px-3 py-3">상호 관심</th>
              <th className="px-3 py-3">누적 노출</th>
              <th className="px-3 py-3">설정</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {queue.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-zinc-500" colSpan={7}>
                  자동 노출 큐 대상이 없습니다.
                </td>
              </tr>
            ) : (
              queue.map((item) => {
                const user = users.find((candidate) => candidate.id === item.userId);
                if (!user) return null;

                return (
                  <tr key={item.userId} className="align-top hover:bg-[#fff7fa]">
                    <td className="px-3 py-3">
                      <p className="font-semibold text-zinc-950">{item.userName}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {user.gender} · {openLevelLabels[user.openLevel]}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-zinc-600">{item.readyAt}</td>
                    <td className="px-3 py-3 text-zinc-700">{item.outgoingInterestCount}건</td>
                    <td className="px-3 py-3 text-zinc-700">{item.incomingInterestCount}건</td>
                    <td className="px-3 py-3 text-zinc-700">{item.mutualInterestCount}건</td>
                    <td className="px-3 py-3 text-zinc-700">{item.exposureCount}회</td>
                    <td className="px-3 py-3">
                      <form action={updateAutoExposureSettingsAction} className="grid gap-2">
                        <FormPendingFieldset className="grid gap-2">
                          <input type="hidden" name="userId" value={item.userId} />
                          <select name="openLevel" defaultValue={user.openLevel} className={adminSmallInputClassName}>
                            <option value="PRIVATE">운영자 검토만</option>
                            <option value="SEMI_OPEN">제한 자동 노출</option>
                            <option value="FULL_OPEN">전체 자동 노출</option>
                          </select>
                          <label className="inline-flex items-center gap-2 text-xs text-zinc-600">
                            <input type="checkbox" name="exposureConsent" defaultChecked={user.exposureConsent} />
                            노출 동의
                          </label>
                          <label className="inline-flex items-center gap-2 text-xs text-zinc-600">
                            <input
                              type="checkbox"
                              name="newMemberNotificationsEnabled"
                              defaultChecked={user.newMemberNotificationsEnabled}
                            />
                            신규 알림
                          </label>
                          <label className="inline-flex items-center gap-2 text-xs text-zinc-600">
                            <input type="checkbox" name="exposurePaused" defaultChecked={user.exposurePaused} />
                            일시중지
                          </label>
                          <FormSubmitButton
                            label="저장"
                            pendingLabel="저장 중..."
                            disabled={disabled}
                            className="rounded-2xl border border-zinc-300 px-3 py-2 text-xs font-bold text-zinc-700 disabled:text-zinc-300"
                          />
                        </FormPendingFieldset>
                      </form>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </AdminTableSection>
  );
}

function ManualCandidatePanel({
  users,
  disabled,
}: {
  users: DashboardUser[];
  disabled: boolean;
}) {
  return (
    <div>
      <h2 className="text-lg font-bold text-zinc-950">수동 후보 생성</h2>
      <p className="mt-1 text-sm text-zinc-500">운영자가 직접 소개 후보를 만들어 검토 큐에 넣을 수 있습니다.</p>
      <form action={createManualIntroCandidateAction} className="mt-4 grid gap-3">
        <FormPendingFieldset className="grid gap-3">
          <Field label="A 사용자">
            <UserSelect name="userAId" users={users} />
          </Field>
          <Field label="B 사용자">
            <UserSelect name="userBId" users={users} />
          </Field>
          <Field label="사유">
            <textarea
              name="reason"
              rows={3}
              placeholder="예: 운영자 확인 결과 취향/거주지/소개 맥락이 잘 맞음"
              className={adminInputClassName}
            />
          </Field>
          <FormSubmitButton
            label="후보 생성"
            pendingLabel="생성 중..."
            disabled={disabled || users.length < 2}
            className={adminPrimaryButtonClassName}
          />
        </FormPendingFieldset>
      </form>
    </div>
  );
}

function ExpireInterestPanel({ disabled }: { disabled: boolean }) {
  return (
    <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
      <h2 className="text-base font-bold text-zinc-950">관심 만료 처리</h2>
      <p className="mt-1 text-sm text-zinc-500">21일이 지난 활성 관심과 만료일이 지난 관심을 한 번에 정리합니다.</p>
      <form action={expireStaleInterestsAction} className="mt-3">
        <FormPendingFieldset className="contents">
          <FormSubmitButton
            label="오래된 관심 만료"
            pendingLabel="정리 중..."
            disabled={disabled}
            className="rounded-2xl border border-zinc-300 px-4 py-2 text-sm font-bold text-zinc-700 disabled:text-zinc-300"
          />
        </FormPendingFieldset>
      </form>
    </div>
  );
}

function SignalPanel({
  title,
  items,
  emptyMessage,
}: {
  title: string;
  items: ExposureDashboardProps["highDemandUsers"];
  emptyMessage: string;
}) {
  return (
    <div>
      <h2 className="text-base font-bold text-zinc-950">{title}</h2>
      <div className="mt-3 grid gap-2">
        {items.length === 0 ? (
          <p className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">{emptyMessage}</p>
        ) : (
          items.map((item) => (
            <div key={item.userId} className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <p className="font-semibold text-zinc-950">{item.userName}</p>
              <p className="mt-1 text-sm text-zinc-500">{item.detail}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function InterestTable({ interests }: { interests: ExposureDashboardProps["interests"] }) {
  return (
    <AdminTableSection>
      <div className="border-b border-[#f1f5f9] px-5 py-4">
        <h2 className="text-lg font-bold text-zinc-950">Interest Dashboard</h2>
      </div>
      <div className="max-h-[560px] overflow-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-[#fafafc] text-xs text-zinc-500">
            <tr>
              <th className="px-3 py-3">From</th>
              <th className="px-3 py-3">To</th>
              <th className="px-3 py-3">소스</th>
              <th className="px-3 py-3">상태</th>
              <th className="px-3 py-3">결과</th>
              <th className="px-3 py-3">시각</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {interests.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-zinc-500" colSpan={6}>
                  관심 데이터가 없습니다.
                </td>
              </tr>
            ) : (
              interests.map((interest) => (
                <tr key={interest.id} className="hover:bg-[#fff7fa]">
                  <td className="px-3 py-3 font-semibold text-zinc-950">{interest.fromUserName}</td>
                  <td className="px-3 py-3 text-zinc-700">{interest.toUserName}</td>
                  <td className="px-3 py-3 text-zinc-600">{interestSourceLabels[interest.source]}</td>
                  <td className="px-3 py-3 text-zinc-600">{interestStatusLabels[interest.status]}</td>
                  <td className="px-3 py-3 text-zinc-700">{interest.isMutual ? "상호 관심" : "편향 관심"}</td>
                  <td className="px-3 py-3 text-zinc-500">{interest.createdAt}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminTableSection>
  );
}

function CandidateTable({
  introCandidates,
  disabled,
}: {
  introCandidates: ExposureDashboardProps["introCandidates"];
  disabled: boolean;
}) {
  return (
    <AdminTableSection>
      <div className="border-b border-[#f1f5f9] px-5 py-4">
        <h2 className="text-lg font-bold text-zinc-950">Intro Candidates</h2>
      </div>
      <div className="max-h-[560px] overflow-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-[#fafafc] text-xs text-zinc-500">
            <tr>
              <th className="px-3 py-3">참여자</th>
              <th className="px-3 py-3">사유</th>
              <th className="px-3 py-3">소스</th>
              <th className="px-3 py-3">상태</th>
              <th className="px-3 py-3">생성</th>
              <th className="px-3 py-3">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {introCandidates.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-zinc-500" colSpan={6}>
                  운영 검토 후보가 없습니다.
                </td>
              </tr>
            ) : (
              introCandidates.map((candidate) => (
                <tr key={candidate.id} className="align-top hover:bg-[#fff7fa]">
                  <td className="px-3 py-3 font-semibold text-zinc-950">
                    {candidate.userAName} · {candidate.userBName}
                  </td>
                  <td className="px-3 py-3 text-zinc-600">{candidate.reason}</td>
                  <td className="px-3 py-3 text-zinc-600">{introCandidateSourceLabels[candidate.source]}</td>
                  <td className="px-3 py-3 text-zinc-600">{introCandidateStatusLabels[candidate.status]}</td>
                  <td className="px-3 py-3 text-zinc-500">{candidate.createdAt}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <CandidateActionForm
                        action={approveIntroCandidateAction}
                        candidateId={candidate.id}
                        label="승인"
                        pendingLabel="승인 중..."
                        disabled={disabled || candidate.status === "CONVERTED_TO_INTRO_CASE"}
                      />
                      <CandidateActionForm
                        action={rejectIntroCandidateAction}
                        candidateId={candidate.id}
                        label="반려"
                        pendingLabel="반려 중..."
                        disabled={disabled || candidate.status === "CONVERTED_TO_INTRO_CASE"}
                      />
                      <CandidateActionForm
                        action={convertIntroCandidateAction}
                        candidateId={candidate.id}
                        label="소개 생성"
                        pendingLabel="생성 중..."
                        disabled={disabled || candidate.status === "CONVERTED_TO_INTRO_CASE"}
                      />
                    </div>
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

function CandidateActionForm({
  action,
  candidateId,
  label,
  pendingLabel,
  disabled,
}: {
  action: (formData: FormData) => Promise<void>;
  candidateId: number;
  label: string;
  pendingLabel: string;
  disabled: boolean;
}) {
  return (
    <form action={action}>
      <FormPendingFieldset className="contents">
        <input type="hidden" name="candidateId" value={candidateId} />
        <FormSubmitButton
          label={label}
          pendingLabel={pendingLabel}
          disabled={disabled}
          className="rounded-2xl border border-zinc-300 px-3 py-2 text-xs font-bold text-zinc-700 disabled:text-zinc-300"
        />
      </FormPendingFieldset>
    </form>
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

function UserSelect({
  name,
  users,
}: {
  name: string;
  users: DashboardUser[];
}) {
  return (
    <select name={name} required className={adminInputClassName}>
      <option value="">선택</option>
      {users.map((user) => (
        <option key={user.id} value={user.id}>
          {user.name} · {user.gender} · {openLevelLabels[user.openLevel]}
        </option>
      ))}
    </select>
  );
}
