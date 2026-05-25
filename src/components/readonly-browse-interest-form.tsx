"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  submitReadOnlyBrowseInterestsWithStateAction,
  type SubmitReadOnlyBrowseInterestsActionState,
} from "@/app/readonly-actions";
import { FormPendingFieldset } from "@/components/form-pending-fieldset";
import { FormSubmitButton } from "@/components/form-submit-button";
import { ParticipantPhotoGallery } from "@/components/participant-photo-gallery";
import { formatBirthYearLabel } from "@/lib/birth-year-label";
import type { ParticipantInterestSelection } from "@/lib/domain";
import type { ReadOnlyBrowseCandidate } from "@/lib/readonly-browse-repository";

type ReadOnlyBrowseInterestFormProps = {
  browseCandidates: ReadOnlyBrowseCandidate[];
  browseLimit: number;
  browseSelections: ParticipantInterestSelection[];
  browseSubmitted: boolean;
  canSubmitInterests: boolean;
  databaseConnected: boolean;
  userId: number;
};

const initialState: SubmitReadOnlyBrowseInterestsActionState = {
  error: null,
  success: null,
};

export function ReadOnlyBrowseInterestForm({
  browseCandidates,
  browseLimit,
  browseSelections,
  browseSubmitted,
  canSubmitInterests,
  databaseConnected,
  userId,
}: ReadOnlyBrowseInterestFormProps) {
  const [actionState, formAction] = useActionState(submitReadOnlyBrowseInterestsWithStateAction, initialState);
  const submittedSelectionIds = useMemo(() => browseSelections.map((selection) => selection.toUserId), [browseSelections]);
  const submittedSelectionKey = submittedSelectionIds.join(",");
  const [selectedIds, setSelectedIds] = useState<number[]>(submittedSelectionIds);

  useEffect(() => {
    setSelectedIds(submittedSelectionIds);
  }, [submittedSelectionIds, submittedSelectionKey]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const canInteract = databaseConnected && canSubmitInterests && !browseSubmitted;
  const maxReached = selectedIds.length >= browseLimit;
  const summaryNames = browseSelections.map((selection) => selection.toUserName).join(", ");

  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-3 rounded-[28px] border border-[#ece7e4] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div>
          <h2 className="text-[1.45rem] font-semibold tracking-[-0.03em] text-zinc-950">이성 프로필</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            마음에 드는 사람을 최대 {browseLimit}명까지 선택해 제출해 주세요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full bg-[#fff6ef] px-3 py-1.5 text-xs font-semibold text-[#c96a2b]">
            {browseSubmitted ? "제출 완료" : `${selectedIds.length} / ${browseLimit} 선택`}
          </span>
          <span className="inline-flex items-center rounded-full bg-[#f4f4f5] px-3 py-1.5 text-xs font-semibold text-zinc-600">
            {browseCandidates.length}명 열람 가능
          </span>
        </div>
      </div>

      {summaryNames ? (
        <div className="rounded-[24px] border border-[#f5e2d3] bg-[#fffaf5] px-4 py-3 text-sm text-zinc-700">
          <p className="font-semibold text-[#b86a2d]">제출한 관심</p>
          <p className="mt-1">{summaryNames}</p>
        </div>
      ) : null}

      {actionState.error ? (
        <p className="rounded-[24px] border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-[#b10606]">
          {actionState.error}
        </p>
      ) : null}
      {actionState.success && !summaryNames ? (
        <p className="rounded-[24px] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {actionState.success}
        </p>
      ) : null}

      <form action={formAction} className="grid gap-4">
        <FormPendingFieldset className="grid gap-4">
          <input type="hidden" name="userId" value={userId} />
          {browseCandidates.length === 0 ? (
            <p className="rounded-[28px] border border-[#ece7e4] bg-white p-6 text-sm leading-6 text-zinc-500 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              {browseSubmitted
                ? "관심 선택이 저장되었습니다."
                : canSubmitInterests
                  ? "지금 보여드릴 수 있는 이성 프로필이 없습니다."
                  : "현재는 관심 제출이 열려 있지 않습니다."}
            </p>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {browseCandidates.map((candidate) => {
                const checked = selectedIdSet.has(candidate.id);
                const disableCheckbox = !canInteract || (!checked && maxReached);

                return (
                  <label
                    key={candidate.id}
                    className={`grid gap-4 rounded-[28px] border p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)] transition sm:grid-cols-[148px_minmax(0,1fr)] sm:p-5 ${
                      checked
                        ? "border-[#f1b07c] bg-[#fffaf5]"
                        : "border-[#ece7e4] bg-white hover:border-[#f3d8c1]"
                    }`}
                  >
                    <div className="self-start overflow-hidden rounded-[22px] border border-[#ede7df] bg-[#f6f3ef]">
                      <div className="relative aspect-[3/4] w-full min-w-[148px]">
                        <ParticipantPhotoGallery
                          name={candidate.name}
                          photos={candidate.photos}
                          fallbackUrl={candidate.mainPhotoUrl}
                        />
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[1.35rem] font-semibold tracking-[-0.03em] text-zinc-950">
                            {candidate.name}
                          </p>
                          <p className="mt-1 text-sm text-zinc-500">
                            {formatAge(candidate)} · {candidate.heightCm > 0 ? `${candidate.heightCm}cm` : "키 비공개"}
                          </p>
                          <p className="mt-1 text-sm font-medium text-zinc-700">
                            {candidate.jobTitle}
                            {candidate.companyName ? ` · ${candidate.companyName}` : ""}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          {checked ? (
                            <span className="inline-flex items-center rounded-full bg-[#fff1e6] px-3 py-1 text-xs font-semibold text-[#c96a2b]">
                              선택됨
                            </span>
                          ) : null}
                          <input
                            type="checkbox"
                            name="targetUserId"
                            value={candidate.id}
                            checked={checked}
                            disabled={disableCheckbox}
                            onChange={(event) => {
                              const isChecked = event.target.checked;
                              setSelectedIds((previous) => {
                                if (!isChecked) return previous.filter((value) => value !== candidate.id);
                                if (previous.includes(candidate.id) || previous.length >= browseLimit) return previous;
                                return [...previous, candidate.id];
                              });
                            }}
                            className="mt-1 h-5 w-5 shrink-0 accent-[#d97a32]"
                          />
                        </div>
                      </div>

                      {candidate.selfIntro ? (
                        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{candidate.selfIntro}</p>
                      ) : (
                        <p className="mt-4 text-sm text-zinc-400">자기소개가 아직 준비되지 않았습니다.</p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-zinc-500">
              선택은 최대 {browseLimit}명까지 저장됩니다. 제출이 끝나면 바로 다시 수정할 수 없습니다.
            </p>
            <FormSubmitButton
              label="선택 제출"
              pendingLabel="저장 중..."
              disabled={!canInteract || browseCandidates.length === 0 || selectedIds.length === 0}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#da7a37,#ee9b55)] px-5 text-sm font-semibold text-white shadow-[0_18px_35px_rgba(217,122,50,0.24)] disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none"
            />
          </div>
        </FormPendingFieldset>
      </form>
    </section>
  );
}

function formatAge(candidate: ReadOnlyBrowseCandidate) {
  return formatBirthYearLabel(candidate);
}
