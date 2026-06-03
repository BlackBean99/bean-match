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
  users: { action?: string; source?: string }[];
};

const initialMigrationState: MigrationState = {
  status: "idle",
  message: "동기화 대기 중입니다.",
  progress: 0,
  phase: "대기",
};

let latestMigrationState: MigrationState = initialMigrationState;
let currentMigrationPromise: Promise<MigrationState> | null = null;

export async function runNotionMigration(): Promise<MigrationState> {
  const env = getRuntimeEnv();
  logMigrationEnvironment(env);

  if (currentMigrationPromise) {
    return latestMigrationState;
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
  return latestMigrationState;
}

function logMigrationEnvironment(env: ReturnType<typeof getRuntimeEnv>) {
  console.info(
    JSON.stringify({
      scope: "notion-sync",
      runtime: isCloudflareRuntime() ? "cloudflare" : "node",
      cloudflareTokenPresent: Boolean(env.CLOUDFLARE_API_TOKEN),
      cloudflareImagesTokenPresent: Boolean(env.CLOUDFLARE_IMAGES_TOKEN),
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
    const sourceSummary = summarizeSources(result.users);

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

function summarizeSources(users: NotionSyncResult["users"]) {
  const sourceCounts = new Map<string, number>();
  for (const user of users) {
    if (!user.source) continue;
    sourceCounts.set(user.source, (sourceCounts.get(user.source) ?? 0) + 1);
  }

  return [...sourceCounts.entries()].map(([source, count]) => `${source} ${count}건`).join(", ");
}
