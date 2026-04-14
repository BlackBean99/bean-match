import { userStatusLabels, type UserStatus } from "@/lib/domain";

const statusClassName: Record<UserStatus, string> = {
  INCOMPLETE: "border-zinc-200 bg-zinc-100 text-zinc-600",
  READY: "border-red-200 bg-red-50 text-[#E00E0E]",
  PROGRESSING: "border-[#FF3131] bg-[#FF3131] text-white",
  HOLD: "border-amber-200 bg-amber-50 text-amber-700",
  STOP_REQUESTED: "border-red-200 bg-red-50 text-[#E00E0E]",
  ARCHIVED: "border-zinc-200 bg-zinc-50 text-zinc-500",
  BLOCKED: "border-zinc-900 bg-zinc-900 text-white",
};

type StatusBadgeProps = {
  status: UserStatus;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClassName[status]}`}
    >
      {userStatusLabels[status]}
    </span>
  );
}
