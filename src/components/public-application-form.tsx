"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";
import { submitPublicApplicationAction, type SubmitPublicApplicationActionState } from "@/app/apply-actions";
import { CompressedPhotoInput } from "@/components/compressed-photo-input";
import { FormPendingFieldset } from "@/components/form-pending-fieldset";
import { FormSubmitButton } from "@/components/form-submit-button";

const initialState: SubmitPublicApplicationActionState = {
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

export function PublicApplicationForm() {
  const [state, formAction] = useActionState(submitPublicApplicationAction, initialState);

  return (
    <section className="rounded-[32px] border border-white/70 bg-white/95 p-5 shadow-[0_32px_120px_rgba(15,23,42,0.18)] backdrop-blur sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E00E0E]">Blackbean Match</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.05em] text-zinc-950">외부 신청서</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
            이름과 프로필을 제출하면 승인 대기 상태로 등록됩니다. 승인 전에는 풀에 노출되지 않습니다.
          </p>
        </div>
        <span className="inline-flex items-center rounded-full bg-[#fff1e6] px-3 py-1.5 text-xs font-semibold text-[#c96a2b]">
          제출 후 승인 대기
        </span>
      </div>

      {state.error ? (
        <p className="mt-5 rounded-[24px] border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-[#b10606]">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="mt-5 rounded-[24px] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {state.success}
        </p>
      ) : null}

      <form action={formAction} className="mt-6 grid gap-4">
        <FormPendingFieldset className="grid gap-4 md:grid-cols-2">
          <input type="hidden" name="openLevel" value="FULL_OPEN" />
          <Field label="이름">
            <input name="name" required defaultValue={state.values.name} className={inputClassName} />
          </Field>
          <Field label="성별">
            <select name="gender" required defaultValue={state.values.gender} className={inputClassName}>
              <option value="">선택</option>
              <option value="FEMALE">여성</option>
              <option value="MALE">남성</option>
              <option value="OTHER">기타</option>
              <option value="UNDISCLOSED">비공개</option>
            </select>
          </Field>
          <Field label="몇년생">
            <input name="birthYearText" placeholder="예: 95년생" defaultValue={state.values.birthYearText} className={inputClassName} />
          </Field>
          <Field label="전화번호">
            <input name="phone" inputMode="tel" placeholder="010-1234-5678" defaultValue={state.values.phone} className={inputClassName} />
          </Field>
          <Field label="키(cm)">
            <input name="heightCm" type="number" min="0" placeholder="예: 168" defaultValue={state.values.heightCm} className={inputClassName} />
          </Field>
          <Field label="직장">
            <input name="companyName" defaultValue={state.values.companyName} className={inputClassName} />
          </Field>
          <div className="md:col-span-2">
            <Field label="직업">
              <input name="jobTitle" defaultValue={state.values.jobTitle} className={inputClassName} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="자기소개">
              <textarea
                name="selfIntro"
                rows={4}
                defaultValue={state.values.selfIntro}
                className={`${inputClassName} min-h-28`}
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="이상형">
              <textarea
                name="idealTypeDescription"
                rows={4}
                defaultValue={state.values.idealTypeDescription}
                className={`${inputClassName} min-h-28`}
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="사진">
              <CompressedPhotoInput name="photoFile" className={inputClassName} />
            </Field>
          </div>
          <fieldset className="grid gap-2 md:col-span-2">
            <legend className="text-xs font-semibold text-zinc-600">동의</legend>
            <label className="inline-flex items-start gap-3 rounded-[22px] border border-[#f3e3d6] bg-[#fffaf5] px-4 py-3 text-sm text-zinc-700">
              <input
                name="exposureConsent"
                type="checkbox"
                defaultChecked={state.values.exposureConsent}
                className="mt-1 h-4 w-4 accent-[#d97a32]"
              />
              <span>승인 이후 프로필이 풀에서 보이는 것에 동의합니다.</span>
            </label>
            <label className="inline-flex items-start gap-3 rounded-[22px] border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
              <input
                name="newMemberNotificationsEnabled"
                type="checkbox"
                defaultChecked={state.values.newMemberNotificationsEnabled}
                className="mt-1 h-4 w-4 accent-[#d97a32]"
              />
              <span>새 멤버 알림을 받겠습니다.</span>
            </label>
          </fieldset>
          <div className="md:col-span-2">
            <FormSubmitButton
              label="신청서 제출"
              pendingLabel="제출 중..."
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#da7a37,#ee9b55)] px-5 text-sm font-semibold text-white shadow-[0_18px_35px_rgba(217,122,50,0.24)]"
            />
          </div>
        </FormPendingFieldset>
      </form>
    </section>
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

const inputClassName =
  "w-full min-w-0 rounded-2xl border border-[#ded5c8] bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-[#d98b51] focus:ring-2 focus:ring-[#f8e1cf]";
