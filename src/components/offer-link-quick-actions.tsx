"use client";

import { useState, useTransition } from "react";
import { createQuickOfferClipboardAction } from "@/app/readonly-actions";
import { adminSecondaryButtonClassName } from "@/components/admin-ui";
import { resolveCopyUrl } from "@/components/copy-link-button";

type OfferLinkQuickActionsProps = {
  userId: number;
};

type IssuedOfferToken = {
  accessPath: string;
  expiresAtIso: string;
  rawToken: string;
};

type ActionStatus = "idle" | "pending" | "copied_link" | "copied_token" | "error";

export function OfferLinkQuickActions({ userId }: OfferLinkQuickActionsProps) {
  const [issuedToken, setIssuedToken] = useState<IssuedOfferToken | null>(null);
  const [status, setStatus] = useState<ActionStatus>("idle");
  const [isPending, startTransition] = useTransition();

  function scheduleStatus(nextStatus: Exclude<ActionStatus, "pending">) {
    setStatus(nextStatus);
    if (nextStatus !== "idle") {
      window.setTimeout(() => setStatus("idle"), 1800);
    }
  }

  async function ensureIssuedToken() {
    if (issuedToken && !isExpiredToken(issuedToken.expiresAtIso)) return issuedToken;
    const created = await createQuickOfferClipboardAction(userId);
    const nextIssuedToken = {
      accessPath: created.accessPath,
      expiresAtIso: created.expiresAtIso,
      rawToken: created.rawToken,
    };
    setIssuedToken(nextIssuedToken);
    return nextIssuedToken;
  }

  function handleCopyLink() {
    startTransition(async () => {
      try {
        setStatus("pending");
        const token = await ensureIssuedToken();
        await navigator.clipboard.writeText(resolveCopyUrl(token.accessPath));
        scheduleStatus("copied_link");
      } catch {
        scheduleStatus("error");
      }
    });
  }

  function handleCopyToken() {
    startTransition(async () => {
      try {
        setStatus("pending");
        const token = await ensureIssuedToken();
        await navigator.clipboard.writeText(token.rawToken);
        scheduleStatus("copied_token");
      } catch {
        scheduleStatus("error");
      }
    });
  }

  const disabled = isPending;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={handleCopyLink}
        disabled={disabled}
        className={`${adminSecondaryButtonClassName} px-2.5 py-1.5 text-[11px] disabled:cursor-not-allowed disabled:text-zinc-400`}
      >
        {status === "pending" ? "발급 중..." : status === "copied_link" ? "링크 복사됨" : status === "error" ? "복사 실패" : "링크 복사"}
      </button>
      <button
        type="button"
        onClick={handleCopyToken}
        disabled={disabled}
        className={`${adminSecondaryButtonClassName} px-2.5 py-1.5 text-[11px] disabled:cursor-not-allowed disabled:text-zinc-400`}
      >
        {status === "pending"
          ? "발급 중..."
          : status === "copied_token"
            ? "토큰 복사됨"
            : status === "error"
              ? "복사 실패"
              : "토큰 복사"}
      </button>
    </div>
  );
}

function isExpiredToken(expiresAtIso: string) {
  const parsed = Date.parse(expiresAtIso);
  return Number.isFinite(parsed) && parsed <= Date.now();
}
