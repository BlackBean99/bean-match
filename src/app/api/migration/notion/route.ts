import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { runNotionMigration } from "@/lib/notion-migration";

export const dynamic = "force-dynamic";

export async function POST() {
  const result = await runNotionMigration();
  revalidatePath("/users");
  revalidatePath("/matches");

  return NextResponse.json(result, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
