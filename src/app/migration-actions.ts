"use server";

import { revalidatePath } from "next/cache";
import { runNotionMigration, type MigrationState } from "@/lib/notion-migration";

export async function runNotionMigrationAction(
  previousState: MigrationState,
  formData: FormData,
): Promise<MigrationState> {
  void previousState;
  void formData;

  const result = await runNotionMigration();
  revalidatePath("/users");
  revalidatePath("/matches");

  return result;
}
