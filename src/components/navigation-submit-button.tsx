"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type NavigationSubmitButtonProps = {
  label: string;
  pendingLabel?: string;
  className?: string;
};

export function NavigationSubmitButton({
  label,
  pendingLabel,
  className,
}: NavigationSubmitButtonProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamString = searchParams.toString();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setPending(false);
  }, [pathname, searchParamString]);

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={className}
      onClick={() => setPending(true)}
    >
      {pending ? pendingLabel ?? `${label} 중...` : label}
    </button>
  );
}
