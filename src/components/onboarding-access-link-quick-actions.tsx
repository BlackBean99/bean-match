"use client";

import { useEffect, useState, useTransition } from "react";
import { createQuickOnboardingAccessClipboardAction } from "@/app/onboarding-access-actions";
import { adminPrimaryButtonClassName } from "@/components/admin-ui";
import { resolveCopyUrl } from "@/components/copy-link-button";

type OnboardingAccessLinkQuickActionsProps = {
  accessUrl: string | null;
  userId: number;
};

type ActionStatus = "idle" | "pending" | "copied" | "error";

export function OnboardingAccessLinkQuickActions({ accessUrl, userId }: OnboardingAccessLinkQuickActionsProps) {
  const [issuedAccessUrl, setIssuedAccessUrl] = useState<string | null>(accessUrl);
  const [status, setStatus] = useState<ActionStatus>("idle");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setIssuedAccessUrl(accessUrl);
  }, [accessUrl]);

  function scheduleStatus(nextStatus: Exclude<ActionStatus, "pending">) {
    setStatus(nextStatus);
    if (nextStatus !== "idle") {
      window.setTimeout(() => setStatus("idle"), 1800);
    }
  }

  async function ensureAccessUrl() {
    if (issuedAccessUrl) return issuedAccessUrl;

    const created = await createQuickOnboardingAccessClipboardAction(userId);
    setIssuedAccessUrl(created.accessUrl);
    return created.accessUrl;
  }

  function handleCopy() {
    startTransition(async () => {
      try {
        setStatus("pending");
        const nextAccessUrl = await ensureAccessUrl();
        await navigator.clipboard.writeText(resolveCopyUrl(nextAccessUrl));
        scheduleStatus("copied");
      } catch {
        scheduleStatus("error");
      }
    });
  }

  const disabled = isPending;

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={disabled}
      className={`${adminPrimaryButtonClassName} px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {status === "pending" ? "발급 중..." : status === "copied" ? "링크 복사됨" : status === "error" ? "복사 실패" : "링크 복사"}
    </button>
  );
}
