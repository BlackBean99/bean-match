"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOpsSession } from "@/lib/admin-access-server";
import { runNotionMigration, type MigrationState } from "@/lib/notion-migration";

export async function runNotionMigrationAction(
  previousState: MigrationState,
  formData: FormData,
): Promise<MigrationState> {
  void previousState;
  void formData;
  await requireAdminOpsSession();

  const result = await runNotionMigration();
  if (result.status !== "queued") {
    revalidatePath("/users");
    revalidatePath("/matches");
  }

  return result;
}
