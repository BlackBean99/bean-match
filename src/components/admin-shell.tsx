import Link from "next/link";
import type { ReactNode } from "react";
import { MigrationButton } from "@/components/migration-button";

type AdminShellProps = {
  title: string;
  description: string;
  active: "users" | "matches" | "rounds";
  children: ReactNode;
};

export function AdminShell({ title, description, active, children }: AdminShellProps) {
  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-5 py-6">
        <header className="rounded-lg border border-red-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#E00E0E]">Blackbean Match Ops</p>
              <h1 className="mt-2 text-3xl font-bold text-zinc-950">{title}</h1>
              <p className="mt-2 text-sm text-zinc-600">{description}</p>
            </div>
            <nav className="flex flex-wrap gap-2">
              <NavLink href="/users" active={active === "users"}>
                사용자
              </NavLink>
              <NavLink href="/matches" active={active === "matches"}>
                매칭
              </NavLink>
              <NavLink href="/rounds" active={active === "rounds"}>
                라운드
              </NavLink>
              <NavLink href="/onboarding" active={false}>
                온보딩
              </NavLink>
            </nav>
          </div>
          <div className="mt-5 max-w-md">
            <MigrationButton />
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-lg bg-[#FF3131] px-4 py-2 text-sm font-bold text-white"
          : "rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-zinc-600 hover:border-red-200 hover:text-[#E00E0E]"
      }
    >
      {children}
    </Link>
  );
}
