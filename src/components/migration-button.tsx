"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MigrationState } from "@/lib/notion-migration";

const initialState = {
  status: "idle" as const,
  message: "Notion 동기화 요청.",
  progress: 0,
};

export function MigrationButton({ canManage = false }: { canManage?: boolean }) {
  const [state, setState] = useState<MigrationState>(initialState);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const isActive = pending || state.status === "queued";

  useEffect(() => {
    if (state.status !== "queued") return;

    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch("/api/migration/notion", {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) return;

        const next = (await response.json()) as MigrationState;
        if (cancelled) return;

        setState((current) => {
          if (next.status === "queued") {
            return {
              ...current,
              ...next,
              progress: next.progress ?? current.progress ?? 15,
              phase: next.phase ?? current.phase ?? "대기 중",
            };
          }

          const nextState = {
            ...current,
            ...next,
          };
          if (next.status === "success") {
            router.refresh();
          }
          return nextState;
        });
      } catch {
        // Keep the last known state and retry on the next tick.
      }
    };

    void poll();
    const timer = window.setInterval(poll, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [router, state.status]);

  return (
    <div className="grid gap-2">
      <div className="overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${
            state.status === "error"
              ? "bg-gradient-to-r from-[#ef4444] to-[#dc2626]"
              : state.status === "success"
                ? "bg-gradient-to-r from-[#22c55e] to-[#16a34a]"
                : "bg-[linear-gradient(90deg,#ff5d89_0%,#ff7ca0_45%,#ffd0dc_100%)]"
          } ${isActive ? "animate-pulse" : ""}`}
          style={{ width: `${state.progress ?? 0}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-white/68">
        <span>{state.phase ?? (pending ? "진행 중" : "대기")}</span>
        <span>{Math.round(state.progress ?? 0)}%</span>
      </div>
      <button
        type="button"
        className="rounded-lg border border-[#FF3131] bg-white px-4 py-2 text-sm font-bold text-[#E00E0E] hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!canManage || isActive}
        onClick={() => {
          if (!canManage) return;
          setState({ status: "queued", message: "동기화 요청 중.", progress: 12, phase: "요청 중" });
          startTransition(async () => {
            try {
              const response = await fetch("/api/migration/notion", {
                method: "POST",
                headers: { Accept: "application/json" },
              });
              const result = (await response.json()) as MigrationState;
              if (result.status === "success") {
                router.refresh();
              }
              setState({
                ...result,
                progress: result.status === "success" ? 100 : result.status === "error" ? 100 : result.progress ?? 15,
                phase: result.phase ?? (result.status === "success" ? "완료" : result.status === "error" ? "실패" : "대기 중"),
              });
            } catch (error) {
              setState({
                status: "error",
                message: error instanceof Error ? `동기화 실패: ${error.message}` : "동기화 실패: 알 수 없는 오류",
                progress: 100,
                phase: "실패",
              });
            }
          });
        }}
      >
        {!canManage ? "관리자 전용" : pending ? "처리 중..." : state.status === "queued" ? "대기 중" : "동기화"}
      </button>
      <p className={state.status === "error" ? "text-xs font-semibold text-red-700" : "text-xs text-zinc-500"}>
        {state.message}
      </p>
    </div>
  );
}
