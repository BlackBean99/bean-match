import { AppErrorView } from "@/components/app-error-view";
import { OnboardingForm } from "@/components/onboarding-form";
import { getOnboardingAccessPageData } from "@/lib/onboarding-access-repository";

export const dynamic = "force-dynamic";

type OnboardingAccessPageProps = {
  params: Promise<{ token: string }>;
};

export default async function OnboardingAccessPage({ params }: OnboardingAccessPageProps) {
  const { token } = await params;
  const data = await getOnboardingAccessPageData(decodeURIComponent(token));

  if (!data.authorized) {
    return (
      <AppErrorView
        title="온보딩 링크를 확인할 수 없습니다"
        description={
          data.accessIssue === "database_unavailable"
            ? "토큰 저장소에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요."
            : "링크가 올바르지 않거나 이미 만료 또는 해제되었습니다. 운영자에게 새 링크를 요청해 주세요."
        }
        showHomeButton={false}
      />
    );
  }

  if (!data.userId || !data.defaultName) {
    return (
      <AppErrorView
        title="온보딩 대상을 확인할 수 없습니다"
        description={data.loadError ?? "온보딩 대상 사용자 정보를 찾지 못했습니다. 운영자에게 새 링크를 요청해 주세요."}
        showHomeButton={false}
      />
    );
  }

  return (
    <main className="min-h-screen bg-white px-5 py-8 text-zinc-950">
      <OnboardingForm accessToken={decodeURIComponent(token)} defaultName={data.defaultName} />
    </main>
  );
}
