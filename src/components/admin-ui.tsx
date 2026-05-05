import type { ReactNode } from "react";

export const adminPanelClassName =
  "rounded-[28px] border border-white/80 bg-white/95 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur";

export const adminMutedPanelClassName =
  "rounded-[28px] border border-[#ffd5df] bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(255,242,246,0.95))] shadow-[0_24px_70px_rgba(255,49,49,0.08)]";

export const adminTablePanelClassName = "overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)]";

export const adminInputClassName =
  "h-11 w-full min-w-0 rounded-2xl border border-[#e5e7eb] bg-white px-4 text-sm text-[#18181b] outline-none transition placeholder:text-zinc-400 focus:border-[#ff4f7a] focus:ring-4 focus:ring-[#ffe3eb] disabled:bg-zinc-100";

export const adminSmallInputClassName =
  "h-10 rounded-2xl border border-[#e5e7eb] bg-white px-3 text-sm text-[#18181b] outline-none transition focus:border-[#ff4f7a] focus:ring-4 focus:ring-[#ffe3eb] disabled:bg-zinc-100";

export const adminPrimaryButtonClassName =
  "inline-flex h-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#ff4f7a,#ff6a3d)] px-4 text-sm font-bold text-white shadow-[0_18px_35px_rgba(255,79,122,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_40px_rgba(255,79,122,0.34)] disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none";

export const adminSecondaryButtonClassName =
  "inline-flex h-11 items-center justify-center rounded-2xl border border-[#e5e7eb] bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:border-[#ffc6d5] hover:text-[#e63a68]";

export function AdminSection({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`${adminPanelClassName} ${className}`}>{children}</section>;
}

export function AdminMutedSection({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`${adminMutedPanelClassName} ${className}`}>{children}</section>;
}

export function AdminTableSection({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`${adminTablePanelClassName} ${className}`}>{children}</section>;
}

export function AdminStatCard({
  label,
  value,
  detail,
  tone = "pink",
}: {
  label: string;
  value: number | string;
  detail?: string;
  tone?: "pink" | "green" | "amber" | "blue";
}) {
  const toneClassName =
    tone === "green"
      ? "bg-[#ecfff2] text-[#22a95f]"
      : tone === "amber"
        ? "bg-[#fff7ea] text-[#f59e0b]"
        : tone === "blue"
          ? "bg-[#eff6ff] text-[#3b82f6]"
          : "bg-[#fff0f4] text-[#ff4f7a]";

  return (
    <article className="rounded-[24px] border border-[#f1f5f9] bg-white p-5 shadow-[0_16px_35px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-500">{label}</p>
          <p className="mt-2 text-[2rem] font-black tracking-[-0.04em] text-[#18181b]">{value}</p>
        </div>
        <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl text-lg ${toneClassName}`}>
          {tone === "green" ? "🔓" : tone === "amber" ? "⏳" : tone === "blue" ? "👤" : "❤"}
        </span>
      </div>
      {detail ? <p className="mt-3 text-xs leading-5 text-zinc-500">{detail}</p> : null}
    </article>
  );
}
