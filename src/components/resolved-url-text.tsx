"use client";

import { useMemo } from "react";
import { resolveCopyUrl } from "@/components/copy-link-button";

type ResolvedUrlTextProps = {
  className?: string;
  url: string;
};

export function ResolvedUrlText({ className, url }: ResolvedUrlTextProps) {
  const resolvedUrl = useMemo(() => resolveCopyUrl(url), [url]);
  return <p className={className}>{resolvedUrl}</p>;
}
