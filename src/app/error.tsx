"use client";

import { useEffect } from "react";
import { AppErrorView } from "@/components/app-error-view";

type AppErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppErrorPage({ error, reset }: AppErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <AppErrorView
      title="화면을 불러오지 못했습니다"
      description="서버나 네트워크 문제로 현재 화면을 완전히 열지 못했습니다. 다시 시도하거나 이전 화면으로 돌아가 원래 흐름에서 다시 시작해 주세요."
      onRetry={reset}
    />
  );
}
