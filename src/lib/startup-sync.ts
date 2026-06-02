import { runNotionMigration } from "@/lib/notion-migration";

const startupSyncState = globalThis as typeof globalThis & {
  __beanMatchStartupSync?: Promise<void> | null;
  __beanMatchStartupSyncStarted?: boolean;
};

export function scheduleInitialNotionSync() {
  if (startupSyncState.__beanMatchStartupSyncStarted) return startupSyncState.__beanMatchStartupSync;
  startupSyncState.__beanMatchStartupSyncStarted = true;

  startupSyncState.__beanMatchStartupSync = Promise.resolve()
    .then(async () => {
      const enabled = process.env.AUTO_SYNC_ON_START !== "false";
      if (!enabled) return;

      const result = await runNotionMigration();
      console.info(
        JSON.stringify({
          scope: "startup-sync",
          status: result.status,
          message: result.message,
        }),
      );
    })
    .catch((error) => {
      console.error(
        JSON.stringify({
          scope: "startup-sync",
          status: "error",
          message: error instanceof Error ? error.message : "알 수 없는 오류",
        }),
      );
    });

  return startupSyncState.__beanMatchStartupSync;
}
