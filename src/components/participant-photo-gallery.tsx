"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type TouchEvent } from "react";
import type { DashboardUserPhoto } from "@/lib/domain";

type ParticipantPhotoGalleryProps = {
  name: string;
  photos: DashboardUserPhoto[];
  fallbackUrl?: string;
  variant?: "compact" | "viewer";
};

type GalleryPhoto = DashboardUserPhoto & {
  backupUrl?: string;
};

type TouchState = {
  active: boolean;
  startX: number;
  currentX: number;
  startY: number;
  currentY: number;
  width: number;
};

const swipeThresholdRatio = 0.18;
const swipeCloseThresholdRatio = 0.16;

export function ParticipantPhotoGallery({
  name,
  photos,
  fallbackUrl,
  variant = "viewer",
}: ParticipantPhotoGalleryProps) {
  const galleryPhotos = useMemo<GalleryPhoto[]>(() => {
    if (photos.length > 0) {
      return photos
        .map((photo) => ({
          ...photo,
          backupUrl:
            photo.sourceUrl && photo.sourceUrl !== photo.url && isUsableClientImageUrl(photo.sourceUrl)
              ? photo.sourceUrl
              : undefined,
        }))
        .filter((photo) => Boolean(photo.url || photo.backupUrl));
    }

    if (!fallbackUrl) return [];

    return [
      {
        id: 0,
        url: fallbackUrl,
        sourceUrl: fallbackUrl,
        backupUrl: undefined,
        originalFileName: `${name} 사진`,
        isMain: true,
        sortOrder: 0,
        uploadedAt: "",
      },
    ];
  }, [fallbackUrl, name, photos]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [loadedSources, setLoadedSources] = useState<Record<string, true>>({});
  const [fallbackSourceIndex, setFallbackSourceIndex] = useState<Record<number, number>>({});
  const [dragOffset, setDragOffset] = useState(0);
  const touchStateRef = useRef<TouchState>({
    active: false,
    startX: 0,
    currentX: 0,
    startY: 0,
    currentY: 0,
    width: 0,
  });

  useEffect(() => {
    if (selectedIndex < galleryPhotos.length) return;
    setSelectedIndex(0);
  }, [galleryPhotos.length, selectedIndex]);

  useEffect(() => {
    if (!isViewerOpen || galleryPhotos.length <= 1) return;

    const preloadIndexes = [selectedIndex, (selectedIndex + 1) % galleryPhotos.length];
    const preloadTargets = preloadIndexes
      .map((index) => {
        const photo = galleryPhotos[index];
        if (!photo) return null;
        return resolvePhotoSource(photo, fallbackSourceIndex[index] ?? 0);
      })
      .filter((source): source is string => Boolean(source));

    for (const source of preloadTargets) {
      if (loadedSources[source]) continue;
      const image = new window.Image();
      image.decoding = "async";
      image.src = source;
    }
  }, [fallbackSourceIndex, galleryPhotos, isViewerOpen, loadedSources, selectedIndex]);

  const activePhoto = galleryPhotos[selectedIndex] ?? null;
  const activePhotoSource = activePhoto ? resolvePhotoSource(activePhoto, fallbackSourceIndex[selectedIndex] ?? 0) : null;
  const hasMultiplePhotos = galleryPhotos.length > 1;
  const compactLoaded = activePhotoSource ? Boolean(loadedSources[activePhotoSource]) : false;

  function blockCardSelection(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
  }

  function setLoaded(source: string) {
    setLoadedSources((current) => (current[source] ? current : { ...current, [source]: true }));
  }

  function handleImageError(index: number) {
    setFallbackSourceIndex((current) => {
      const nextIndex = (current[index] ?? 0) + 1;
      const photo = galleryPhotos[index];
      if (!photo || !photo.backupUrl || nextIndex > 1) return current;
      return { ...current, [index]: nextIndex };
    });
  }

  function moveSelection(step: number) {
    if (galleryPhotos.length <= 1) return;
    setSelectedIndex((current) => modulo(current + step, galleryPhotos.length));
    setDragOffset(0);
  }

  function openViewer() {
    setIsViewerOpen(true);
  }

  function closeViewer() {
    setIsViewerOpen(false);
  }

  function onTouchStart(event: TouchEvent<HTMLElement>) {
    if (galleryPhotos.length <= 1 && !isViewerOpen) return;
    const touch = event.touches[0];
    touchStateRef.current = {
      active: true,
      startX: touch.clientX,
      currentX: touch.clientX,
      startY: touch.clientY,
      currentY: touch.clientY,
      width: event.currentTarget.clientWidth,
    };
    setDragOffset(0);
  }

  function onTouchMove(event: TouchEvent<HTMLElement>) {
    if (!touchStateRef.current.active) return;
    const touch = event.touches[0];
    touchStateRef.current.currentX = touch.clientX;
    touchStateRef.current.currentY = touch.clientY;
    setDragOffset(touch.clientX - touchStateRef.current.startX);
  }

  function onTouchEnd() {
    if (!touchStateRef.current.active) return;

    const { startX, currentX, startY, currentY, width } = touchStateRef.current;
    const deltaX = currentX - startX;
    const deltaY = currentY - startY;
    const threshold = Math.max(width * swipeThresholdRatio, 36);
    const closeThreshold = Math.max(width * swipeCloseThresholdRatio, 40);
    touchStateRef.current.active = false;

    if (isViewerOpen && deltaY > closeThreshold && Math.abs(deltaY) > Math.abs(deltaX)) {
      closeViewer();
      setDragOffset(0);
      return;
    }

    if (Math.abs(deltaX) >= threshold) {
      moveSelection(deltaX > 0 ? -1 : 1);
      return;
    }

    setDragOffset(0);
  }

  function onKeyOpen(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openViewer();
    }
  }

  if (!activePhoto || !activePhotoSource) {
    return (
      <div className="flex h-full items-center justify-center rounded-[24px] border border-white/10 bg-zinc-900/70 text-[11px] font-semibold text-zinc-400">
        사진 없음
      </div>
    );
  }

  const helperCopy = hasMultiplePhotos
    ? "좌우로 넘기고 탭하면 크게 볼 수 있어요"
    : "사진을 탭하면 크게 볼 수 있어요";

  return (
    <>
      {variant === "compact" ? (
        <div className="grid gap-3">
          <div
            role="button"
            tabIndex={0}
            aria-label={`${name} 사진 확대 보기`}
            onClick={openViewer}
            onKeyDown={onKeyOpen}
            className="group relative aspect-[4/5] w-full cursor-pointer overflow-hidden rounded-[24px] border border-white/10 bg-zinc-950 shadow-[0_18px_45px_rgba(9,9,11,0.28)] outline-none transition duration-200 hover:shadow-[0_24px_55px_rgba(9,9,11,0.34)] focus-visible:ring-2 focus-visible:ring-[#ffb38a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f6f3ef]"
          >
            <div
              className="relative h-full w-full overflow-hidden rounded-[24px]"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              onTouchCancel={onTouchEnd}
              style={{ touchAction: "pan-y" }}
            >
              <PreviewPhotoStage
                src={activePhotoSource}
                alt={`${name} 사진 ${selectedIndex + 1}`}
                loaded={compactLoaded}
                sizes="(max-width: 640px) 48vw, 220px"
                onLoad={() => setLoaded(activePhotoSource)}
                onError={() => handleImageError(selectedIndex)}
              />

              {hasMultiplePhotos ? (
                <>
                  <div className="pointer-events-none absolute inset-y-0 right-0 w-[42%] bg-gradient-to-l from-black/30 via-black/10 to-transparent" />
                  <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-full bg-black/55 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
                    {selectedIndex + 1} / {galleryPhotos.length}
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 top-0 flex gap-1 px-3 pt-3">
                    {galleryPhotos.map((photo, index) => (
                      <span
                        key={`${photo.id}-${index}`}
                        className={`h-1 flex-1 rounded-full transition ${
                          index === selectedIndex ? "bg-white" : "bg-white/30"
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    aria-label="이전 사진"
                    onClick={(event) => {
                      blockCardSelection(event);
                      moveSelection(-1);
                    }}
                    className="absolute inset-y-0 left-0 z-10 flex w-1/2 items-center justify-start pl-3 text-white/75 transition hover:text-white"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/35 text-base font-semibold backdrop-blur-md">
                      ‹
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label="다음 사진"
                    onClick={(event) => {
                      blockCardSelection(event);
                      moveSelection(1);
                    }}
                    className="absolute inset-y-0 right-0 z-10 flex w-1/2 items-center justify-end pr-3 text-white/75 transition hover:text-white"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/35 text-base font-semibold backdrop-blur-md">
                      ›
                    </span>
                  </button>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent px-3 pb-3 pt-12 text-white">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">사진 탐색</p>
                        <p className="mt-1 text-sm font-semibold">
                          {selectedIndex + 1} / {galleryPhotos.length}
                        </p>
                      </div>
                      <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-semibold backdrop-blur-md">
                        좌우 스와이프
                      </span>
                    </div>
                  </div>
                  <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-semibold text-white/90 backdrop-blur-sm transition duration-300 group-hover:bg-white/18">
                    다음 사진 보기
                  </span>
                </>
              ) : (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent px-3 pb-3 pt-12 text-white">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">사진 1장</p>
                  <p className="mt-1 text-sm font-semibold">탭해서 크게 보기</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid min-h-[3.5rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-1">
            <p className="max-w-[20ch] text-[12px] leading-5 text-zinc-500 [overflow-wrap:normal] [white-space:normal] [word-break:keep-all]">
              {helperCopy}
            </p>
            <button
              type="button"
              onClick={openViewer}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-[#f1d1bd] bg-[#fff8f2] px-3 text-xs font-semibold text-[#b86a2d] transition hover:border-[#e9b88e] hover:bg-[#fff3e8]"
            >
              프로필 자세히 보기
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[24px] border border-white/10 bg-zinc-950 shadow-[0_18px_45px_rgba(9,9,11,0.28)]">
            <button type="button" onClick={openViewer} className="group relative block h-full w-full overflow-hidden rounded-[24px]">
              <PreviewPhotoStage
                src={activePhotoSource}
                alt={`${name} 사진 ${selectedIndex + 1}`}
                loaded={compactLoaded}
                sizes="(max-width: 640px) 48vw, 220px"
                onLoad={() => setLoaded(activePhotoSource)}
                onError={() => handleImageError(selectedIndex)}
              />
              <div className="pointer-events-none absolute inset-x-0 top-0 flex gap-1 px-3 pt-3">
                {galleryPhotos.map((photo, index) => (
                  <span
                    key={`${photo.id}-${index}`}
                    className={`h-1 flex-1 rounded-full transition ${
                      index === selectedIndex ? "bg-white" : "bg-white/30"
                    }`}
                  />
                ))}
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent px-3 pb-3 pt-10 text-white">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">Offer Photo</p>
                    <p className="mt-1 text-sm font-semibold">
                      {galleryPhotos.length > 1 ? `${selectedIndex + 1} / ${galleryPhotos.length}` : "탭해서 확대"}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-semibold backdrop-blur-md">
                    Swipe Ready
                  </span>
                </div>
              </div>
            </button>

            {hasMultiplePhotos ? (
              <>
                <button
                  type="button"
                  aria-label="이전 사진"
                  onClick={(event) => {
                    blockCardSelection(event);
                    moveSelection(-1);
                  }}
                  className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-base font-semibold text-white backdrop-blur-md transition hover:bg-black/60"
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="다음 사진"
                  onClick={(event) => {
                    blockCardSelection(event);
                    moveSelection(1);
                  }}
                  className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-base font-semibold text-white backdrop-blur-md transition hover:bg-black/60"
                >
                  ›
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}

      {isViewerOpen ? renderViewerModal() : null}
    </>
  );

  function renderViewerModal() {
    return (
      <div
        className="fixed inset-0 z-50 bg-[rgba(5,5,7,0.92)] px-3 py-3 text-white backdrop-blur-xl sm:px-6 sm:py-6"
        role="dialog"
        aria-modal="true"
        onClick={(event) => {
          blockCardSelection(event);
          closeViewer();
        }}
      >
        <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(24,24,27,0.94),rgba(9,9,11,0.98))] shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
          <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-6">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">Profile Viewer</p>
              <h2 className="truncate text-lg font-semibold tracking-[-0.03em] text-white">{name}</h2>
            </div>
            <button
              type="button"
              onClick={(event) => {
                blockCardSelection(event);
                closeViewer();
              }}
              className="inline-flex h-10 items-center justify-center rounded-full border border-white/15 bg-white/10 px-4 text-sm font-semibold text-white backdrop-blur-md"
            >
              닫기
            </button>
          </div>

          <div className="flex gap-1 px-4 pb-3 sm:px-6">
            {galleryPhotos.map((photo, index) => (
              <span
                key={`${photo.id}-viewer-${index}`}
                className={`h-1 flex-1 rounded-full transition ${
                  index === selectedIndex ? "bg-white" : "bg-white/20"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 px-4 pb-3 sm:px-6">
            <p className="rounded-full bg-white/8 px-3 py-1.5 text-[12px] font-semibold text-white/90">
              {galleryPhotos.length > 1 ? `${selectedIndex + 1} / ${galleryPhotos.length}` : "1 / 1"}
            </p>
            <p className="text-[12px] font-medium text-white/55">
              {hasMultiplePhotos ? "좌우로 넘겨 다른 사진을 볼 수 있어요" : "사진을 크게 보고 닫을 수 있어요"}
            </p>
          </div>

          <div
            className="relative min-h-0 flex-1 overflow-hidden px-2 pb-2 sm:px-4 sm:pb-4"
            onClick={(event) => blockCardSelection(event)}
          >
            <div
              className="relative h-full w-full overflow-hidden rounded-[28px] border border-white/10 bg-zinc-950/80"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              onTouchCancel={onTouchEnd}
              style={{ touchAction: "pan-y" }}
            >
              <div
                className="flex h-full w-[300%] will-change-transform"
                style={{
                  transform: `translate3d(calc(-33.333% + ${dragOffset}px), 0, 0)`,
                  transition: touchStateRef.current.active ? "none" : "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              >
                {[-1, 0, 1].map((step) => {
                  const index = modulo(selectedIndex + step, galleryPhotos.length);
                  const photo = galleryPhotos[index];
                  const src = resolvePhotoSource(photo, fallbackSourceIndex[index] ?? 0);
                  const loaded = src ? Boolean(loadedSources[src]) : false;

                  return (
                    <div key={`${photo.id}-${step}`} className="relative h-full w-1/3 shrink-0 p-2 sm:p-4">
                      {src ? (
                        <PhotoStage
                          src={src}
                          alt={`${name} 사진 ${index + 1}`}
                          loaded={loaded}
                          priority={step === 0}
                          sizes="100vw"
                          fit="contain"
                          onLoad={() => setLoaded(src)}
                          onError={() => handleImageError(index)}
                        />
                      ) : (
                        <div className="h-full rounded-[24px] bg-zinc-900" />
                      )}
                    </div>
                  );
                })}
              </div>

              {hasMultiplePhotos ? (
                <>
                  <button
                    type="button"
                    aria-label="이전 사진"
                    onClick={(event) => {
                      blockCardSelection(event);
                      moveSelection(-1);
                    }}
                    className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-lg font-semibold text-white backdrop-blur-md"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label="다음 사진"
                    onClick={(event) => {
                      blockCardSelection(event);
                      moveSelection(1);
                    }}
                    className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-lg font-semibold text-white backdrop-blur-md"
                  >
                    ›
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {hasMultiplePhotos ? (
            <div className="flex gap-2 overflow-x-auto px-4 pb-4 sm:px-6 sm:pb-5">
              {galleryPhotos.map((photo, index) => {
                const src = resolvePhotoSource(photo, fallbackSourceIndex[index] ?? 0);
                if (!src) return null;

                return (
                  <button
                    key={`${photo.id}-thumb-${index}`}
                    type="button"
                    onClick={(event) => {
                      blockCardSelection(event);
                      setSelectedIndex(index);
                      setDragOffset(0);
                    }}
                    className={`relative h-16 w-12 shrink-0 overflow-hidden rounded-2xl border transition ${
                      index === selectedIndex
                        ? "border-white/70 ring-2 ring-white/30"
                        : "border-white/10 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <Image
                      src={src}
                      alt={`${name} 썸네일 ${index + 1}`}
                      fill
                      sizes="48px"
                      className="object-cover"
                      unoptimized
                      loading="lazy"
                    />
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    );
  }
}

function PhotoStage({
  src,
  alt,
  loaded,
  priority = false,
  sizes,
  fit,
  onLoad,
  onError,
}: {
  src: string;
  alt: string;
  loaded: boolean;
  priority?: boolean;
  sizes: string;
  fit: "contain" | "cover";
  onLoad: () => void;
  onError: () => void;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[24px] bg-zinc-950">
      <div
        className="absolute inset-0 scale-110 bg-cover bg-center opacity-60 blur-2xl"
        style={{ backgroundImage: `url("${src}")` }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_40%),linear-gradient(180deg,rgba(7,7,10,0.18),rgba(7,7,10,0.72))]" />
      {!loaded ? (
        <div className="absolute inset-0 animate-pulse bg-[linear-gradient(120deg,rgba(255,255,255,0.08),rgba(255,255,255,0.16),rgba(255,255,255,0.08))]" />
      ) : null}
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className={`z-[1] transition duration-300 ${fit === "cover" ? "object-cover object-center" : "object-contain object-center"} ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
        unoptimized
        loading={priority ? undefined : "lazy"}
        onLoad={onLoad}
        onError={onError}
      />
    </div>
  );
}

function PreviewPhotoStage({
  src,
  alt,
  loaded,
  sizes,
  onLoad,
  onError,
}: {
  src: string;
  alt: string;
  loaded: boolean;
  sizes: string;
  onLoad: () => void;
  onError: () => void;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[24px] bg-zinc-950">
      {!loaded ? (
        <div className="absolute inset-0 animate-pulse bg-[linear-gradient(120deg,rgba(255,255,255,0.08),rgba(255,255,255,0.16),rgba(255,255,255,0.08))]" />
      ) : null}
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className={`transition duration-300 ${loaded ? "opacity-100" : "opacity-0"} object-cover object-center`}
        unoptimized
        loading="lazy"
        onLoad={onLoad}
        onError={onError}
      />
    </div>
  );
}

function resolvePhotoSource(photo: GalleryPhoto, fallbackIndex: number) {
  const sources = [photo.url, photo.backupUrl].filter((value, index, list): value is string => {
    return Boolean(value) && list.indexOf(value) === index;
  });
  return sources[Math.min(fallbackIndex, Math.max(sources.length - 1, 0))] ?? null;
}

function isUsableClientImageUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function modulo(value: number, length: number) {
  return ((value % length) + length) % length;
}
