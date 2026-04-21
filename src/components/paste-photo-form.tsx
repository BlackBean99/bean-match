"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { addUserPhotoAction } from "@/app/actions";
import { FormPendingFieldset } from "@/components/form-pending-fieldset";
import { FormSubmitButton } from "@/components/form-submit-button";

type PastePhotoFormProps = {
  userId: number;
  defaultSortOrder: number;
};

export function PastePhotoForm({ userId, defaultSortOrder }: PastePhotoFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const applyFile = (file: File) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    if (fileInputRef.current) {
      fileInputRef.current.files = dataTransfer.files;
    }
    if (nameInputRef.current && !nameInputRef.current.value) {
      nameInputRef.current.value = file.name || "clipboard-image";
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setFileName(file.name || "clipboard-image");
  };

  return (
    <form action={addUserPhotoAction} className="mt-5 grid gap-3 rounded-lg border border-red-100 bg-red-50/60 p-4">
      <FormPendingFieldset className="grid gap-3">
        <input type="hidden" name="userId" value={userId} />
        <div
          className="grid min-h-28 place-items-center rounded-lg border border-dashed border-red-200 bg-white px-4 py-5 text-center outline-none focus:border-[#FF3131] focus:ring-2 focus:ring-red-100"
          onPaste={(event) => {
            const imageFile = Array.from(event.clipboardData.items)
              .find((item) => item.type.startsWith("image/"))
              ?.getAsFile();
            if (imageFile) {
              event.preventDefault();
              applyFile(imageFile);
            }
          }}
          tabIndex={0}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={fileName ?? "붙여넣은 사진"} className="max-h-48 rounded-lg object-contain" />
          ) : (
            <div>
              <p className="text-sm font-bold text-zinc-950">여기에 클릭한 뒤 이미지를 붙여넣으세요.</p>
              <p className="mt-1 text-xs text-zinc-500">URL 입력 또는 파일 선택도 함께 지원합니다.</p>
            </div>
          )}
        </div>
        <Field label="이미지 파일">
          <input
            ref={fileInputRef}
            name="photoFile"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className={inputClassName}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) applyFile(file);
            }}
          />
        </Field>
        <Field label="새 사진 URL">
          <input name="url" type="url" placeholder="https://..." className={inputClassName} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
          <Field label="파일명">
            <input ref={nameInputRef} name="originalFileName" className={inputClassName} />
          </Field>
          <Field label="순서">
            <input name="sortOrder" type="number" defaultValue={defaultSortOrder} className={inputClassName} />
          </Field>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-700">
          <input type="checkbox" name="isMain" />
          대표 사진으로 지정
        </label>
        <FormSubmitButton
          label="사진 추가"
          pendingLabel="사진 추가 중..."
          className={`${primaryButtonClassName} disabled:cursor-not-allowed disabled:bg-zinc-300`}
        />
      </FormPendingFieldset>
    </form>
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

const primaryButtonClassName = "rounded-lg bg-[#FF3131] px-4 py-2 text-sm font-bold text-white hover:bg-[#E00E0E]";
