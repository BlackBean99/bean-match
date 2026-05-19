"use client";

import { useState } from "react";

type CopyTextButtonProps = {
  className?: string;
  copiedLabel?: string;
  errorLabel?: string;
  idleLabel?: string;
  text: string;
};

export function CopyTextButton({
  className,
  copiedLabel = "복사됨",
  errorLabel = "복사 실패",
  idleLabel = "복사",
  text,
}: CopyTextButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 1800);
    } catch {
      setStatus("error");
      window.setTimeout(() => setStatus("idle"), 1800);
    }
  }

  return (
    <button type="button" onClick={handleCopy} className={className}>
      {status === "copied" ? copiedLabel : status === "error" ? errorLabel : idleLabel}
    </button>
  );
}
