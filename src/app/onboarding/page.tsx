import { AppErrorView } from "@/components/app-error-view";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  return (
    <main className="min-h-screen bg-white px-5 py-8 text-zinc-950">
      <AppErrorView
        title="토큰 링크가 필요합니다"
        description="이 주소는 직접 입력용이 아닙니다. 운영자가 `/users` 상세 화면에서 발급한 전용 `/onboarding/access/{token}` 링크로만 입장할 수 있습니다."
        showHomeButton={false}
      />
    </main>
  );
}
