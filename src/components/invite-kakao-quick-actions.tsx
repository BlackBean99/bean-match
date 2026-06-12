"use client";

import { useState, useTransition } from "react";
import { createInviteKakaoShareAction } from "@/app/invite-actions";
import { adminPrimaryButtonClassName } from "@/components/admin-ui";
import { ResolvedUrlText } from "@/components/resolved-url-text";
import type { InviteTokenSummary } from "@/lib/invite-token-repository";

type InviteKakaoQuickActionsProps = {
  userId: number;
  token: InviteTokenSummary | null;
};

type InviteShareState = {
  accessUrl: string;
  shareText: string;
  token: InviteTokenSummary;
};

export function InviteKakaoQuickActions({ userId, token }: InviteKakaoQuickActionsProps) {
  const [issuedShare, setIssuedShare] = useState<InviteShareState | null>(null);
  const [status, setStatus] = useState<"idle" | "pending" | "copied" | "error">("idle");
  const [isPending, startTransition] = useTransition();

  function resetStatus(nextStatus: Exclude<typeof status, "pending">) {
    setStatus(nextStatus);
    if (nextStatus !== "idle") {
      window.setTimeout(() => setStatus("idle"), 1800);
    }
  }

  function handleCopyShareText() {
    startTransition(async () => {
      try {
        setStatus("pending");
        const issued = await createInviteKakaoShareAction(userId);
        const nextShare = {
          accessUrl: issued.accessUrl,
          shareText: issued.shareText,
          token: issued.token,
        };
        setIssuedShare(nextShare);
        await navigator.clipboard.writeText(issued.shareText);
        resetStatus("copied");
      } catch {
        resetStatus("error");
      }
    });
  }

  const currentToken = issuedShare?.token ?? token;

  return (
    <div className="grid gap-4">
      <div className="rounded-[24px] border border-[#f2e3d8] bg-[#fffaf5] p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-bold text-[#e63a68]">Invite link</p>
            <h3 className="mt-2 text-xl font-black tracking-[-0.04em] text-zinc-950">참가자 초대 링크와 카카오톡 문구</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              참가자별 개인 초대 링크를 발급하고, 안내 문구를 바로 카카오톡에 붙여넣을 수 있게 복사합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyShareText}
            disabled={isPending}
            className={`${adminPrimaryButtonClassName} whitespace-nowrap disabled:cursor-not-allowed disabled:bg-zinc-300`}
          >
            {status === "pending" ? "문구 발급 중..." : status === "copied" ? "문구 복사됨" : status === "error" ? "복사 실패" : "카톡 문구 복사"}
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <InfoCard label="본인 전용 링크" value={issuedShare?.accessUrl ?? "카톡 문구 복사 버튼을 누르면 새 링크가 발급됩니다."} />
          <InfoCard label="토큰 힌트" value={currentToken?.tokenHint ?? "-"} />
        </div>

        {currentToken ? (
          <div className="mt-4 grid gap-3 rounded-[20px] border border-[#f0e1d6] bg-white p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-500">
              <span className="rounded-full bg-[#fff1f5] px-2.5 py-1 text-[#e63a68]">현재 발급분</span>
              <span>생성 {currentToken.createdAt}</span>
              <span>마지막 사용 {currentToken.lastUsedAt ?? "-"}</span>
              <span>만료 {currentToken.expiresAt ?? "없음"}</span>
            </div>
            {issuedShare?.accessUrl ? (
              <ResolvedUrlText url={issuedShare.accessUrl} className="break-all text-sm text-zinc-800" />
            ) : (
              <p className="text-sm leading-6 text-zinc-600">현재 발급된 링크는 아직 복사되지 않았습니다.</p>
            )}
            <p className="whitespace-pre-wrap rounded-2xl bg-[#fffaf5] p-4 text-sm leading-6 text-zinc-700">
              {issuedShare?.shareText ??
                "버튼을 누르면 본인 전용 초대 링크와 카카오톡 안내 문구가 생성됩니다.\n링크는 개인 전용으로 공유하지 말아 주세요."}
            </p>
          </div>
        ) : (
          <p className="mt-4 rounded-[20px] border border-dashed border-[#f0e1d6] bg-white px-4 py-3 text-sm leading-6 text-zinc-600">
            아직 초대 링크가 없습니다. 버튼을 누르면 참가자 전용 링크와 카카오톡 문구가 함께 생성됩니다.
          </p>
        )}
      </div>

      <p className="text-xs leading-5 text-zinc-500">
        버튼을 누를 때마다 현재 참가자용 초대 링크가 새로 발급됩니다. 이미 공유한 링크가 있다면 최신 문구를 다시 발송하세요.
      </p>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-[#f0e1d6] bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-2 break-all text-sm leading-6 text-zinc-700">{value}</p>
    </div>
  );
}
