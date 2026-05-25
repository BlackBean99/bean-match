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
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-zinc-950">프로필 열람 링크 확인</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            안내받은 링크가 맞는지 확인해 주세요. 링크가 유효하면 선택 가능한 후보를 볼 수 있고, 연락처는 연결되기 전까지 공개되지 않습니다.
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
              링크 코드
              <input
                name="token"
                autoComplete="off"
                placeholder="입장 링크를 붙여 넣어 주세요"
                className="h-12 rounded-2xl border border-zinc-300 bg-white px-4 text-sm text-zinc-950 outline-none focus:border-[#FF3131] focus:ring-4 focus:ring-red-100"
              />
            </label>
            <FormSubmitButton
              label="링크로 입장"
              pendingLabel="확인 중..."
              disabled={disabled}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#ff4f7a,#ff6a3d)] px-5 text-sm font-bold text-white shadow-[0_18px_35px_rgba(255,79,122,0.28)] disabled:bg-zinc-300 disabled:shadow-none"
            />
          </FormPendingFieldset>
        </form>
      </section>
    </main>
  );
}
