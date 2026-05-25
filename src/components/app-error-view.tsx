"use client";

import { useRouter } from "next/navigation";

type AppErrorViewProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  showHomeButton?: boolean;
};

export function AppErrorView({
  title = "문제가 발생했습니다",
  description = "잠시 후 다시 시도해 주세요. 같은 문제가 이어지면 이전 화면으로 돌아가 다시 진행하는 편이 안전합니다.",
  onRetry,
  showHomeButton = true,
}: AppErrorViewProps) {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-5 text-zinc-950 sm:px-5 sm:py-8">
      <section className="mx-auto grid w-full max-w-md gap-4">
        <header className="rounded-lg border border-red-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#E00E0E]">Blackbean Match</p>
          <h1 className="mt-2 text-2xl font-bold text-zinc-950">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">{description}</p>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            저장 중이던 작업이 반영되지 않았을 수 있으니, 버튼으로 원래 흐름으로 다시 들어가 주세요.
          </p>
        </header>

        <div className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="w-full rounded-lg bg-[#FF3131] px-5 py-3 text-sm font-bold text-white hover:bg-[#E00E0E]"
            >
              다시 시도
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => router.back()}
            className="w-full rounded-lg border border-zinc-300 px-5 py-3 text-sm font-bold text-zinc-700"
          >
            이전 화면으로 돌아가기
          </button>
          {showHomeButton ? (
            <button
              type="button"
              onClick={() => router.push("/rounds")}
              className="w-full rounded-lg border border-zinc-300 px-5 py-3 text-sm font-bold text-zinc-700"
            >
              라운드 화면으로 이동
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
}
