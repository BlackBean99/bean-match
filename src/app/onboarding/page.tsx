import { OnboardingForm } from "@/components/onboarding-form";

export const dynamic = "force-dynamic";

type OnboardingPageProps = {
  searchParams?: Promise<{ invitorId?: string }>;
};

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const invitorId = (await searchParams)?.invitorId;

  return (
    <main className="min-h-screen bg-white px-5 py-8 text-zinc-950">
      <OnboardingForm invitorId={invitorId} />
    </main>
  );
}
