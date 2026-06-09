import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireAdminOpsSession } from "@/lib/admin-access-server";
import { getNotionMigrationStatus, runNotionMigration } from "@/lib/notion-migration";

export const dynamic = "force-dynamic";

export async function POST() {
  await requireAdminOpsSession();
  const result = await runNotionMigration();
  if (result.status !== "queued") {
    revalidatePath("/users");
    revalidatePath("/matches");
  }

  return NextResponse.json(result, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  await requireAdminOpsSession();
  const dispatchedAt = new URL(request.url).searchParams.get("dispatchedAt") ?? undefined;
  const result = await getNotionMigrationStatus(dispatchedAt);
  return NextResponse.json(result, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
