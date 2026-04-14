import type { ReactNode } from "react";
import { createOnboardingUserAction } from "@/app/round-actions";
import { openLevelLabels, type OpenLevel } from "@/lib/domain";

const openLevels: OpenLevel[] = ["PRIVATE", "SEMI_OPEN", "FULL_OPEN"];

type OnboardingFormProps = {
  invitorId?: string;
};

export function OnboardingForm({ invitorId }: OnboardingFormProps) {
  return (
    <section className="mx-auto w-full max-w-3xl rounded-lg border border-red-100 bg-white p-6 shadow-sm">
      <p className="text-sm font-bold text-[#E00E0E]">Blackbean Match</p>
      <h1 className="mt-2 text-3xl font-bold text-zinc-950">라운드 참여 정보 입력</h1>
      <p className="mt-2 text-sm leading-6 text-zinc-600">
        정보 입력 후 오픈 레벨을 선택하면 운영자가 다음 라운드 또는 큐레이션 매칭으로 배치합니다.
      </p>
      {invitorId ? (
        <p className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-[#E00E0E]">
          모집인 초대 링크로 들어왔습니다. 가입 출처는 운영자에게만 기록됩니다.
        </p>
      ) : null}
      <form action={createOnboardingUserAction} className="mt-6 grid gap-4">
        {invitorId ? <input type="hidden" name="invitorUserId" value={invitorId} /> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="이름">
            <input name="name" className={inputClassName} required />
          </Field>
          <Field label="성별">
            <select name="gender" defaultValue="UNDISCLOSED" className={inputClassName}>
              <option value="FEMALE">여성</option>
              <option value="MALE">남성</option>
              <option value="OTHER">기타</option>
              <option value="UNDISCLOSED">비공개</option>
            </select>
          </Field>
          <Field label="나이">
            <input name="ageText" className={inputClassName} placeholder="예: 32, 1994년생" />
          </Field>
          <Field label="키">
            <input name="heightCm" type="number" className={inputClassName} placeholder="cm" />
          </Field>
          <Field label="직업">
            <input name="jobTitle" className={inputClassName} />
          </Field>
          <Field label="오픈 레벨">
            <select name="openLevel" defaultValue="PRIVATE" className={inputClassName}>
              {openLevels.map((level) => (
                <option key={level} value={level}>
                  {openLevelLabels[level]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="자기소개">
          <textarea name="selfIntro" rows={4} className={inputClassName} />
        </Field>
        <Field label="이상형">
          <textarea name="idealTypeDescription" rows={4} className={inputClassName} />
        </Field>
        <button className="rounded-lg bg-[#FF3131] px-4 py-3 text-sm font-bold text-white hover:bg-[#E00E0E]">
          참여 신청
        </button>
      </form>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-zinc-600">
      {label}
      {children}
    </label>
  );
}

const inputClassName =
  "w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-[#FF3131] focus:ring-2 focus:ring-red-100";
