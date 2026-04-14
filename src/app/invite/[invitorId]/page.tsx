import { OnboardingForm } from "@/components/onboarding-form";

export const dynamic = "force-dynamic";

type InvitePageProps = {
  params: Promise<{ invitorId: string }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { invitorId } = await params;

  return (
    <main className="min-h-screen bg-white px-5 py-8 text-zinc-950">
      <OnboardingForm invitorId={invitorId} />
    </main>
  );
}
