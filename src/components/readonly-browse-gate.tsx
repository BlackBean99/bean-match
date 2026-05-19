"use client";

import { useActionState } from "react";
import { unlockReadOnlyBrowseAction, type UnlockReadOnlyBrowseActionState } from "@/app/readonly-actions";
import { FormPendingFieldset } from "@/components/form-pending-fieldset";
import { FormSubmitButton } from "@/components/form-submit-button";

type ReadOnlyBrowseGateProps = {
  disabled: boolean;
  initialMessage: string | null;
  userId: number;
};

const initialState: UnlockReadOnlyBrowseActionState = {
  error: null,
};

export function ReadOnlyBrowseGate({ disabled, initialMessage, userId }: ReadOnlyBrowseGateProps) {
  const [state, formAction] = useActionState(unlockReadOnlyBrowseAction, initialState);
  const errorMessage = state.error ?? initialMessage;

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 text-zinc-950 sm:px-5 sm:py-8">
      <section className="mx-auto grid w-full max-w-2xl gap-4">
        <header className="rounded-[28px] border border-red-100 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#E00E0E]">Blackbean Match</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-zinc-950">읽기 전용 소개 풀</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            이 페이지는 관리자가 발급한 리드 온리 토큰으로만 열 수 있습니다. 토큰이 유효하면 같은 성별을 제외한 소개 가능 후보를 읽기 전용으로 열람할 수 있으며, 연락처는 공개되지 않습니다.
          </p>
        </header>

        <form action={formAction} className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <FormPendingFieldset className="grid gap-4">
            <input type="hidden" name="userId" value={userId} />
            {errorMessage ? (
              <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-[#b10606]">
                {errorMessage}
              </p>
            ) : null}
            <label className="grid gap-1 text-xs font-semibold text-zinc-600">
              리드 온리 토큰
              <input
                name="token"
                autoComplete="off"
                placeholder="bbro_..."
                className="h-12 rounded-2xl border border-zinc-300 bg-white px-4 text-sm text-zinc-950 outline-none focus:border-[#FF3131] focus:ring-4 focus:ring-red-100"
              />
            </label>
            <FormSubmitButton
              label="토큰으로 입장"
              pendingLabel="검증 중..."
              disabled={disabled}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#ff4f7a,#ff6a3d)] px-5 text-sm font-bold text-white shadow-[0_18px_35px_rgba(255,79,122,0.28)] disabled:bg-zinc-300 disabled:shadow-none"
            />
          </FormPendingFieldset>
        </form>
      </section>
    </main>
  );
}
