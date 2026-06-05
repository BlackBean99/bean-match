import { redirect } from "next/navigation";
import { AppErrorView } from "@/components/app-error-view";
import { AdminAccessGate } from "@/components/admin-access-gate";
import { getOpsSession } from "@/lib/admin-access-server";
import { isOpsAuthConfiguredAsync, normalizeAdminAccessReturnPath } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

type AdminAccessPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminAccessPage({ searchParams }: AdminAccessPageProps) {
  const session = await getOpsSession();
  const resolvedSearchParams = (await searchParams) ?? {};
  const next = resolvedSearchParams.next;
  const returnPath = normalizeAdminAccessReturnPath(Array.isArray(next) ? next[0] : next);

  if (session) {
    redirect(returnPath);
  }

  if (!(await isOpsAuthConfiguredAsync())) {
    return (
      <main className="min-h-screen bg-white px-5 py-8 text-zinc-950">
        <AppErrorView
          title="운영 로그인 계정이 설정되지 않았습니다"
          description="`OPS_AUTH_SECRET`, `OPS_AUTH_ACCOUNTS_JSON` 환경 변수를 추가한 뒤 다시 접속해 주세요."
          showHomeButton={false}
        />
      </main>
    );
  }

  return <AdminAccessGate returnPath={returnPath} />;
}
