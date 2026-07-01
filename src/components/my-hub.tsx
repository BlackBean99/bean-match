"use client";

import { useActionState } from "react";
import { createMyInviteCodeAction, updateMyProfileAction, type UpdateMyProfileActionState } from "@/app/me-actions";
import { FormPendingFieldset } from "@/components/form-pending-fieldset";
import { FormSubmitButton } from "@/components/form-submit-button";
import { ParticipantPhotoGallery } from "@/components/participant-photo-gallery";
import type { DashboardUserDetail, ParticipantExposureData } from "@/lib/domain";

type MyHubProps = {
  user: DashboardUserDetail;
  exposureData: ParticipantExposureData;
  inviteCount: number;
  inviteTokenHint: string | null;
};

const initialState: UpdateMyProfileActionState = {
  error: null,
  success: null,
  values: {
    name: "",
    gender: "",
    birthYearText: "",
    phone: "",
    heightCm: "",
    jobTitle: "",
    companyName: "",
    selfIntro: "",
    idealTypeDescription: "",
    exposureConsent: true,
    newMemberNotificationsEnabled: true,
  },
};

export function MyHub({ user, exposureData, inviteCount, inviteTokenHint }: MyHubProps) {
  const [state, formAction] = useActionState(updateMyProfileAction, initialState);

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-5 text-zinc-950 sm:px-5 sm:py-8">
      <section className="mx-auto grid w-full max-w-6xl gap-4 sm:gap-6">
        <header className="rounded-lg border border-red-100 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#E00E0E]">Blackbean Match</p>
          <h1 className="mt-2 text-2xl font-bold text-zinc-950 sm:text-3xl">내 허브</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            내 정보를 수정하고, 내가 선택한 사람과 볼 수 있는 후보를 확인하고, 초대 코드를 관리합니다.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <Metric label="이름" value={user.name} />
            <Metric label="성별" value={user.gender} />
            <Metric label="초대 수" value={`${inviteCount}명`} />
            <Metric label="선택 한도" value={`${2 + inviteCount}명`} />
          </div>
          {state.error ? <p className="mt-3 text-sm font-semibold text-red-700">{state.error}</p> : null}
          {state.success ? <p className="mt-3 text-sm font-semibold text-emerald-700">{state.success}</p> : null}
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <div>
              <h2 className="text-lg font-bold text-zinc-950">내 정보 수정</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-500">본인 정보만 수정할 수 있고 관리자는 이 화면에 들어오지 않습니다.</p>
            </div>

            <form action={formAction} className="grid gap-4">
              <FormPendingFieldset className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="이름" name="name" defaultValue={user.name} />
                  <Field label="출생년도" name="birthYearText" defaultValue={user.ageText} placeholder="예: 1996" />
                  <Field label="전화번호" name="phone" defaultValue="" placeholder="010-1234-5678" />
                  <Field label="키(cm)" name="heightCm" defaultValue={user.heightCm > 0 ? String(user.heightCm) : ""} />
                  <Field label="직장" name="jobTitle" defaultValue={user.jobTitle} />
                  <Field label="회사" name="companyName" defaultValue={user.companyName} />
                </div>
                <Field label="자기소개" name="selfIntro" defaultValue={user.selfIntro} textarea />
                <Field label="이상형" name="idealTypeDescription" defaultValue={user.idealTypeDescription} textarea />
                <div className="flex flex-wrap gap-4 text-sm text-zinc-700">
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" name="exposureConsent" defaultChecked={user.exposureConsent} />
                    공개 노출 동의
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" name="newMemberNotificationsEnabled" defaultChecked={user.newMemberNotificationsEnabled} />
                    신규 멤버 알림 수신
                  </label>
                </div>
                <FormSubmitButton
                  label="내 정보 저장"
                  pendingLabel="저장 중..."
                  className="w-full rounded-lg bg-[#FF3131] px-5 py-3 text-sm font-bold text-white hover:bg-[#E00E0E] sm:w-fit"
                />
              </FormPendingFieldset>
            </form>
          </section>

          <section className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <div>
              <h2 className="text-lg font-bold text-zinc-950">초대 코드</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-500">초대받은 사람 수만큼 선택 가능 인원이 1명씩 늘어납니다.</p>
            </div>
            <form action={createMyInviteCodeAction}>
              <FormPendingFieldset className="grid gap-3">
                <FormSubmitButton
                  label="초대 코드 생성"
                  pendingLabel="생성 중..."
                  className="w-full rounded-lg border border-zinc-300 px-5 py-3 text-sm font-bold text-zinc-700 sm:w-fit"
                />
              </FormPendingFieldset>
            </form>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              {inviteTokenHint ? (
                <div className="grid gap-2">
                  <p className="font-semibold text-zinc-950">최근 초대 코드 힌트</p>
                  <p className="break-all text-xs text-zinc-500">{inviteTokenHint}</p>
                </div>
              ) : (
                <p>아직 생성된 초대 코드가 없습니다.</p>
              )}
            </div>

            <div className="grid gap-3">
              <h3 className="text-sm font-bold text-zinc-950">내가 선택한 사람</h3>
              {exposureData.browseSelections.length === 0 ? (
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">아직 선택한 사람이 없습니다.</p>
              ) : (
                exposureData.browseSelections.map((selection) => (
                  <div key={selection.id} className="rounded-lg border border-zinc-200 bg-white p-3">
                    <p className="font-semibold text-zinc-950">{selection.toUserName}</p>
                    <p className="text-xs text-zinc-500">{selection.source} · {selection.createdAt}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </section>

        <section className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
          <div>
            <h2 className="text-lg font-bold text-zinc-950">내가 볼 수 있는 반대 성별 목록</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-500">
              현재 공개 조건을 만족하는 후보만 보이며, 관리자 화면과는 별도입니다.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {exposureData.browseCandidates.map((candidate) => (
              <article key={candidate.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <div className="rounded-md border border-zinc-200 bg-white p-2">
                  <ParticipantPhotoGallery name={candidate.name} photos={candidate.photos} fallbackUrl={candidate.mainPhotoUrl} />
                </div>
                <p className="mt-3 font-bold text-zinc-950">{candidate.name}</p>
                <p className="text-sm text-zinc-500">{candidate.gender} · {candidate.jobTitle}</p>
                <p className="mt-2 text-xs text-zinc-500">현재 관심 {candidate.activeIncomingInterestCount}건</p>
              </article>
            ))}
            {exposureData.browseCandidates.length === 0 ? (
              <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-500">표시할 후보가 없습니다.</p>
            ) : null}
          </div>
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

function Field({
  label,
  name,
  defaultValue,
  textarea = false,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  textarea?: boolean;
  placeholder?: string;
}) {
  const className =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-[#FF3131] focus:ring-2 focus:ring-red-100";

  return (
    <label className="grid gap-2 text-sm font-semibold text-zinc-700">
      <span>{label}</span>
      {textarea ? (
        <textarea name={name} rows={4} defaultValue={defaultValue} placeholder={placeholder} className={className} />
      ) : (
        <input name={name} defaultValue={defaultValue} placeholder={placeholder} className={className} />
      )}
    </label>
  );
}
