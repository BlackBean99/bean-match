declare module "../../scripts/sync-notion-to-supabase.mjs" {
  export type SyncProgressUpdate = {
    progress: number;
    phase: string;
    message: string;
  };

  export type SyncResult = {
    write: boolean;
    users: { action?: string; source?: string; reason?: string }[];
  };

  export function runNotionSync(options?: {
    write?: boolean;
    onProgress?: (update: SyncProgressUpdate) => void;
  }): Promise<SyncResult>;
}
