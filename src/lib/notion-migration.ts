import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getRuntimeEnv } from "@/lib/runtime-env";

const execFileAsync = promisify(execFile);

export type MigrationState = {
  status: "idle" | "success" | "error" | "queued";
  message: string;
};

export async function runNotionMigration(): Promise<MigrationState> {
  const env = getRuntimeEnv();

  if (env.CF_PAGES_URL) {
    return dispatchNotionSyncWorkflow(env);
  }

  try {
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
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? `동기화 실패: ${error.message}` : "동기화 실패: 알 수 없는 오류",
    };
  }
}

async function dispatchNotionSyncWorkflow(env: ReturnType<typeof getRuntimeEnv>): Promise<MigrationState> {
  const token = env.NOTION_SYNC_GITHUB_TOKEN;
  if (!token) {
    return {
      status: "error",
      message:
        "동기화 실패: Cloudflare Pages production requires NOTION_SYNC_GITHUB_TOKEN to trigger the GitHub Actions sync workflow.",
    };
  }

  const repository = env.NOTION_SYNC_GITHUB_REPOSITORY || "BlackBean99/bean-match";
  const workflow = env.NOTION_SYNC_GITHUB_WORKFLOW || "notion-sync.yml";
  const ref = env.NOTION_SYNC_GITHUB_REF || "main";

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
      };
    }

    return {
      status: "queued",
      message: "동기화 요청을 GitHub Actions에 전달했습니다. 완료되면 Supabase 데이터가 갱신됩니다.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? `동기화 실패: ${error.message}` : "동기화 실패: 알 수 없는 오류",
    };
  }
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
