import Link from "next/link";
import type { ReactNode } from "react";
import { MigrationButton } from "@/components/migration-button";

type AdminShellProps = {
  title: string;
  description: string;
  active: "users" | "matches" | "rounds";
  children: ReactNode;
};

const navItems: Array<{
  key: "users" | "matches" | "rounds" | "onboarding";
  href: string;
  label: string;
  badge?: string;
}> = [
  { key: "matches", href: "/matches", label: "매칭 풀 관리", badge: "핵심" },
  { key: "rounds", href: "/rounds", label: "매칭 제안 관리" },
  { key: "users", href: "/users", label: "회원 관리" },
  { key: "onboarding", href: "/onboarding", label: "온보딩 플로우" },
];

export function AdminShell({ title, description, active, children }: AdminShellProps) {
  return (
    <main className="min-h-screen bg-transparent text-[#18181b]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-5 px-4 py-4 lg:flex-row lg:px-5 lg:py-5">
        <aside className="w-full shrink-0 overflow-hidden rounded-[32px] border border-white/10 bg-[#121720] text-white shadow-[0_30px_80px_rgba(15,23,42,0.35)] lg:sticky lg:top-5 lg:h-[calc(100vh-2.5rem)] lg:w-[272px]">
          <div className="flex h-full flex-col px-5 py-6">
            <div>
              <Link href="/matches" className="inline-flex flex-col gap-1">
                <span className="text-[2rem] font-black tracking-[-0.06em] text-white">
                  bean-<span className="text-[#ff5d89]">match</span>
                </span>
                <span className="text-xs font-medium text-white/55">Match. Connect. Grow.</span>
              </Link>
            </div>

            <div className="mt-8 rounded-[24px] border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-[radial-gradient(circle_at_top,#fafafa,#4b5563_58%,#111827)] text-sm font-bold">
                  bb
                </div>
                <div>
                  <p className="font-bold text-white">blackbean</p>
                  <div className="mt-1 inline-flex items-center rounded-full bg-[#ff5d89]/15 px-2.5 py-1 text-[11px] font-semibold text-[#ff8cab]">
                    매니저
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs text-white/60">모집인 코드: BB1001</p>
            </div>

            <nav className="mt-8 grid gap-1.5">
              {navItems.map((item) => (
                <NavLink
                  key={item.key}
                  href={item.href}
                  active={item.key === active}
                  badge={item.badge}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="mt-auto rounded-[24px] border border-white/10 bg-[#1a2230] p-4">
              <p className="text-sm font-semibold text-white/88">운영 메모</p>
              <p className="mt-2 text-xs leading-5 text-white/60">
                연락처는 CONNECTED 이전까지 숨김 유지. PROGRESSING 사용자는 새 소개 생성 금지.
              </p>
              <div className="mt-4 rounded-[20px] bg-white/5 p-3">
                <MigrationButton />
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="grid gap-5">
            <header className="rounded-[32px] border border-white/80 bg-white/85 px-6 py-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.28em] text-[#ff5d89]">Blackbean Match Ops</p>
                  <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[#18181b] lg:text-4xl">{title}</h1>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500">{description}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center rounded-2xl border border-[#ffd5df] bg-[#fff4f7] px-4 py-3 text-sm font-semibold text-[#e63a68]">
                    내 프로필 전체 오픈
                  </div>
                  <div className="inline-flex h-12 items-center justify-center rounded-2xl border border-[#ececf2] bg-white px-4 text-sm font-semibold text-zinc-600">
                    운영 중
                  </div>
                </div>
              </div>
            </header>

            {children}
          </div>
        </div>
      </div>
    </main>
  );
}

function NavLink({
  href,
  active,
  badge,
  children,
}: {
  href: string;
  active: boolean;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "flex items-center justify-between rounded-[20px] bg-[linear-gradient(135deg,rgba(255,93,137,0.28),rgba(255,93,137,0.12))] px-4 py-3 text-sm font-semibold text-white"
          : "flex items-center justify-between rounded-[20px] px-4 py-3 text-sm font-medium text-white/68 transition hover:bg-white/6 hover:text-white"
      }
    >
      <span>{children}</span>
      {badge ? (
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#ff9eb7]">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
