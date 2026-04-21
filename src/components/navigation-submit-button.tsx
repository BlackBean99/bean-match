"use client";

import { useState } from "react";

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
  const [pending, setPending] = useState(false);

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
