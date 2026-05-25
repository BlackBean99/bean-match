export const dynamic = "force-dynamic";

type InvitePageProps = {
  params: Promise<{ invitorId: string }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { invitorId } = await params;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fffdf9_0%,#f6f4ef_100%)] px-4 py-6 text-zinc-950 sm:px-5 sm:py-8">
      <section className="mx-auto grid w-full max-w-2xl gap-4">
        <header className="rounded-[32px] border border-[#efe6dd] bg-white/95 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c96a2b]">Blackbean Match</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-zinc-950">모집인 초대 확인</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            이 주소는 모집인 출처를 기록하기 위한 안내 페이지입니다. 실제 자동 노출 입장은 운영자가 발급한 토큰 링크에서만
            진행됩니다.
          </p>
        </header>

        <section className="rounded-[32px] border border-[#efe6dd] bg-white/95 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[24px] border border-[#f0e8df] bg-[#fcfaf7] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">모집인 ID</p>
              <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-zinc-950">{invitorId}</p>
            </div>
            <div className="rounded-[24px] border border-[#f0e8df] bg-[#fcfaf7] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">다음 단계</p>
              <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-zinc-950">토큰 링크 수령 대기</p>
            </div>
          </div>

          <p className="mt-4 rounded-[24px] border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
            운영자가 `/users` 상세에서 발급한 `<code>/onboarding/access/{`{token}`}</code>` 링크를 전달받으면, 그 링크로 입장해
            이름과 자동 노출 옵션을 확인하면 됩니다.
          </p>
        </section>
      </section>
    </main>
  );
}
