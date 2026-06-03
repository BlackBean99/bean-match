"use client";

import { useState } from "react";

type CopyLinkButtonProps = {
  url: string;
  className?: string;
  copiedLabel?: string;
  errorLabel?: string;
  idleLabel?: string;
};

export function CopyLinkButton({
  url,
  className,
  copiedLabel = "복사됨",
  errorLabel = "복사 실패",
  idleLabel = "링크 복사",
}: CopyLinkButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(resolveCopyUrl(url));
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

export function resolveCopyUrl(url: string) {
  if (typeof window === "undefined") return url;
  if (!url) return window.location.origin;
  if (url.startsWith("/")) {
    return new URL(url, window.location.origin).toString();
  }

  try {
    const parsed = new URL(url);
    if (isLocalHost(parsed.hostname)) {
      return new URL(`${parsed.pathname}${parsed.search}${parsed.hash}`, window.location.origin).toString();
    }
    return parsed.toString();
  } catch {
    return new URL(url, window.location.origin).toString();
  }
}

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";
}
