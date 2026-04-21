"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type { DashboardUserPhoto } from "@/lib/domain";

type ParticipantPhotoGalleryProps = {
  name: string;
  photos: DashboardUserPhoto[];
  fallbackUrl?: string;
};

export function ParticipantPhotoGallery({ name, photos, fallbackUrl }: ParticipantPhotoGalleryProps) {
  const galleryPhotos = useMemo(() => {
    if (photos.length > 0) return photos;
    if (!fallbackUrl) return [];

    return [
      {
        id: 0,
        url: fallbackUrl,
        sourceUrl: fallbackUrl,
        originalFileName: `${name} 사진`,
        isMain: true,
        sortOrder: 0,
        uploadedAt: "",
      },
    ] satisfies DashboardUserPhoto[];
  }, [fallbackUrl, name, photos]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const selectedPhoto = galleryPhotos[selectedIndex] ?? null;

  if (!selectedPhoto) {
    return (
      <div className="flex h-full items-center justify-center text-[11px] font-semibold text-zinc-400">
        사진 없음
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsViewerOpen(true)}
        className="relative block h-full w-full overflow-hidden rounded-md"
      >
        <Image
          src={selectedPhoto.url}
          alt={`${name} 사진 ${selectedIndex + 1}`}
          fill
          sizes="(max-width: 640px) 116px, 144px"
          className="object-cover"
          unoptimized
        />
        {galleryPhotos.length > 1 ? (
          <span className="absolute bottom-1 right-1 rounded-full bg-black/70 px-2 py-1 text-[10px] font-bold text-white">
            {selectedIndex + 1}/{galleryPhotos.length}
          </span>
        ) : null}
      </button>

      {galleryPhotos.length > 1 ? (
        <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
          {galleryPhotos.map((photo, index) => (
            <button
              key={`${photo.id}-${index}`}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className={`relative h-12 w-10 shrink-0 overflow-hidden rounded-md border ${
                index === selectedIndex ? "border-[#FF3131]" : "border-zinc-200"
              }`}
            >
              <Image
                src={photo.url}
                alt={`${name} 썸네일 ${index + 1}`}
                fill
                sizes="40px"
                className="object-cover"
                unoptimized
              />
            </button>
          ))}
        </div>
      ) : null}

      {isViewerOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md overflow-hidden rounded-lg bg-white">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <p className="truncate text-sm font-bold text-zinc-950">{name} 사진</p>
              <button type="button" onClick={() => setIsViewerOpen(false)} className="text-sm font-bold text-zinc-500">
                닫기
              </button>
            </div>
            <div className="relative aspect-[3/4] bg-black">
              <Image
                src={selectedPhoto.url}
                alt={`${name} 사진 크게 보기 ${selectedIndex + 1}`}
                fill
                sizes="(max-width: 768px) 100vw, 480px"
                className="object-contain"
                unoptimized
              />
            </div>
            {galleryPhotos.length > 1 ? (
              <div className="flex items-center justify-between gap-2 border-t border-zinc-200 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setSelectedIndex((selectedIndex - 1 + galleryPhotos.length) % galleryPhotos.length)}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700"
                >
                  이전
                </button>
                <p className="text-xs font-semibold text-zinc-500">
                  {selectedIndex + 1} / {galleryPhotos.length}
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedIndex((selectedIndex + 1) % galleryPhotos.length)}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700"
                >
                  다음
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
