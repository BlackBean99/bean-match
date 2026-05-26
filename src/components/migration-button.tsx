"use client";

import { useEffect, useState, useTransition } from "react";
import type { MigrationState } from "@/lib/notion-migration";

const initialState = {
  status: "idle" as const,
  message: "Notion 동기화 요청.",
  progress: 0,
};

export function MigrationButton() {
  const [state, setState] = useState<MigrationState>(initialState);
  const [pending, startTransition] = useTransition();
  const isActive = pending || state.status === "queued";

  useEffect(() => {
    if (!pending) return;

    const timer = window.setInterval(() => {
      setState((current) => {
        if (current.status !== "idle" || typeof current.progress !== "number") return current;
        const nextProgress = Math.min((current.progress ?? 0) + 12, 88);
        return { ...current, progress: nextProgress };
      });
    }, 220);

    return () => window.clearInterval(timer);
  }, [pending]);

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
        disabled={pending}
        onClick={() => {
          setState({ status: "idle", message: "동기화 요청 중.", progress: 12, phase: "요청 중" });
          startTransition(async () => {
            try {
              const response = await fetch("/api/migration/notion", {
                method: "POST",
                headers: { Accept: "application/json" },
              });
              const result = (await response.json()) as MigrationState;
              setState({
                ...result,
                progress: result.status === "success" ? 100 : result.status === "error" ? 100 : result.progress ?? 65,
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
        {pending ? "처리 중..." : state.status === "queued" ? "대기 중" : "동기화"}
      </button>
      <p className={state.status === "error" ? "text-xs font-semibold text-red-700" : "text-xs text-zinc-500"}>
        {state.message}
      </p>
    </div>
  );
}
