"use client";

import { useActionState } from "react";
import { unlockAdminAccessAction, type AdminAccessActionState } from "@/app/admin-access/actions";
import { FormPendingFieldset } from "@/components/form-pending-fieldset";
import { FormSubmitButton } from "@/components/form-submit-button";

type AdminAccessGateProps = {
  returnPath: string;
};

const initialState: AdminAccessActionState = {
  error: null,
};

export function AdminAccessGate({ returnPath }: AdminAccessGateProps) {
  const [state, formAction] = useActionState(unlockAdminAccessAction, initialState);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fffdf9_0%,#f6f4ef_100%)] px-4 py-6 text-zinc-950 sm:px-5 sm:py-8">
      <section className="mx-auto grid w-full max-w-xl gap-4">
        <header className="rounded-[28px] border border-[#efe6dd] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c96a2b]">Blackbean Match</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-zinc-950">운영 화면 접근</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            공개 오퍼 페이지를 제외한 운영 화면은 접근 코드가 있어야 열립니다.
          </p>
        </header>

        <form action={formAction} className="rounded-[28px] border border-[#efe6dd] bg-white p-5 shadow-sm sm:p-6">
          <FormPendingFieldset className="grid gap-4">
            <input type="hidden" name="returnPath" value={returnPath} />
            {state.error ? (
              <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-[#b10606]">
                {state.error}
              </p>
            ) : null}
            <label className="grid gap-1 text-xs font-semibold text-zinc-600">
              접근 코드
              <input
                name="accessCode"
                type="password"
                autoComplete="current-password"
                className="h-12 rounded-2xl border border-zinc-300 bg-white px-4 text-sm text-zinc-950 outline-none focus:border-[#FF3131] focus:ring-4 focus:ring-red-100"
              />
            </label>
            <FormSubmitButton
              label="접근 허용"
              pendingLabel="확인 중..."
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#ff4f7a,#ff6a3d)] px-5 text-sm font-bold text-white shadow-[0_18px_35px_rgba(255,79,122,0.28)]"
            />
          </FormPendingFieldset>
        </form>
      </section>
    </main>
  );
}
