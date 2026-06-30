import type { Metadata } from "next";
import { PublicApplicationForm } from "@/components/public-application-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blackbean Match | 외부 신청",
  description: "외부인이 제출하는 공개 신청 페이지입니다. 승인 전까지는 승인 대기 상태로 보관됩니다.",
};

export default function ApplyPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,240,230,0.95),transparent_38%),linear-gradient(180deg,#fff7f2_0%,#f8fafc_100%)] px-4 py-8 text-zinc-950 sm:px-6 sm:py-10">
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-[32px] border border-white/80 bg-white/85 p-6 shadow-[0_28px_120px_rgba(15,23,42,0.14)] backdrop-blur">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E00E0E]">Blackbean Match</p>
          <h2 className="mt-4 text-4xl font-black tracking-[-0.06em] text-zinc-950">공개 신청</h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-600">
            외부 신청자는 제출 후 바로 풀에 노출되지 않습니다. 운영자가 확인하고 승인하면 내부 풀로 편입됩니다.
          </p>
          <div className="mt-6 grid gap-3">
            <InfoCard title="승인 대기" body="제출 즉시 `INCOMPLETE` 상태로 저장되어 운영자 검토를 기다립니다." />
            <InfoCard title="사진 포함" body="사진은 파일 업로드로 함께 제출되며, 저장 후 프로필 검토에 사용됩니다." />
            <InfoCard title="승인 후 편입" body="승인되면 `READY` 로 전환되어 내부 풀과 매칭 흐름에 들어갑니다." />
          </div>
        </section>

        <PublicApplicationForm />
      </div>
    </main>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-[24px] border border-[#f3e3d6] bg-[#fffaf5] px-4 py-4">
      <p className="text-sm font-bold text-[#c96a2b]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{body}</p>
    </article>
  );
}
