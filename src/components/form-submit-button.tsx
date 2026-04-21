"use client";

import { useFormStatus } from "react-dom";

type FormSubmitButtonProps = {
  label: string;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
  type?: "submit" | "button";
};

export function FormSubmitButton({
  label,
  pendingLabel,
  className,
  disabled = false,
  type = "submit",
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button type={type} disabled={disabled || pending} aria-busy={pending} className={className}>
      {pending ? pendingLabel ?? `${label} 중...` : label}
    </button>
  );
}
