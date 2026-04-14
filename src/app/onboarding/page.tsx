import { OnboardingForm } from "@/components/onboarding-form";

export const dynamic = "force-dynamic";

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-white px-5 py-8 text-zinc-950">
      <OnboardingForm />
    </main>
  );
}
