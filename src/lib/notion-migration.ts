import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type MigrationState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function runNotionMigration(): Promise<MigrationState> {
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
      message: `동기화 완료: 생성 ${result.created}건, 업데이트 ${result.updated}건, 건너뜀 ${result.skipped}건`,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? `동기화 실패: ${error.message}` : "동기화 실패: 알 수 없는 오류",
    };
  }
}

function parseMigrationOutput(stdout: string) {
  const parsed = JSON.parse(stdout || "{}") as { users?: { action?: string }[] };
  const users = parsed.users ?? [];

  return {
    created: users.filter((user) => user.action === "created").length,
    updated: users.filter((user) => user.action === "updated").length,
    skipped: users.filter((user) => user.action === "skipped").length,
  };
}
