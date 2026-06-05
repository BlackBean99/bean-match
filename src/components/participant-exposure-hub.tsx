import { createBroadcastInterestAction, submitBrowseInterestsAction } from "@/app/exposure-actions";
import { FormPendingFieldset } from "@/components/form-pending-fieldset";
import { ParticipantPhotoGallery } from "@/components/participant-photo-gallery";
import { FormSubmitButton } from "@/components/form-submit-button";
import { formatBirthYearLabel } from "@/lib/birth-year-label";
import type { ParticipantExposureData } from "@/lib/domain";

type ParticipantExposureHubProps = ParticipantExposureData;

export function ParticipantExposureHub({
  actor,
  browseCandidates,
  browseSelections,
  newMemberNotifications,
  browseLimit,
  existingMemberInterestLimit,
  browseSubmitted,
  canBrowse,
  databaseConnected,
  loadError,
}: ParticipantExposureHubProps) {
  const actorRoleLabel = actor?.genderCode === "MALE" ? "여성 회원" : actor?.genderCode === "FEMALE" ? "남성 회원" : "상대 회원";

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-5 text-zinc-950 sm:px-5 sm:py-8">
      <section className="mx-auto grid w-full max-w-6xl gap-4 sm:gap-6">
        <header className="rounded-lg border border-red-100 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#E00E0E]">Blackbean Match</p>
          <h1 className="mt-2 text-2xl font-bold text-zinc-950 sm:text-3xl">자동 노출 풀</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            새로운 멤버가 들어오면 조용히 기회를 만들고, 상호 관심이 생긴 경우에만 운영자가 소개를 시작합니다.
          </p>
          {actor ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <Metric label="참여자" value={actor.name} />
              <Metric label="상태" value={`${actor.gender} · ${formatAge(actor)}`} />
              <Metric label="내 노출" value={actor.openLevel} />
              <Metric label="신규 알림" value={`${newMemberNotifications.length}건`} />
            </div>
          ) : null}
          {loadError ? <p className="mt-3 text-xs font-semibold text-red-700">{loadError}</p> : null}
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-zinc-950">새로 들어온 나의 탐색 카드</h2>
                <p className="mt-1 text-sm leading-6 text-zinc-500">
                  자동 노출에 동의한 {actorRoleLabel} 중에서 최대 {browseLimit}명까지 관심 표시를 남길 수 있습니다.
                </p>
              </div>
              <span className="rounded-full bg-[#fff1f5] px-3 py-1 text-xs font-bold text-[#e63a68]">
                {browseSubmitted ? "제출 완료" : `최대 ${browseLimit}명`}
              </span>
            </div>

            {browseSelections.length > 0 ? (
              <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-zinc-700">
                <p className="font-semibold text-[#E00E0E]">이미 제출한 관심</p>
                <p className="mt-1">{browseSelections.map((selection) => selection.toUserName).join(", ")}</p>
              </div>
            ) : null}

            <form action={submitBrowseInterestsAction} className="grid gap-4">
              <FormPendingFieldset className="grid gap-4">
                <input type="hidden" name="userId" value={actor?.id ?? ""} />
                <div className="grid gap-3 sm:grid-cols-2">
                  {browseCandidates.length === 0 ? (
                    <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-500">
                      {browseSubmitted
                        ? "탐색 제출이 이미 완료되었습니다."
                        : canBrowse
                          ? "지금 바로 탐색할 수 있는 후보가 없습니다."
                          : "현재는 자동 노출 탐색 조건을 만족하지 않습니다."}
                    </p>
                  ) : (
                    browseCandidates.map((candidate) => (
                      <label
                        key={candidate.id}
                        className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm has-[:checked]:border-[#FF3131] has-[:checked]:bg-red-50/60"
                      >
                        <div className="grid gap-3 sm:grid-cols-[112px_minmax(0,1fr)]">
                          <div className="rounded-md border border-zinc-200 bg-zinc-100 p-2">
                            <div className="w-full">
                              <ParticipantPhotoGallery
                                name={candidate.name}
                                photos={candidate.photos}
                                fallbackUrl={candidate.mainPhotoUrl}
                              />
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-lg font-bold text-zinc-950">{candidate.name}</p>
                                <p className="mt-1 text-sm text-zinc-500">
                                  {formatAge(candidate)} · {candidate.heightCm > 0 ? `${candidate.heightCm}cm` : "키 비공개"}
                                </p>
                                <p className="mt-1 text-sm text-zinc-600">{candidate.jobTitle}</p>
                              </div>
                              <input
                                type="checkbox"
                                name="targetUserId"
                                value={candidate.id}
                                disabled={!databaseConnected || !canBrowse || browseSubmitted}
                                className="mt-1 h-5 w-5 shrink-0 accent-[#FF3131]"
                              />
                            </div>
                            {candidate.selfIntro ? (
                              <p className="mt-3 line-clamp-4 text-sm leading-6 text-zinc-700">{candidate.selfIntro}</p>
                            ) : null}
                            {candidate.idealTypeDescription ? (
                              <p className="mt-2 text-xs text-zinc-500">이상형 {candidate.idealTypeDescription}</p>
                            ) : null}
                            <p className="mt-3 text-xs font-semibold text-zinc-500">
                              수신 관심 {candidate.activeIncomingInterestCount}건 · 누적 노출 {candidate.exposureCount}회
                            </p>
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
                <FormSubmitButton
                  label="관심 제출"
                  pendingLabel="제출 중..."
                  disabled={!databaseConnected || !canBrowse || browseSubmitted || browseCandidates.length === 0}
                  className="w-full rounded-lg bg-[#FF3131] px-5 py-3 text-sm font-bold text-white hover:bg-[#E00E0E] disabled:cursor-not-allowed disabled:bg-zinc-300 sm:w-fit"
                />
              </FormPendingFieldset>
            </form>
          </section>

          <section className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <div>
              <h2 className="text-lg font-bold text-zinc-950">기존 회원에게 온 신규 멤버 알림</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-500">
                기존 회원은 새로 들어온 멤버마다 최대 {existingMemberInterestLimit}번 관심 표시를 남길 수 있습니다.
              </p>
            </div>
            {newMemberNotifications.length === 0 ? (
              <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-500">
                지금 확인할 신규 멤버 알림이 없습니다.
              </p>
            ) : (
              newMemberNotifications.map((notification) => (
                <article key={notification.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-zinc-950">{notification.title}</p>
                      <p className="mt-1 text-xs text-zinc-500">{notification.createdAt}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-600">
                      {notification.interestSent ? "관심 표시 완료" : "미응답"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{notification.body}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[96px_minmax(0,1fr)]">
                    <div className="rounded-md border border-zinc-200 bg-white p-2">
                      <div className="w-full">
                        <ParticipantPhotoGallery
                          name={notification.subject.name}
                          photos={notification.subject.photos}
                          fallbackUrl={notification.subject.mainPhotoUrl}
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-zinc-950">{notification.subject.name}</p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {formatAge(notification.subject)} · {notification.subject.heightCm > 0 ? `${notification.subject.heightCm}cm` : "키 비공개"}
                      </p>
                      <p className="mt-1 text-sm text-zinc-600">{notification.subject.jobTitle}</p>
                      {notification.subject.selfIntro ? (
                        <p className="mt-3 text-sm leading-6 text-zinc-700">{notification.subject.selfIntro}</p>
                      ) : null}
                      <form action={createBroadcastInterestAction} className="mt-4">
                        <FormPendingFieldset className="contents">
                          <input type="hidden" name="userId" value={actor?.id ?? ""} />
                          <input type="hidden" name="targetUserId" value={notification.subject.id} />
                          <FormSubmitButton
                            label={notification.interestSent ? "관심 표시 완료" : "관심 보내기"}
                            pendingLabel="전송 중..."
                            disabled={!databaseConnected || notification.interestSent}
                            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-bold text-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
                          />
                        </FormPendingFieldset>
                      </form>
                    </div>
                  </div>
                </article>
              ))
            )}
          </section>
        </section>
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

function formatAge(user: NonNullable<ParticipantExposureData["actor"]>) {
  return formatBirthYearLabel(user);
}
