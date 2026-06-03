import { AppErrorView } from "@/components/app-error-view";
import { AdminAccessGate } from "@/components/admin-access-gate";
import { isAdminAccessConfigured, normalizeAdminAccessReturnPath } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

type AdminAccessPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminAccessPage({ searchParams }: AdminAccessPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const next = resolvedSearchParams.next;
  const returnPath = normalizeAdminAccessReturnPath(Array.isArray(next) ? next[0] : next);

  if (!isAdminAccessConfigured()) {
    return (
      <main className="min-h-screen bg-white px-5 py-8 text-zinc-950">
        <AppErrorView
          title="운영 접근 코드가 설정되지 않았습니다"
          description="`ADMIN_ACCESS_CODE` 환경 변수를 추가한 뒤 다시 접속해 주세요."
          showHomeButton={false}
        />
      </main>
    );
  }

  return <AdminAccessGate returnPath={returnPath} />;
}
