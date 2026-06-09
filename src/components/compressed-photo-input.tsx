"use client";

import { useRef } from "react";
import { compressImageFile } from "@/lib/image-compression";

type CompressedPhotoInputProps = {
  name: string;
  className?: string;
  accept?: string;
  onCompressedFile?: (file: File) => void;
};

export function CompressedPhotoInput({
  name,
  className,
  accept = "image/jpeg,image/png,image/webp,image/gif",
  onCompressedFile,
}: CompressedPhotoInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <input
      ref={inputRef}
      name={name}
      type="file"
      accept={accept}
      className={className}
      onChange={async (event) => {
        const file = event.currentTarget.files?.[0];
        if (!file) return;

        const compressedFile = await compressImageFile(file);
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(compressedFile);

        if (inputRef.current) {
          inputRef.current.files = dataTransfer.files;
        }

        onCompressedFile?.(compressedFile);
      }}
    />
  );
}
