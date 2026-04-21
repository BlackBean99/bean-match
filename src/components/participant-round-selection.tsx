import { createParticipantRoundPassAction, createParticipantRoundSelectionsAction } from "@/app/round-actions";
import { FormPendingFieldset } from "@/components/form-pending-fieldset";
import { ParticipantPhotoGallery } from "@/components/participant-photo-gallery";
import { FormSubmitButton } from "@/components/form-submit-button";
import { type ParticipantRoundData } from "@/lib/domain";

type ParticipantRoundSelectionProps = ParticipantRoundData;

export function ParticipantRoundSelection({
  actor,
  round,
  candidates,
  selectedCount,
  selectionLimit,
  hasPassed,
  passedAt,
  passReason,
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
    !hasPassed &&
    !isTestMode &&
    remainingSelectionCount > 0;
  const selectionRoleLabel = actor?.genderCode === "MALE" ? "소개팅녀" : actor?.genderCode === "FEMALE" ? "소개팅남" : "상대";
  const selectionRoleObjectLabel = actor?.genderCode === "MALE" ? "소개팅녀를" : actor?.genderCode === "FEMALE" ? "소개팅남을" : "상대를";
  const heading = isTestMode ? "테스트 라운드 미리보기" : `${selectionRoleLabel} 선택`;
  const candidateGuide =
    loadError
      ? "현재 라운드 참여 조건을 먼저 확인해 주세요."
      : hasPassed
      ? "이번 라운드는 선택 안 함으로 접수되었습니다."
      : candidates.length > 0
      ? `지금 보이는 ${candidates.length}명 중 최대 ${selectionLimit}명까지 선택할 수 있습니다.`
      : `지금 선택 가능한 ${selectionRoleLabel}이 없습니다.`;

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-5 text-zinc-950 sm:px-5 sm:py-8">
      <section className="mx-auto grid w-full max-w-4xl gap-4 sm:gap-6">
        <header className="rounded-lg border border-red-100 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#E00E0E]">Blackbean Match</p>
          <h1 className="mt-2 text-2xl font-bold text-zinc-950 sm:text-3xl">{heading}</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            {actor ? `${actor.name}님, 마음에 드는 ${selectionRoleObjectLabel} 최대 ${selectionLimit}명까지 선택해 주세요.` : `마음에 드는 ${selectionRoleObjectLabel} 최대 ${selectionLimit}명까지 선택해 주세요.`}
          </p>
          <p className="mt-1 text-sm leading-6 text-zinc-500">{candidateGuide}</p>
          <p className="mt-1 text-sm leading-6 text-zinc-500">선택은 한 번 제출하면 직접 바꿀 수 없습니다.</p>
          {hasPassed ? (
            <p className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-700">
              선택 안 함 접수 완료{passedAt ? ` · ${passedAt}` : ""}
              {passReason ? ` · ${passReason}` : ""}
            </p>
          ) : null}
          {isTestMode ? (
            <p className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-[#E00E0E]">
              관리자 테스트 모드입니다. 후보 노출과 화면 동작만 확인하며 선택 데이터는 저장하지 않습니다.
            </p>
          ) : null}
          {loadError ? <p className="mt-3 text-xs font-semibold text-red-700">{loadError}</p> : null}
        </header>

        <section className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-3">
          <Metric label="접속한 사람" value={actor ? actor.name : "사용자 없음"} />
          <Metric label="내 정보" value={actor ? `${actor.gender} · ${formatAge(actor)} · ${actor.jobTitle}` : "-"} />
          <Metric label="선택 가능" value={`${remainingSelectionCount}/${selectionLimit}`} />
        </section>

        <form action={createParticipantRoundSelectionsAction} className="grid gap-4">
          <FormPendingFieldset className="grid gap-4">
            <input type="hidden" name="roundId" value={round?.id ?? ""} />
            <input type="hidden" name="fromUserId" value={actor?.id ?? ""} />
            <div className="grid gap-3 sm:grid-cols-2">
              {candidates.length === 0 ? (
                <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-500">
                  {loadError ? "현재 선택을 진행할 수 없습니다. 상단 안내를 확인해 주세요." : "지금 선택할 수 있는 후보가 없습니다."}
                </p>
              ) : (
                candidates.map((candidate) => (
                  <label
                    key={candidate.id}
                    className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm has-[:checked]:border-[#FF3131] has-[:checked]:bg-red-50/60 sm:p-4"
                  >
                    <div className="grid gap-3 sm:grid-cols-[116px_minmax(0,1fr)]">
                      <div className="overflow-hidden rounded-md border border-zinc-200 bg-zinc-100">
                        <div className="relative aspect-[3/4]">
                          <ParticipantPhotoGallery
                            name={candidate.name}
                            photos={candidate.photos}
                            fallbackUrl={candidate.mainPhotoUrl}
                          />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="break-words text-lg font-bold text-zinc-950">{candidate.name}</p>
                            <p className="mt-1 text-sm text-zinc-500">
                              {formatAge(candidate)} · {candidate.heightCm > 0 ? `${candidate.heightCm}cm` : "키 비공개"}
                            </p>
                            <p className="mt-1 line-clamp-2 break-all pr-2 text-sm leading-5 text-zinc-600">
                              {candidate.jobTitle || "직업 미입력"}
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            name="toUserId"
                            value={candidate.id}
                            defaultChecked={candidate.alreadySelected}
                            disabled={candidate.alreadySelected || isTestMode || !canSubmit}
                            className="mt-1 h-5 w-5 shrink-0 accent-[#FF3131]"
                          />
                        </div>
                        {candidate.selfIntro ? (
                          <p className="mt-3 line-clamp-4 text-sm leading-6 text-zinc-700">{candidate.selfIntro}</p>
                        ) : null}
                        {candidate.alreadySelected ? (
                          <p className="mt-3 text-xs font-semibold text-[#E00E0E]">이미 선택 완료</p>
                        ) : null}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
            <FormSubmitButton
              label={isTestMode ? "테스트 모드 - 저장 안 함" : `${selectionRoleLabel} 선택 저장`}
              pendingLabel={isTestMode ? "테스트 처리 중..." : "선택 저장 중..."}
              disabled={!canSubmit}
              className="w-full rounded-lg bg-[#FF3131] px-5 py-3 text-sm font-bold text-white hover:bg-[#E00E0E] disabled:cursor-not-allowed disabled:bg-zinc-300 sm:w-fit"
            />
          </FormPendingFieldset>
        </form>

        {!isTestMode && actor && round?.status === "OPEN" && actor.status === "READY" && actor.openLevel === "FULL_OPEN" ? (
          <form action={createParticipantRoundPassAction} className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <FormPendingFieldset className="grid gap-3">
              <input type="hidden" name="roundId" value={round.id} />
              <input type="hidden" name="fromUserId" value={actor.id} />
              <div>
                <p className="text-sm font-bold text-zinc-950">이번 라운드는 선택 안 할게요</p>
                <p className="mt-1 text-sm leading-6 text-zinc-500">
                  이번 라운드에서 고를 사람이 없다면 선택 안 함으로 남길 수 있습니다.
                </p>
              </div>
              <textarea
                name="passReason"
                rows={2}
                placeholder="선택하지 않는 이유를 짧게 남길 수 있어요. (선택)"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-[#FF3131] focus:ring-2 focus:ring-red-100"
                disabled={hasPassed || selectedCount > 0}
              />
              <FormSubmitButton
                label={hasPassed ? "선택 안 함 접수 완료" : "선택 안 함으로 제출"}
                pendingLabel="제출 중..."
                disabled={hasPassed || selectedCount > 0}
                className="w-full rounded-lg border border-zinc-300 px-5 py-3 text-sm font-bold text-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 sm:w-fit"
              />
            </FormPendingFieldset>
          </form>
        ) : null}
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

function formatAge(user: NonNullable<ParticipantRoundData["actor"]>) {
  if (user.age > 0 && user.ageText) return `${user.age}세`;
  if (user.age > 0) return `${user.age}세`;
  if (user.ageText) return user.ageText;
  return "나이 비공개";
}
