import { getCloudflareContext } from "@opennextjs/cloudflare";
import { revalidatePath } from "next/cache";
import { getRuntimeEnv, isCloudflareRuntime } from "@/lib/runtime-env";

export type MigrationState = {
  status: "idle" | "success" | "error" | "queued";
  message: string;
  progress?: number;
  phase?: string;
};

type SyncProgressUpdate = {
  progress: number;
  phase: string;
  message: string;
};

type NotionSyncResult = {
  write: boolean;
  users: { action?: string; source?: string; reason?: string }[];
};

type GitHubWorkflowRun = {
  id: number;
  html_url: string;
  status: "queued" | "in_progress" | "completed";
  conclusion:
    | "success"
    | "failure"
    | "cancelled"
    | "timed_out"
    | "action_required"
    | "neutral"
    | "skipped"
    | null;
  created_at: string;
  updated_at: string;
  run_started_at: string | null;
  name: string;
};

type GitHubWorkflowRunsResponse = {
  workflow_runs: GitHubWorkflowRun[];
};

const initialMigrationState: MigrationState = {
  status: "idle",
  message: "동기화 대기 중입니다.",
  progress: 0,
  phase: "대기",
};

const workflowRepository = "BlackBean99/bean-match";

let latestMigrationState: MigrationState = initialMigrationState;
let currentMigrationPromise: Promise<MigrationState> | null = null;
let latestWorkflowRunId: number | null = null;
let latestWorkflowDispatchAt: string | null = null;

export async function runNotionMigration(): Promise<MigrationState> {
  const env = getRuntimeEnv();
  logMigrationEnvironment(env);

  if (currentMigrationPromise) {
    return latestMigrationState;
  }

  if (isCloudflareRuntime() && latestMigrationState.status === "queued") {
    latestMigrationState = await refreshWorkflowRunStatus(env);
    if (latestMigrationState.status === "queued") {
      return latestMigrationState;
    }
  }

  latestMigrationState = {
    status: "queued",
    message: "동기화 요청을 시작합니다.",
    progress: 12,
    phase: "준비 중",
  };

  const migrationPromise = startNotionSyncJob(env);
  currentMigrationPromise = migrationPromise;

  try {
    getCloudflareContext().ctx.waitUntil(migrationPromise);
  } catch {
    // Outside Cloudflare runtime the promise can simply keep running in-process.
  }

  void migrationPromise.finally(() => {
    currentMigrationPromise = null;
  });

  return latestMigrationState;
}

export async function getNotionMigrationStatus(): Promise<MigrationState> {
  if (isCloudflareRuntime() && latestMigrationState.status === "queued") {
    const env = getRuntimeEnv();
    latestMigrationState = await refreshWorkflowRunStatus(env);
  }
  return latestMigrationState;
}

function logMigrationEnvironment(env: ReturnType<typeof getRuntimeEnv>) {
  console.info(
    JSON.stringify({
      scope: "notion-sync",
      runtime: isCloudflareRuntime() ? "cloudflare" : "node",
      notionTokenPresent: Boolean(env.NOTION_TOKEN),
      supabaseUrlPresent: Boolean(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL),
      supabaseServiceRoleKeyPresent: Boolean(env.SUPABASE_SERVICE_ROLE_KEY || env.DATABASE_URL),
      databaseUrlPresent: Boolean(env.DATABASE_URL),
    }),
  );
}

async function startNotionSyncJob(env: ReturnType<typeof getRuntimeEnv>): Promise<MigrationState> {
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") {
      process.env[key] = value;
    }
  }

  try {
    latestMigrationState = {
      status: "queued",
      message: "Notion 동기화를 시작했습니다.",
      progress: 15,
      phase: "초기화",
    };

    if (isCloudflareRuntime()) {
      return dispatchNotionSyncWorkflow(env);
    }

    // @ts-expect-error: the sync runner is a .mjs CLI module that is shared with the worker runtime.
    const syncModule = (await import("../../scripts/sync-notion-to-supabase.mjs")) as {
      runNotionSync: (options: {
        write?: boolean;
        onProgress?: (update: SyncProgressUpdate) => void;
      }) => Promise<NotionSyncResult>;
    };
    const { runNotionSync } = syncModule;

    const result = await runNotionSync({
      write: true,
      onProgress: (update: SyncProgressUpdate) => {
        latestMigrationState = {
          status: "queued",
          message: update.message,
          progress: update.progress,
          phase: update.phase,
        };
      },
    });

    const created = result.users.filter((user) => user.action === "created").length;
    const updated = result.users.filter((user) => user.action === "updated").length;
    const skipped = result.users.filter((user) => user.action === "skipped").length;
    const failed = result.users.filter((user) => user.action === "error").length;
    const sourceSummary = summarizeSources(result.users);

    if (failed > 0) {
      latestMigrationState = {
        status: "error",
        message: `동기화 부분 실패: 실패 ${failed}건, 생성 ${created}건, 업데이트 ${updated}건, 건너뜀 ${skipped}건${
          sourceSummary ? ` (${sourceSummary})` : ""
        }`,
        progress: 100,
        phase: "실패",
      };

      return latestMigrationState;
    }

    latestMigrationState = {
      status: "success",
      message: `동기화 완료: 생성 ${created}건, 업데이트 ${updated}건, 건너뜀 ${skipped}건${
        sourceSummary ? ` (${sourceSummary})` : ""
      }`,
      progress: 100,
      phase: "완료",
    };

    revalidatePath("/users");
    revalidatePath("/matches");

    return latestMigrationState;
  } catch (error) {
    latestMigrationState = {
      status: "error",
      message: error instanceof Error ? `동기화 실패: ${error.message}` : "동기화 실패: 알 수 없는 오류",
      progress: 100,
      phase: "실패",
    };
    return latestMigrationState;
  }
}

async function dispatchNotionSyncWorkflow(env: ReturnType<typeof getRuntimeEnv>): Promise<MigrationState> {
  const token = getGitHubWorkflowToken(env);
  if (!token) {
    return {
      status: "error",
      message: "동기화 실패: NOTION_SYNC_WORKFLOW_TOKEN 이 설정되지 않았습니다.",
      progress: 100,
      phase: "실패",
    };
  }

  const workflowFile = env.NOTION_SYNC_WORKFLOW_FILE || "notion-sync.yml";
  const workflowRef = env.NOTION_SYNC_WORKFLOW_REF || "main";
  const dispatchUrl = `https://api.github.com/repos/${workflowRepository}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`;

  latestWorkflowDispatchAt = new Date().toISOString();
  latestWorkflowRunId = null;

  const response = await fetch(dispatchUrl, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "bean-match-worker-sync",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ ref: workflowRef }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    const permissionHint =
      response.status === 403
        ? " Fine-grained PAT는 repository Actions permission을 write로 줘야 합니다."
        : "";
    throw new Error(`GitHub Actions dispatch failed (${response.status}) - ${text || "unknown error"}${permissionHint}`);
  }

  latestMigrationState = {
    status: "queued",
    message: "GitHub Actions로 동기화를 넘겼습니다. 실행 대기 중입니다.",
    progress: 18,
    phase: "대기열 등록",
  };

  return refreshWorkflowRunStatus(env);
}

async function refreshWorkflowRunStatus(env: ReturnType<typeof getRuntimeEnv>): Promise<MigrationState> {
  const token = getGitHubWorkflowToken(env);
  if (!token) {
    return latestMigrationState;
  }

  const run = await fetchLatestNotionSyncRun(env, token);
  if (!run) {
    return latestMigrationState;
  }

  latestWorkflowRunId = run.id;

  if (run.status === "completed") {
    if (run.conclusion === "success") {
      revalidatePath("/users");
      revalidatePath("/matches");
      return {
        status: "success",
        message: `동기화 완료: GitHub Actions run #${run.id}`,
        progress: 100,
        phase: "완료",
      };
    }

    return {
      status: "error",
      message: `동기화 실패: GitHub Actions run #${run.id} (${run.conclusion ?? "unknown"})`,
      progress: 100,
      phase: "실패",
    };
  }

  return {
    status: "queued",
    message:
      run.status === "in_progress"
        ? `GitHub Actions run #${run.id} 에서 동기화 진행 중입니다.`
        : `GitHub Actions run #${run.id} 대기 중입니다.`,
    progress: run.status === "in_progress" ? 60 : 25,
    phase: run.status === "in_progress" ? "GitHub Actions 실행 중" : "GitHub Actions 대기 중",
  };
}

async function fetchLatestNotionSyncRun(env: ReturnType<typeof getRuntimeEnv>, token: string) {
  const workflowFile = env.NOTION_SYNC_WORKFLOW_FILE || "notion-sync.yml";
  const workflowRef = env.NOTION_SYNC_WORKFLOW_REF || "main";
  const runsUrl = new URL(
    `https://api.github.com/repos/${workflowRepository}/actions/workflows/${encodeURIComponent(workflowFile)}/runs`,
  );
  runsUrl.searchParams.set("event", "workflow_dispatch");
  runsUrl.searchParams.set("branch", workflowRef);
  runsUrl.searchParams.set("per_page", "10");

  const response = await fetch(runsUrl, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "bean-match-worker-sync",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as GitHubWorkflowRunsResponse;
  const dispatchAt = latestWorkflowDispatchAt ? Date.parse(latestWorkflowDispatchAt) : null;

  return (
    payload.workflow_runs.find((run) => run.id === latestWorkflowRunId) ??
    payload.workflow_runs.find((run) => {
      if (dispatchAt === null) return true;
      const createdAt = Date.parse(run.created_at);
      return Number.isFinite(createdAt) && createdAt >= dispatchAt - 30_000;
    }) ??
    null
  );
}

function getGitHubWorkflowToken(env: ReturnType<typeof getRuntimeEnv>) {
  return env.NOTION_SYNC_WORKFLOW_TOKEN || "";
}

function summarizeSources(users: NotionSyncResult["users"]) {
  const sourceCounts = new Map<string, number>();
  for (const user of users) {
    if (!user.source) continue;
    sourceCounts.set(user.source, (sourceCounts.get(user.source) ?? 0) + 1);
  }

  return [...sourceCounts.entries()].map(([source, count]) => `${source} ${count}건`).join(", ");
}
