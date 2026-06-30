import { clearReadOnlyBrowseAccessAction } from "@/app/readonly-actions";
import { FormPendingFieldset } from "@/components/form-pending-fieldset";
import { FormSubmitButton } from "@/components/form-submit-button";
import { ParticipantPhotoGallery } from "@/components/participant-photo-gallery";
import { ReadOnlyBrowseGate } from "@/components/readonly-browse-gate";
import { ReadOnlyBrowseInterestForm } from "@/components/readonly-browse-interest-form";
import { interestSourceLabels, interestStatusLabels, userStatusLabels, type DashboardUser } from "@/lib/domain";
import type { ReadOnlyBrowsePageData } from "@/lib/readonly-browse-repository";
import { formatBirthYearLabel } from "@/lib/birth-year-label";

type ReadOnlyBrowsePageProps = {
  data: ReadOnlyBrowsePageData;
};

export function ReadOnlyBrowsePage({ data }: ReadOnlyBrowsePageProps) {
  if (!data.authorized) {
    return (
      <ReadOnlyBrowseGate
        disabled={!data.databaseConnected}
        initialMessage={accessIssueMessage(data.accessIssue, data.loadError)}
        userId={Number(data.accessPath.split("/").pop())}
      />
    );
  }

  const actor = data.actor;
  if (!actor) {
    return (
      <ReadOnlyBrowseGate
        disabled
        initialMessage="대상 사용자를 찾을 수 없습니다."
        userId={Number(data.accessPath.split("/").pop())}
      />
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-5 text-zinc-950 sm:px-5 sm:py-8">
      <section className="mx-auto grid w-full max-w-6xl gap-4 sm:gap-6">
        <header className="rounded-[28px] border border-red-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#E00E0E]">Blackbean Match</p>
              <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-zinc-950">오퍼 프로필 둘러보기</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
                마음에 드는 사람을 모두 살펴보고 선택해 주세요. 연락처는 연결되기 전까지 공개되지 않습니다.
              </p>
            </div>
            <form action={clearReadOnlyBrowseAccessAction}>
              <FormPendingFieldset className="contents">
                <input type="hidden" name="userId" value={actor.id} />
                <FormSubmitButton
                  label="둘러보기 종료"
                  pendingLabel="종료 중..."
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 hover:border-[#ffc6d5] hover:text-[#e63a68]"
                />
              </FormPendingFieldset>
            </form>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label="기준 사용자" value={actor.name} />
            <Metric label="내 정보" value={`${actor.gender} · ${formatAge(actor)}`} />
            <Metric label="현재 상태" value={userStatusLabels[actor.status]} />
            <Metric label="후보 수" value={`${data.candidates.length}명`} />
            <Metric label="받은 관심" value={`${data.receivedInterests.length}건`} />
          </div>

          {actor.status !== "READY" ? (
            <p className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
              현재 사용자 상태는 {userStatusLabels[actor.status]}입니다. 이 화면에서는 후보를 살펴볼 수 있지만, 선택 제출은 현재 상태에서 지원하지 않습니다.
            </p>
          ) : null}
          {data.loadError ? (
            <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-[#b10606]">
              {data.loadError}
            </p>
          ) : null}
        </header>

        <section className="grid gap-4">
          <section className="rounded-[28px] border border-[#ece7e4] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-[1.35rem] font-semibold tracking-[-0.03em] text-zinc-950">내가 받은 관심</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  소개 받을 수 있는 사람만 보이도록 걸러서 보여줍니다. 이미 진행 중이거나 조건이 맞지 않는 기록은 숨깁니다.
                </p>
              </div>
              <span className="inline-flex items-center rounded-full bg-[#fff1e6] px-3 py-1.5 text-xs font-semibold text-[#c96a2b]">
                {data.receivedInterests.length}명
              </span>
            </div>

            {data.receivedInterests.length === 0 ? (
              <p className="mt-4 rounded-[24px] border border-dashed border-[#eddccc] bg-[#fffaf5] px-4 py-5 text-sm text-zinc-500">
                현재 보여드릴 수 있는 받은 관심이 없습니다.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {data.receivedInterests.map((interest) => (
                  <article
                    key={interest.id}
                    className="rounded-[24px] border border-[#f0e5da] bg-[#fffaf5] p-4 shadow-[0_14px_32px_rgba(15,23,42,0.04)]"
                  >
                    <div className="grid gap-4 sm:grid-cols-[118px_minmax(0,1fr)]">
                      <div className="rounded-[18px] border border-[#ead9c8] bg-white p-2">
                        <ParticipantPhotoGallery
                          name={interest.fromUserName}
                          photos={interest.photos}
                          fallbackUrl={interest.photos[0]?.url}
                          variant="compact"
                        />
                      </div>
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-bold text-zinc-950">{interest.fromUserName}</p>
                            <p className="mt-1 text-sm text-zinc-600">{interestSourceLabels[interest.source]}</p>
                          </div>
                          <span
                            className={
                              interest.isMutual
                                ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                                : "rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#b86a2d]"
                            }
                          >
                            {interest.isMutual ? "서로 관심" : "받음"}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-zinc-700">
                          {interestStatusLabels[interest.status]} · {interest.createdAt}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <ReadOnlyBrowseInterestForm
            browseCandidates={data.candidates}
            browseLimit={data.browseLimit}
            browseSelections={data.browseSelections}
            browseSubmitted={data.browseSubmitted}
            canSubmitInterests={data.canSubmitInterests}
            databaseConnected={data.databaseConnected}
            accessToken={data.accessToken}
            userId={actor.id}
          />
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
      <p className="text-xs font-semibold text-zinc-500">{label}</p>
      <p className="mt-1 font-bold text-zinc-950">{value}</p>
    </div>
  );
}

function formatAge(user: DashboardUser) {
  return formatBirthYearLabel(user);
}

function accessIssueMessage(accessIssue: ReadOnlyBrowsePageData["accessIssue"], loadError: string | null) {
  if (loadError) return loadError;
  if (accessIssue === "invalid_token") return "링크가 유효하지 않습니다. 운영자에게 새 링크를 받아 다시 열어 주세요.";
  if (accessIssue === "database_unavailable") return "지금은 링크 정보를 확인할 수 없습니다.";
  return null;
}
