"use client";

import { useEffect } from "react";
import { AppErrorView } from "@/components/app-error-view";

type GlobalErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalErrorPage({ error, reset }: GlobalErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ko">
      <body>
        <AppErrorView
          title="서비스를 잠시 사용할 수 없습니다"
          description="예상하지 못한 장애가 발생했습니다. 다시 시도하거나 라운드 화면으로 돌아가서 원래 플로우로 다시 진입해 주세요."
          onRetry={reset}
        />
      </body>
    </html>
  );
}
