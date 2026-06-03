import { getRuntimeEnv, isCloudflareRuntime } from "@/lib/runtime-env";
import { createRequire } from "node:module";

export type MigrationState = {
  status: "idle" | "success" | "error" | "queued";
  message: string;
  progress?: number;
  phase?: string;
};

type NotionSyncWorkflowSettings = {
  token: string;
  repository: string;
  workflow: string;
  ref: string;
};

type GitHubWorkflowRun = {
  status: "queued" | "in_progress" | "completed";
  conclusion: string | null;
  html_url: string;
  display_title?: string;
  created_at: string;
  updated_at: string;
};

export async function runNotionMigration(): Promise<MigrationState> {
  const env = getRuntimeEnv();
  const runtime = isCloudflarePagesRuntime(env) ? "cloudflare" : "node";
  logMigrationEnvironment(runtime, env);

  if (runtime === "cloudflare") {
    return dispatchNotionSyncWorkflow(getNotionSyncWorkflowSettings(env));
  }

  try {
    const { execFile } = createRequire(import.meta.url)("node:child_process") as typeof import("child_process");
    const { promisify } = createRequire(import.meta.url)("node:util") as typeof import("util");
    const execFileAsync = promisify(execFile);
    const { stdout } = await execFileAsync("node", ["scripts/sync-notion-to-supabase.mjs", "--write"], {
      cwd: process.cwd(),
      env: process.env,
      maxBuffer: 1024 * 1024 * 10,
      timeout: 120000,
    });
    const result = parseMigrationOutput(stdout);

    return {
      status: "success",
      message: `동기화 완료: 생성 ${result.created}건, 업데이트 ${result.updated}건, 건너뜀 ${result.skipped}건${result.sourceSummary ? ` (${result.sourceSummary})` : ""}`,
      progress: 100,
      phase: "완료",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? `동기화 실패: ${error.message}` : "동기화 실패: 알 수 없는 오류",
      progress: 100,
      phase: "실패",
    };
  }
}

export async function getNotionMigrationStatus(): Promise<MigrationState> {
  const env = getRuntimeEnv();
  const settings = getNotionSyncWorkflowSettings(env);

  if (!settings.token) {
    return {
      status: "error",
      message:
        "동기화 상태 확인 실패: Cloudflare Pages production requires NOTION_SYNC_GITHUB_TOKEN to inspect the GitHub Actions sync workflow.",
      progress: 100,
      phase: "설정 필요",
    };
  }

  try {
    const run = await fetchLatestNotionSyncRun(settings);

    if (!run) {
      return {
        status: "queued",
        message: "동기화 실행 기록을 확인하는 중입니다.",
        progress: 65,
        phase: "대기 중",
      };
    }

    if (run.status !== "completed") {
      return {
        status: "queued",
        message:
          run.status === "in_progress"
            ? "GitHub Actions에서 동기화가 진행 중입니다."
            : "GitHub Actions에서 동기화 대기 중입니다.",
        progress: run.status === "in_progress" ? 85 : 65,
        phase: run.status === "in_progress" ? "실행 중" : "대기 중",
      };
    }

    if (run.conclusion === "success") {
      return {
        status: "success",
        message: "동기화 완료",
        progress: 100,
        phase: "완료",
      };
    }

    return {
      status: "error",
      message: `동기화 실패: GitHub Actions run concluded as ${run.conclusion || "unknown"}`,
      progress: 100,
      phase: "실패",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? `동기화 상태 확인 실패: ${error.message}` : "동기화 상태 확인 실패: 알 수 없는 오류",
      progress: 100,
      phase: "실패",
    };
  }
}

function logMigrationEnvironment(
  runtime: "cloudflare" | "node",
  env: ReturnType<typeof getRuntimeEnv>,
) {
  console.info(
    JSON.stringify({
      scope: "notion-sync",
      runtime,
      cloudflareTokenPresent: Boolean(env.NOTION_SYNC_GITHUB_TOKEN),
      cloudflareRepositoryPresent: Boolean(env.NOTION_SYNC_GITHUB_REPOSITORY),
      cloudflareWorkflowPresent: Boolean(env.NOTION_SYNC_GITHUB_WORKFLOW),
      cloudflareRefPresent: Boolean(env.NOTION_SYNC_GITHUB_REF),
      cloudflareImagesAccountIdPresent: Boolean(env.CLOUDFLARE_IMAGES_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID),
      cloudflareApiTokenPresent: Boolean(env.CLOUDFLARE_API_TOKEN),
      notionTokenPresent: Boolean(env.NOTION_TOKEN),
      supabaseUrlPresent: Boolean(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL),
      supabaseServiceRoleKeyPresent: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
      databaseUrlPresent: Boolean(env.DATABASE_URL),
    }),
  );
}

function getNotionSyncWorkflowSettings(env: ReturnType<typeof getRuntimeEnv>): NotionSyncWorkflowSettings {
  return {
    token: env.NOTION_SYNC_GITHUB_TOKEN || "",
    repository: env.NOTION_SYNC_GITHUB_REPOSITORY || "BlackBean99/bean-match",
    workflow: env.NOTION_SYNC_GITHUB_WORKFLOW || "notion-sync.yml",
    ref: env.NOTION_SYNC_GITHUB_REF || "main",
  };
}

function isCloudflarePagesRuntime(env: ReturnType<typeof getRuntimeEnv>) {
  return Boolean(env.CF_PAGES || env.CF_PAGES_URL || env.CF_PAGES_BRANCH || isCloudflareRuntime());
}

async function dispatchNotionSyncWorkflow(settings: NotionSyncWorkflowSettings): Promise<MigrationState> {
  const { token, repository, workflow, ref } = settings;
  if (!token) {
    return {
      status: "error",
      message:
        "동기화 실패: Cloudflare Pages production requires NOTION_SYNC_GITHUB_TOKEN to trigger the GitHub Actions sync workflow.",
      progress: 100,
      phase: "설정 필요",
    };
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${repository}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ ref }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
    return {
      status: "error",
      message: `동기화 실패: GitHub Actions dispatch failed (${response.status} ${response.statusText})${body ? ` - ${body.slice(0, 200)}` : ""}`,
      progress: 100,
      phase: "실패",
    };
  }

    return {
      status: "queued",
      message: "동기화 요청 완료. GitHub Actions에서 처리합니다.",
      progress: 65,
      phase: "대기 중",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? `동기화 실패: ${error.message}` : "동기화 실패: 알 수 없는 오류",
      progress: 100,
      phase: "실패",
    };
  }
}

async function fetchLatestNotionSyncRun(settings: NotionSyncWorkflowSettings): Promise<GitHubWorkflowRun | null> {
  const response = await fetch(
    `https://api.github.com/repos/${settings.repository}/actions/workflows/${encodeURIComponent(settings.workflow)}/runs?event=workflow_dispatch&branch=${encodeURIComponent(settings.ref)}&per_page=1`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${settings.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub Actions workflow run lookup failed (${response.status} ${response.statusText})${body ? ` - ${body.slice(0, 200)}` : ""}`);
  }

  const payload = (await response.json()) as { workflow_runs?: GitHubWorkflowRun[] };
  return payload.workflow_runs?.[0] ?? null;
}

function parseMigrationOutput(stdout: string) {
  const parsed = JSON.parse(stdout || "{}") as { users?: { action?: string; source?: string }[] };
  const users = parsed.users ?? [];
  const sourceCounts = new Map<string, number>();
  for (const user of users) {
    if (!user.source) continue;
    sourceCounts.set(user.source, (sourceCounts.get(user.source) ?? 0) + 1);
  }

  return {
    created: users.filter((user) => user.action === "created").length,
    updated: users.filter((user) => user.action === "updated").length,
    skipped: users.filter((user) => user.action === "skipped").length,
    sourceSummary: [...sourceCounts.entries()].map(([source, count]) => `${source} ${count}건`).join(", "),
  };
}
