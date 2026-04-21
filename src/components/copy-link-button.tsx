"use client";

import { useState } from "react";

type CopyLinkButtonProps = {
  url: string;
  className?: string;
};

export function CopyLinkButton({ url, className }: CopyLinkButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 1800);
    } catch {
      setStatus("error");
      window.setTimeout(() => setStatus("idle"), 1800);
    }
  }

  return (
    <button type="button" onClick={handleCopy} className={className}>
      {status === "copied" ? "복사됨" : status === "error" ? "복사 실패" : "링크 복사"}
    </button>
  );
}
