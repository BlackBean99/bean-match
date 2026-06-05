import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAdminAccessAction } from "@/app/admin-access/actions";
import { FormPendingFieldset } from "@/components/form-pending-fieldset";
import { MigrationButton } from "@/components/migration-button";
import type { OpsRole } from "@/lib/admin-access";

type AdminShellProps = {
  title: string;
  description: string;
  active: "users" | "matches" | "rounds";
  canManage?: boolean;
  viewerName: string;
  viewerRole: OpsRole;
  children: ReactNode;
};

const navItems: Array<{
  key: "users" | "matches" | "rounds" | "onboarding";
  href: string;
  label: string;
  badge?: string;
}> = [
  { key: "matches", href: "/matches", label: "매칭 풀 관리", badge: "핵심" },
  { key: "rounds", href: "/rounds", label: "자동 노출 운영", badge: "신규" },
  { key: "users", href: "/users", label: "회원 관리" },
  { key: "onboarding", href: "/onboarding", label: "참여 링크" },
];

export function AdminShell({ title, description, active, canManage = false, viewerName, viewerRole, children }: AdminShellProps) {
  return (
    <main className="min-h-screen bg-transparent text-[#18181b]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-4 px-3 py-3 sm:px-4 sm:py-4 lg:flex-row lg:gap-5 lg:px-5 lg:py-5">
        <aside className="w-full shrink-0 overflow-hidden rounded-[28px] border border-white/10 bg-[#121720] text-white shadow-[0_30px_80px_rgba(15,23,42,0.35)] lg:sticky lg:top-5 lg:h-[calc(100vh-2.5rem)] lg:w-[272px] lg:rounded-[32px]">
          <div className="flex h-full flex-col px-4 py-4 sm:px-5 sm:py-5 lg:px-5 lg:py-6">
            <div>
              <Link href="/matches" className="inline-flex flex-col gap-1">
                <span className="text-[1.65rem] font-black tracking-[-0.06em] text-white sm:text-[2rem]">
                  bean-<span className="text-[#ff5d89]">match</span>
                </span>
                <span className="text-xs font-medium text-white/55">Match. Connect. Grow.</span>
              </Link>
            </div>

            <div className="mt-5 rounded-[22px] border border-white/10 bg-white/5 p-4 sm:mt-6 sm:rounded-[24px]">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-[radial-gradient(circle_at_top,#fafafa,#4b5563_58%,#111827)] text-sm font-bold">
                  bb
                </div>
                <div>
                  <p className="font-bold text-white">{viewerName}</p>
                  <div className="mt-1 inline-flex items-center rounded-full bg-[#ff5d89]/15 px-2.5 py-1 text-[11px] font-semibold text-[#ff8cab]">
                    {viewerRole === "ADMIN" ? "관리자" : "모집인"}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs text-white/60">등록된 운영 계정 세션</p>
            </div>

            <nav className="mt-5 flex gap-2 overflow-x-auto pb-1 lg:mt-8 lg:grid lg:gap-1.5 lg:overflow-visible lg:pb-0">
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

            <div className="mt-5 rounded-[22px] border border-white/10 bg-[#1a2230] p-4 sm:mt-6 sm:rounded-[24px] lg:mt-auto">
              <p className="text-sm font-semibold text-white/88">운영 메모</p>
              <p className="mt-2 text-xs leading-5 text-white/60">
                연락처는 CONNECTED 이전까지 숨김 유지. PROGRESSING 사용자는 새 소개 생성 금지.
              </p>
              <div className="mt-4 rounded-[18px] bg-white/5 p-3 sm:rounded-[20px]">
                <MigrationButton canManage={canManage} />
              </div>
              <form action={logoutAdminAccessAction} className="mt-3">
                <FormPendingFieldset className="contents">
                  <button
                    type="submit"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/78 transition hover:bg-white/10"
                  >
                    로그아웃
                  </button>
                </FormPendingFieldset>
              </form>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="grid gap-4 sm:gap-5">
            <header className="rounded-[28px] border border-white/80 bg-white/85 px-4 py-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur sm:rounded-[32px] sm:px-6 sm:py-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#ff5d89] sm:text-sm sm:tracking-[0.28em]">
                    Blackbean Match Ops
                  </p>
                  <h1 className="mt-3 text-2xl font-black tracking-[-0.04em] text-[#18181b] sm:text-3xl lg:text-4xl">{title}</h1>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500">{description}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <div className="inline-flex items-center rounded-2xl border border-[#ffd5df] bg-[#fff4f7] px-3 py-2 text-xs font-semibold text-[#e63a68] sm:px-4 sm:py-3 sm:text-sm">
                    {viewerRole === "ADMIN" ? "관리자 편집 권한" : "모집인 열람 전용"}
                  </div>
                  <div className="inline-flex h-10 items-center justify-center rounded-2xl border border-[#ececf2] bg-white px-3 text-xs font-semibold text-zinc-600 sm:h-12 sm:px-4 sm:text-sm">
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
          ? "flex min-w-fit items-center justify-between gap-2 rounded-[18px] bg-[linear-gradient(135deg,rgba(255,93,137,0.28),rgba(255,93,137,0.12))] px-3 py-2.5 text-sm font-semibold text-white lg:rounded-[20px] lg:px-4 lg:py-3"
          : "flex min-w-fit items-center justify-between gap-2 rounded-[18px] px-3 py-2.5 text-sm font-medium text-white/68 transition hover:bg-white/6 hover:text-white lg:rounded-[20px] lg:px-4 lg:py-3"
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
