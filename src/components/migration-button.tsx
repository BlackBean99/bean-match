"use client";

import { useState, useTransition } from "react";
import type { MigrationState } from "@/lib/notion-migration";

const initialState = {
  status: "idle" as const,
  message: "Notion 데이터를 Supabase로 수동 동기화합니다.",
};

export function MigrationButton() {
  const [state, setState] = useState<MigrationState>(initialState);
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-2">
      <button
        type="button"
        className="rounded-lg border border-[#FF3131] bg-white px-4 py-2 text-sm font-bold text-[#E00E0E] hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            setState({ status: "idle", message: "Notion 데이터를 Supabase로 동기화하는 중입니다." });

            try {
              const response = await fetch("/api/migration/notion", {
                method: "POST",
                headers: { Accept: "application/json" },
              });
              const result = (await response.json()) as MigrationState;
              setState(result);
            } catch (error) {
              setState({
                status: "error",
                message: error instanceof Error ? `동기화 실패: ${error.message}` : "동기화 실패: 알 수 없는 오류",
              });
            }
          });
        }}
      >
        {pending ? "동기화 중..." : "Notion -> Supabase 동기화"}
      </button>
      <p className={state.status === "error" ? "text-xs font-semibold text-red-700" : "text-xs text-zinc-500"}>
        {state.message}
      </p>
    </div>
  );
}
