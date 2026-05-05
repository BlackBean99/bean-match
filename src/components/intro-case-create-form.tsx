"use client";

import { useActionState, useEffect, useRef } from "react";
import { createIntroCaseWithStateAction, type IntroCaseActionState } from "@/app/actions";
import { FormPendingFieldset } from "@/components/form-pending-fieldset";
import { FormSubmitButton } from "@/components/form-submit-button";
import type { DashboardUser, IntroStatus } from "@/lib/domain";

type IntroCaseCreateFormProps = {
  users: DashboardUser[];
  invitors: DashboardUser[];
  introStatuses: ReadonlyArray<{ value: IntroStatus; label: string }>;
  inputClassName: string;
  fieldClassName: string;
  buttonClassName: string;
  disabled: boolean;
};

const initialState: IntroCaseActionState = {
  error: null,
  success: null,
  values: {
    personAId: "",
    personBId: "",
    invitorUserId: "",
    status: "OFFERED",
    memo: "",
  },
};

export function IntroCaseCreateForm({
  users,
  invitors,
  introStatuses,
  inputClassName,
  fieldClassName,
  buttonClassName,
  disabled,
}: IntroCaseCreateFormProps) {
  const [state, formAction] = useActionState(createIntroCaseWithStateAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.success) return;
    formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
      <FormPendingFieldset className="grid min-w-0 gap-3 sm:col-span-2 sm:grid-cols-2">
        {state.error ? (
          <p className="sm:col-span-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-[#b10606]">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="sm:col-span-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {state.success}
          </p>
        ) : null}

        <label className={fieldClassName}>
          참여자 A
          <select
            name="personAId"
            required
            defaultValue={state.values.personAId}
            className={inputClassName}
          >
            <option value="">선택</option>
            {invitors.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} · {user.gender} · {formatAge(user)}
              </option>
            ))}
          </select>
        </label>

        <label className={fieldClassName}>
          참여자 B
          <select
            name="personBId"
            required
            defaultValue={state.values.personBId}
            className={inputClassName}
          >
            <option value="">선택</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} · {user.gender} · {formatAge(user)}
              </option>
            ))}
          </select>
        </label>

        <label className={fieldClassName}>
          주선자
          <select
            name="invitorUserId"
            defaultValue={state.values.invitorUserId}
            className={inputClassName}
          >
            <option value="">미지정</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} · {user.gender} · {formatAge(user)}
              </option>
            ))}
          </select>
        </label>

        <label className={fieldClassName}>
          상태
          <select name="status" defaultValue={state.values.status} className={inputClassName}>
            {introStatuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>

        <div className="sm:col-span-2">
          <label className={fieldClassName}>
            메모
            <textarea
              name="memo"
              rows={3}
              defaultValue={state.values.memo}
              className={inputClassName}
            />
          </label>
        </div>

        <FormSubmitButton
          label="매칭 기록 추가"
          pendingLabel="추가 중..."
          disabled={disabled}
          className={`${buttonClassName} sm:col-span-2`}
        />
      </FormPendingFieldset>
    </form>
  );
}

function formatAge(user: DashboardUser) {
  if (user.age > 0 && user.ageText) return `${user.age}세 (${user.ageText})`;
  if (user.age > 0) return `${user.age}세`;
  if (user.ageText) return user.ageText;
  return "-";
}
