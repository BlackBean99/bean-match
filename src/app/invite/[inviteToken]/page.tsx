import Link from "next/link";
import { confirmInviteAccessAction } from "@/app/invite-actions";
import { FormPendingFieldset } from "@/components/form-pending-fieldset";
import { FormSubmitButton } from "@/components/form-submit-button";
import { validateInviteAccessToken } from "@/lib/invite-token-repository";

export const dynamic = "force-dynamic";

type InvitePageProps = {
  params: Promise<{ inviteToken: string }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { inviteToken } = await params;
  const validation = await validateInviteAccessToken(inviteToken);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fffdf8_0%,#f5efe6_100%)] px-4 py-6 text-zinc-950 sm:px-5 sm:py-8">
      <section className="mx-auto grid w-full max-w-2xl gap-4">
        <header className="rounded-[32px] border border-[#efe3d7] bg-white/95 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c96a2b]">Blackbean Match</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-zinc-950">개인 초대 링크 확인</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            이 링크는 참가자 본인 전용입니다. 본인 확인 후 공개조회에 동의한 반대 성별 참가자 목록을 확인하고, 최대 3명까지
            호감을 선택할 수 있습니다.
          </p>
        </header>

        {!validation.ok ? (
          <section className="rounded-[32px] border border-red-100 bg-white/95 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6">
            <p className="text-sm font-bold text-[#b10606]">초대 링크를 확인할 수 없습니다</p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              링크가 올바르지 않거나 이미 만료 또는 해제되었습니다. 운영자에게 최신 개인 초대 링크를 다시 받아 주세요.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/" className="rounded-full bg-[#FF3131] px-4 py-2 text-sm font-bold text-white hover:bg-[#E00E0E]">
                홈으로
              </Link>
              <Link href="/onboarding" className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-bold text-zinc-700">
                온보딩으로 이동
              </Link>
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-[32px] border border-[#efe3d7] bg-white/95 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoCard label="초대 라벨" value={validation.label} />
                <InfoCard label="참가자 ID" value={validation.userId.toString()} />
              </div>

              <div className="mt-4 rounded-[24px] border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                이 링크는 다른 사람과 공유하지 마세요. 본인 확인을 완료하면 바로 참가자 선택 화면으로 이동합니다.
              </div>

              <form action={confirmInviteAccessAction} className="mt-5">
                <FormPendingFieldset className="grid gap-3">
                  <input type="hidden" name="inviteToken" value={inviteToken} />
                  <FormSubmitButton
                    label="본인이 맞습니다"
                    pendingLabel="확인 중..."
                    className="rounded-full bg-[#FF3131] px-5 py-3 text-sm font-bold text-white hover:bg-[#E00E0E]"
                  />
                </FormPendingFieldset>
              </form>
            </section>

            <section className="rounded-[32px] border border-[#efe3d7] bg-white/95 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6">
              <h2 className="text-lg font-bold text-zinc-950">진행 방식</h2>
              <ol className="mt-3 grid gap-3 text-sm leading-6 text-zinc-700">
                <li className="rounded-[20px] border border-[#f0e8df] bg-[#fcfaf7] px-4 py-3">
                  1. 링크를 연 뒤 본인 확인 버튼을 누릅니다.
                </li>
                <li className="rounded-[20px] border border-[#f0e8df] bg-[#fcfaf7] px-4 py-3">
                  2. 공개조회에 동의한 반대 성별 참가자만 보여집니다.
                </li>
                <li className="rounded-[20px] border border-[#f0e8df] bg-[#fcfaf7] px-4 py-3">
                  3. 최대 3명까지 선택해 호감을 제출합니다.
                </li>
              </ol>
            </section>
          </>
        )}
      </section>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-[#f0e8df] bg-[#fcfaf7] px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-2 break-all text-lg font-semibold tracking-[-0.03em] text-zinc-950">{value}</p>
    </div>
  );
}
