import { redirect } from "next/navigation";
import { getOpsSession } from "@/lib/admin-access-server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getOpsSession();
  redirect(session ? "/matches" : "/admin-access");
}
