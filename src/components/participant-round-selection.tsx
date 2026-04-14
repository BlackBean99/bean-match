import { createParticipantRoundSelectionsAction } from "@/app/round-actions";
import { openLevelLabels, type ParticipantRoundData } from "@/lib/domain";

type ParticipantRoundSelectionProps = ParticipantRoundData;

export function ParticipantRoundSelection({
  actor,
  round,
  candidates,
  selectedCount,
  selectionLimit,
  isTestMode,
  databaseConnected,
  loadError,
}: ParticipantRoundSelectionProps) {
  const remainingSelectionCount = Math.max(selectionLimit - selectedCount, 0);
  const canSubmit =
    databaseConnected &&
    round?.status === "OPEN" &&
    actor?.status === "READY" &&
    actor.openLevel === "FULL_OPEN" &&
    !isTestMode &&
    remainingSelectionCount > 0;

  return (
    <main className="min-h-screen bg-white px-5 py-8 text-zinc-950">
      <section className="mx-auto grid w-full max-w-5xl gap-6">
        <header className="rounded-lg border border-red-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-[#E00E0E]">Blackbean Match Round</p>
          <h1 className="mt-2 text-3xl font-bold text-zinc-950">{round?.title ?? "라운드 선택"}</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            FULL_OPEN 라운드 참여자는 이 링크에서 후보를 확인하고 최대 2명까지 선택합니다. 선택 후 변경은 운영자 확인
            전까지 직접 수정할 수 없습니다.
          </p>
          {isTestMode ? (
            <p className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-[#E00E0E]">
              관리자 테스트 모드입니다. 후보 노출과 화면 동작만 확인하며 선택 데이터는 저장하지 않습니다.
            </p>
          ) : null}
          {loadError ? <p className="mt-3 text-xs font-semibold text-red-700">{loadError}</p> : null}
        </header>

        <section className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm md:grid-cols-3">
          <Metric label="내 상태" value={actor ? `${actor.name} · ${actor.status}` : "사용자 없음"} />
          <Metric label="오픈 레벨" value={actor ? openLevelLabels[actor.openLevel] : "-"} />
          <Metric label="남은 선택" value={`${remainingSelectionCount}/${selectionLimit}`} />
        </section>

        <form action={createParticipantRoundSelectionsAction} className="grid gap-4">
          <input type="hidden" name="roundId" value={round?.id ?? ""} />
          <input type="hidden" name="fromUserId" value={actor?.id ?? ""} />
          <div className="grid gap-4 md:grid-cols-2">
            {candidates.length === 0 ? (
              <p className="rounded-lg border border-zinc-200 p-5 text-sm text-zinc-500">현재 노출 가능한 후보가 없습니다.</p>
            ) : (
              candidates.map((candidate) => (
                <label
                  key={candidate.id}
                  className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm has-[:checked]:border-[#FF3131] has-[:checked]:bg-red-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold text-zinc-950">{candidate.name}</p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {candidate.gender} · {candidate.age || candidate.ageText || "나이 미입력"} ·{" "}
                        {candidate.heightCm || "-"}cm · {candidate.jobTitle || "직업 미입력"}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      name="toUserId"
                      value={candidate.id}
                      defaultChecked={candidate.alreadySelected}
                      disabled={candidate.alreadySelected || isTestMode || !canSubmit}
                      className="mt-1 h-5 w-5 accent-[#FF3131]"
                    />
                  </div>
                  {candidate.selfIntro ? <p className="text-sm leading-6 text-zinc-700">{candidate.selfIntro}</p> : null}
                  {candidate.idealTypeDescription ? (
                    <p className="rounded-lg bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-600">
                      이상형: {candidate.idealTypeDescription}
                    </p>
                  ) : null}
                  {candidate.alreadySelected ? (
                    <p className="text-xs font-semibold text-[#E00E0E]">이미 선택한 후보입니다.</p>
                  ) : null}
                </label>
              ))
            )}
          </div>
          <button
            disabled={!canSubmit}
            className="w-fit rounded-lg bg-[#FF3131] px-5 py-3 text-sm font-bold text-white hover:bg-[#E00E0E] disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {isTestMode ? "테스트 모드 - 저장 안 함" : "선택 저장"}
          </button>
        </form>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
      <p className="text-xs font-semibold text-zinc-500">{label}</p>
      <p className="mt-1 font-bold text-zinc-950">{value}</p>
    </div>
  );
}
