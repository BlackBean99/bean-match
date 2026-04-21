import Link from "next/link";
import type { ReactNode } from "react";
import {
  CopyLinkButton,
} from "@/components/copy-link-button";
import { FormPendingFieldset } from "@/components/form-pending-fieldset";
import { FormSubmitButton } from "@/components/form-submit-button";
import {
  createRoundAction,
  createRoundSelectionAction,
  updateRoundStatusAction,
} from "@/app/round-actions";
import {
  entryQueueStatusLabels,
  openLevelLabels,
  roundStatusLabels,
  type DashboardEntryQueueItem,
  type DashboardRound,
  type DashboardRoundSelection,
  type DashboardUser,
  type RoundStatus,
} from "@/lib/domain";

type RoundDashboardProps = {
  users: DashboardUser[];
  candidates: DashboardUser[];
  rounds: DashboardRound[];
  selections: DashboardRoundSelection[];
  entryQueue: DashboardEntryQueueItem[];
  databaseConnected: boolean;
  loadError: string | null;
};

const roundStatusOptions: RoundStatus[] = ["DRAFT", "OPEN", "CLOSED", "MATCHING", "COMPLETED"];

export function RoundDashboard({
  users,
  candidates,
  rounds,
  selections,
  entryQueue,
  databaseConnected,
  loadError,
}: RoundDashboardProps) {
  const activeRound = rounds.find((round) => round.status === "OPEN") ?? rounds[0] ?? null;

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-red-100 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-sm font-bold text-[#E00E0E]">Round based matching</p>
            <h2 className="mt-2 text-2xl font-bold text-zinc-950">노출은 설계하고, 선택은 제한하고, 연결은 통제합니다.</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              READY + FULL_OPEN 사용자만 라운드 후보로 노출됩니다. PROGRESSING 사용자는 후보에서 제외됩니다.
            </p>
            {loadError ? <p className="mt-3 text-xs font-semibold text-red-700">{loadError}</p> : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="라운드 후보" value={candidates.length} />
            <Metric label="엔트리 큐" value={entryQueue.length} />
            <Metric label="선택 기록" value={selections.length} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <CreateRoundPanel disabled={!databaseConnected} />
        <RoundList rounds={rounds} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SelectionPanel activeRound={activeRound} users={users} candidates={candidates} disabled={!databaseConnected} />
        <SelectionTable selections={selections} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <CandidateTable candidates={candidates} activeRound={activeRound} />
        <EntryQueueTable items={entryQueue} />
      </section>
    </div>
  );
}

function CreateRoundPanel({ disabled }: { disabled: boolean }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold text-zinc-950">라운드 생성</h2>
      <form action={createRoundAction} className="mt-4 grid gap-3">
        <FormPendingFieldset className="grid gap-3">
          <Field label="라운드 이름">
            <input name="title" defaultValue={defaultRoundTitle()} className={inputClassName} required />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="시작">
              <input name="startAt" type="datetime-local" className={inputClassName} required />
            </Field>
            <Field label="종료">
              <input name="endAt" type="datetime-local" className={inputClassName} required />
            </Field>
          </div>
          <Field label="상태">
            <select name="status" defaultValue="DRAFT" className={inputClassName}>
              {roundStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {roundStatusLabels[status]}
                </option>
              ))}
            </select>
          </Field>
          <FormSubmitButton label="라운드 만들기" pendingLabel="생성 중..." disabled={disabled} className={primaryButtonClassName} />
        </FormPendingFieldset>
      </form>
    </section>
  );
}

function RoundList({ rounds }: { rounds: DashboardRound[] }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold text-zinc-950">라운드 운영</h2>
      <div className="mt-4 grid gap-3">
        {rounds.length === 0 ? (
          <p className="rounded-lg border border-zinc-200 p-4 text-sm text-zinc-500">아직 생성된 라운드가 없습니다.</p>
        ) : (
          rounds.map((round) => (
            <article key={round.id} className="rounded-lg border border-zinc-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-zinc-950">{round.title}</h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    {round.startAt} - {round.endAt} · 선택 제한 {round.selectionLimit}명
                  </p>
                </div>
                <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-[#E00E0E]">
                  {roundStatusLabels[round.status]}
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-zinc-600 sm:grid-cols-3">
                <p>후보 {round.participantCount}명</p>
                <p>선택 {round.selectionCount}건</p>
                <p>상호 선택 {round.mutualCount}쌍</p>
              </div>
              <div className="mt-3 grid gap-2 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600">
                <Link className="font-bold text-[#E00E0E]" href={`/rounds/${round.id}/test`}>
                  관리자 테스트 참여 URL
                </Link>
                <p>참가 링크는 아래 후보별 복사 버튼으로 바로 전달할 수 있습니다.</p>
              </div>
              <form action={updateRoundStatusAction} className="mt-3 flex flex-wrap gap-2">
                <FormPendingFieldset className="flex flex-wrap gap-2">
                  <input type="hidden" name="roundId" value={round.id} />
                  <select name="status" defaultValue={round.status} className={smallInputClassName}>
                    {roundStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {roundStatusLabels[status]}
                      </option>
                    ))}
                  </select>
                  <FormSubmitButton
                    label="상태 변경"
                    pendingLabel="변경 중..."
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-bold text-zinc-700 disabled:text-zinc-300"
                  />
                </FormPendingFieldset>
              </form>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function SelectionPanel({
  activeRound,
  users,
  candidates,
  disabled,
}: {
  activeRound: DashboardRound | null;
  users: DashboardUser[];
  candidates: DashboardUser[];
  disabled: boolean;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold text-zinc-950">선택 기록 입력</h2>
      <p className="mt-1 text-sm text-zinc-500">한 사용자는 한 라운드에서 최대 2명만 선택할 수 있고 변경할 수 없습니다.</p>
      <form action={createRoundSelectionAction} className="mt-4 grid gap-3">
        <FormPendingFieldset className="grid gap-3">
          <Field label="라운드">
            <select name="roundId" defaultValue={activeRound?.id ?? ""} className={inputClassName} required>
              {activeRound ? null : <option value="">라운드를 먼저 생성하세요</option>}
              {activeRound ? <option value={activeRound.id}>{activeRound.title}</option> : null}
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="선택한 사용자">
              <select name="fromUserId" className={inputClassName} required>
                <option value="">선택</option>
                {candidates.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} · {openLevelLabels[user.openLevel]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="선택된 후보">
              <select name="toUserId" className={inputClassName} required>
                <option value="">선택</option>
                {users
                  .filter((user) => user.status === "READY")
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} · {user.gender}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
          <FormSubmitButton label="선택 저장" pendingLabel="저장 중..." disabled={disabled || !activeRound} className={primaryButtonClassName} />
        </FormPendingFieldset>
      </form>
    </section>
  );
}

function SelectionTable({ selections }: { selections: DashboardRoundSelection[] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-4 py-3">
        <h2 className="text-lg font-bold text-zinc-950">선택 데이터</h2>
      </div>
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-500">
            <tr>
              <th className="px-3 py-3">Round</th>
              <th className="px-3 py-3">From</th>
              <th className="px-3 py-3">To</th>
              <th className="px-3 py-3">결과</th>
              <th className="px-3 py-3">시각</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {selections.map((selection) => (
              <tr key={selection.id}>
                <td className="px-3 py-3">{selection.roundId}</td>
                <td className="px-3 py-3 font-semibold">{selection.fromUserName}</td>
                <td className="px-3 py-3">{selection.toUserName}</td>
                <td className="px-3 py-3">{selection.isMutual ? "상호 선택" : "운영자 판단"}</td>
                <td className="px-3 py-3 text-zinc-500">{selection.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CandidateTable({ candidates, activeRound }: { candidates: DashboardUser[]; activeRound: DashboardRound | null }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold text-zinc-950">현재 노출 후보</h2>
      <div className="mt-3 grid gap-2">
        {candidates.map((user) => (
          <div key={user.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-100 px-3 py-2">
            <div>
              <p className="text-sm font-bold text-zinc-950">{user.name}</p>
              <p className="text-xs text-zinc-500">
                {user.gender} · {user.age || user.ageText || "나이 미입력"} · {user.heightCm || "-"}cm
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-[#E00E0E]">
                {openLevelLabels[user.openLevel]}
              </span>
              {activeRound ? (
                <CopyLinkButton
                  url={`${process.env.AUTH_URL || "http://localhost:3000"}/rounds/${activeRound.id}/participants/${user.id}`}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-bold text-zinc-700 hover:border-red-200 hover:text-[#E00E0E]"
                />
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function EntryQueueTable({ items }: { items: DashboardEntryQueueItem[] }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold text-zinc-950">Entry Queue</h2>
      <div className="mt-3 grid gap-2">
        {items.length === 0 ? (
          <p className="text-sm text-zinc-500">대기 중인 신규 사용자가 없습니다.</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-lg border border-zinc-100 px-3 py-2">
              <p className="text-sm font-bold text-zinc-950">{item.userName}</p>
              <p className="mt-1 text-[11px] font-semibold text-zinc-500">UserId {item.userId}</p>
              <p className="text-xs text-zinc-500">
                {entryQueueStatusLabels[item.status]} · {item.joinedAt}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3">
      <p className="text-xs font-semibold text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#E00E0E]">{value}</p>
    </div>
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

function defaultRoundTitle() {
  return `${new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" }).format(new Date())} 라운드`;
}

const inputClassName =
  "w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-[#FF3131] focus:ring-2 focus:ring-red-100";

const smallInputClassName =
  "min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-950 outline-none focus:border-[#FF3131] focus:ring-2 focus:ring-red-100";

const primaryButtonClassName =
  "rounded-lg bg-[#FF3131] px-4 py-2 text-sm font-bold text-white hover:bg-[#E00E0E] disabled:cursor-not-allowed disabled:opacity-50";
