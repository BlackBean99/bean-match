import type { ReactNode } from "react";
import { joinCurrentRoundAction } from "@/app/round-actions";
import { FormPendingFieldset } from "@/components/form-pending-fieldset";
import { FormSubmitButton } from "@/components/form-submit-button";

type OnboardingFormProps = {
  invitorId?: string;
};

export function OnboardingForm({ invitorId }: OnboardingFormProps) {
  return (
    <section className="mx-auto w-full max-w-3xl rounded-lg border border-red-100 bg-white p-6 shadow-sm">
      <p className="text-sm font-bold text-[#E00E0E]">Blackbean Match</p>
      <h1 className="mt-2 text-3xl font-bold text-zinc-950">라운드 참여 정보 입력</h1>
      <p className="mt-2 text-sm leading-6 text-zinc-600">
        모집인이 먼저 만든 사용자 데이터의 ID와 본인 이름을 입력하면 기존 정보를 바탕으로 현재 라운드 참여 상태를
        갱신합니다.
      </p>
      {invitorId ? (
        <p className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-[#E00E0E]">
          모집인 초대 링크로 들어왔습니다. 가입 출처는 운영자에게만 기록됩니다.
        </p>
      ) : null}
      <form action={joinCurrentRoundAction} className="mt-6 grid gap-4">
        <FormPendingFieldset className="grid gap-4">
          {invitorId ? <input type="hidden" name="invitorUserId" value={invitorId} /> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="데이터 ID">
              <input name="userId" inputMode="numeric" className={inputClassName} placeholder="예: 123" required />
            </Field>
            <Field label="이름">
              <input name="name" className={inputClassName} required />
            </Field>
          </div>
          <label className="flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 px-3 py-3 text-sm text-zinc-700">
            <input name="fullOpenConsent" type="checkbox" className="mt-1 h-4 w-4 accent-[#FF3131]" required />
            <span>현재 라운드 참여를 위해 전체 공개에 동의합니다.</span>
          </label>
          <FormSubmitButton
            label="현재 라운드 참여하기"
            pendingLabel="입장 처리 중..."
            className="rounded-lg bg-[#FF3131] px-4 py-3 text-sm font-bold text-white hover:bg-[#E00E0E] disabled:cursor-not-allowed disabled:bg-zinc-300"
          />
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
  "w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-[#FF3131] focus:ring-2 focus:ring-red-100";
