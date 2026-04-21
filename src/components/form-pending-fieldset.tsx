"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type FormPendingFieldsetProps = {
  children: ReactNode;
  className?: string;
};

export function FormPendingFieldset({ children, className }: FormPendingFieldsetProps) {
  const { pending } = useFormStatus();

  return (
    <fieldset disabled={pending} aria-busy={pending} className={className}>
      {children}
    </fieldset>
  );
}
