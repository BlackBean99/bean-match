"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";
import {
  joinAutoExposureWithStateAction,
  type JoinAutoExposureActionState,
} from "@/app/exposure-actions";
import { FormPendingFieldset } from "@/components/form-pending-fieldset";
import { FormSubmitButton } from "@/components/form-submit-button";

type OnboardingFormProps = {
  accessToken: string;
  invitorId?: string;
  defaultName?: string;
};

export function OnboardingForm({ accessToken, invitorId, defaultName }: OnboardingFormProps) {
  const initialState: JoinAutoExposureActionState = {
    error: null,
    values: {
      accessToken,
      name: defaultName ?? "",
      invitorUserId: invitorId ?? "",
      openLevel: "FULL_OPEN",
      exposureConsent: false,
      newMemberNotificationsEnabled: true,
    },
  };
  const [state, formAction] = useActionState(joinAutoExposureWithStateAction, initialState);

  return (
    <section className="mx-auto w-full max-w-3xl rounded-lg border border-red-100 bg-white p-6 shadow-sm">
      <p className="text-sm font-bold text-[#E00E0E]">Blackbean Match</p>
      <h1 className="mt-2 text-3xl font-bold text-zinc-950">자동 노출 참여 정보 입력</h1>
      <p className="mt-2 text-sm leading-6 text-zinc-600">
        운영자가 발급한 전용 입장 링크입니다. 이름을 확인하고 노출 옵션만 선택하면 자동 노출 풀 입장을 진행합니다.
      </p>
      {invitorId ? (
        <p className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-[#E00E0E]">
          모집인 초대 링크로 들어왔습니다. 가입 출처는 운영자에게만 기록됩니다.
        </p>
      ) : null}
      <p className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-600">
        이 링크는 토큰으로 보호되어 있습니다. URL을 바꿔도 다른 사용자로 입장할 수 없습니다.
      </p>
      <form action={formAction} className="mt-6 grid gap-4">
        <FormPendingFieldset className="grid gap-4">
          {state.error ? (
            <p className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-[#b10606]">
              {state.error}
            </p>
          ) : null}
          <input type="hidden" name="accessToken" value={state.values.accessToken} />
          {invitorId ? <input type="hidden" name="invitorUserId" value={state.values.invitorUserId} /> : null}
          <Field label="이름 확인">
            <input name="name" defaultValue={state.values.name} className={inputClassName} required />
          </Field>
          <Field label="노출 레벨">
            <select name="openLevel" defaultValue={state.values.openLevel} className={inputClassName}>
              <option value="FULL_OPEN">전체 자동 노출</option>
              <option value="SEMI_OPEN">제한 자동 노출</option>
              <option value="PRIVATE">운영자 수동 검토만</option>
            </select>
          </Field>
          <label className="flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 px-3 py-3 text-sm text-zinc-700">
            <input
              name="exposureConsent"
              type="checkbox"
              defaultChecked={state.values.exposureConsent}
              className="mt-1 h-4 w-4 accent-[#FF3131]"
            />
            <span>자동 노출 풀에서 상대 회원에게 프로필이 보이는 것에 동의합니다.</span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-700">
            <input
              name="newMemberNotificationsEnabled"
              type="checkbox"
              className="mt-1 h-4 w-4 accent-[#FF3131]"
              defaultChecked={state.values.newMemberNotificationsEnabled}
            />
            <span>새로운 멤버가 내 풀에 들어오면 알림을 받겠습니다.</span>
          </label>
          <FormSubmitButton
            label="자동 노출 풀 입장하기"
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
