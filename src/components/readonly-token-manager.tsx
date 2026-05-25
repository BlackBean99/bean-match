"use client";

import { useActionState } from "react";
import {
  createReadOnlyBrowseTokenWithStateAction,
  revokeReadOnlyBrowseTokenAction,
  type CreateReadOnlyBrowseTokenActionState,
} from "@/app/readonly-actions";
import { CopyLinkButton } from "@/components/copy-link-button";
import { CopyTextButton } from "@/components/copy-text-button";
import { FormPendingFieldset } from "@/components/form-pending-fieldset";
import { FormSubmitButton } from "@/components/form-submit-button";
import {
  AdminSection,
  adminInputClassName,
  adminPrimaryButtonClassName,
  adminSecondaryButtonClassName,
  adminTablePanelClassName,
} from "@/components/admin-ui";
import type { ReadOnlyBrowseTokenSummary } from "@/lib/readonly-browse-repository";

type ReadOnlyTokenManagerProps = {
  accessUrl: string;
  databaseConnected: boolean;
  loadError: string | null;
  tokens: ReadOnlyBrowseTokenSummary[];
  userId: number;
  userName: string;
};

const initialState: CreateReadOnlyBrowseTokenActionState = {
  createdToken: null,
  error: null,
  values: {
    label: "",
    expiresAt: "",
  },
};

export function ReadOnlyTokenManager({
  accessUrl,
  databaseConnected,
  loadError,
  tokens,
  userId,
  userName,
}: ReadOnlyTokenManagerProps) {
  const [state, formAction] = useActionState(createReadOnlyBrowseTokenWithStateAction, initialState);

  return (
    <div className="grid gap-5">
      <AdminSection className="grid gap-5 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-bold text-[#e63a68]">Profile browse access</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-zinc-950">프로필 열람 토큰 관리</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              {userName}님 전용 프로필 열람 토큰을 발급합니다. 토큰으로 들어간 사용자는 선택 가능한 후보만 볼 수 있고, 연락처는 노출되지 않습니다.
            </p>
          </div>
          <div className="rounded-[24px] border border-[#ffd5df] bg-[#fff7fa] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e63a68]">Access URL</p>
            <p className="mt-2 break-all text-sm font-semibold text-zinc-700">{accessUrl}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyLinkButton
                url={accessUrl}
                className={adminPrimaryButtonClassName}
              />
              <span className="inline-flex items-center rounded-2xl border border-[#ffd5df] bg-white px-3 text-xs font-semibold text-zinc-500">
                Token required
              </span>
            </div>
          </div>
        </div>

        {loadError ? (
          <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-[#b10606]">
            {loadError}
          </p>
        ) : null}

        <form action={formAction} className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr_auto]">
          <FormPendingFieldset className="grid gap-4 xl:col-span-3 xl:grid-cols-[1.2fr_0.8fr_auto]">
            <input type="hidden" name="userId" value={userId} />
            <label className="grid gap-1 text-xs font-semibold text-zinc-600">
              토큰 라벨
              <input
                name="label"
                maxLength={120}
                placeholder="예: 5월 MVP 열람 링크"
                defaultValue={state.values.label}
                className={adminInputClassName}
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-zinc-600">
              만료일
              <input
                name="expiresAt"
                type="date"
                defaultValue={state.values.expiresAt}
                className={adminInputClassName}
              />
            </label>
            <div className="flex items-end">
              <FormSubmitButton
                label="토큰 발급"
                pendingLabel="발급 중..."
                disabled={!databaseConnected}
                className={`${adminPrimaryButtonClassName} w-full xl:w-auto`}
              />
            </div>
          </FormPendingFieldset>
        </form>

        {state.error ? (
          <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-[#b10606]">
            {state.error}
          </p>
        ) : null}

        {state.createdToken ? (
          <div className="grid gap-4 rounded-[24px] border border-emerald-100 bg-emerald-50/80 p-4">
            <div>
              <p className="text-sm font-bold text-emerald-700">새 토큰 발급 완료</p>
              <p className="mt-1 text-sm text-zinc-600">
                아래 토큰 원문은 지금 한 번만 확인할 수 있습니다. 접근 URL과 함께 전달하세요.
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
              <div className="rounded-2xl border border-emerald-100 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Token</p>
                <p className="mt-2 break-all font-mono text-sm text-zinc-800">{state.createdToken.rawToken}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <CopyTextButton
                  text={state.createdToken.rawToken}
                  idleLabel="토큰 복사"
                  className={adminPrimaryButtonClassName}
                />
                <CopyLinkButton
                  url={state.createdToken.accessUrl}
                  className={adminSecondaryButtonClassName}
                />
              </div>
            </div>
          </div>
        ) : null}
      </AdminSection>

      <section className={adminTablePanelClassName}>
        <div className="flex items-center justify-between border-b border-[#f1f5f9] px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-zinc-950">발급 이력</h3>
            <p className="mt-1 text-sm text-zinc-500">해제된 토큰은 다시 사용할 수 없습니다. 필요하면 새 토큰을 발급하세요.</p>
          </div>
          <span className="rounded-full bg-[#fff1f5] px-3 py-1 text-xs font-bold text-[#e63a68]">
            {tokens.length}개
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[#fafafc] text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-3">라벨</th>
                <th className="px-3 py-3">힌트</th>
                <th className="px-3 py-3">생성</th>
                <th className="px-3 py-3">마지막 사용</th>
                <th className="px-3 py-3">만료</th>
                <th className="px-3 py-3">상태</th>
                <th className="px-3 py-3">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {tokens.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-zinc-500" colSpan={7}>
                    발급된 프로필 열람 토큰이 없습니다.
                  </td>
                </tr>
              ) : (
                tokens.map((token) => (
                  <tr key={token.id} className="align-middle hover:bg-[#fff7fa]">
                    <td className="px-3 py-3 font-semibold text-zinc-950">{token.label}</td>
                    <td className="px-3 py-3 font-mono text-xs text-zinc-500">{token.tokenHint}</td>
                    <td className="px-3 py-3 text-zinc-600">{token.createdAt}</td>
                    <td className="px-3 py-3 text-zinc-600">{token.lastUsedAt ?? "-"}</td>
                    <td className="px-3 py-3 text-zinc-600">{token.expiresAt ?? "없음"}</td>
                    <td className="px-3 py-3">
                      <span
                        className={
                          token.isActive
                            ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"
                            : token.revokedAt
                              ? "rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-500"
                              : "rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700"
                        }
                      >
                        {token.isActive ? "사용 가능" : token.revokedAt ? "해제됨" : "만료"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {token.isActive ? (
                        <form action={revokeReadOnlyBrowseTokenAction}>
                          <FormPendingFieldset className="contents">
                            <input type="hidden" name="tokenId" value={token.id} />
                            <input type="hidden" name="userId" value={userId} />
                            <FormSubmitButton
                              label="해제"
                              pendingLabel="해제 중..."
                              className="text-sm font-bold text-zinc-600 hover:text-[#e63a68]"
                            />
                          </FormPendingFieldset>
                        </form>
                      ) : (
                        <span className="text-xs text-zinc-400">재발급 필요</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
