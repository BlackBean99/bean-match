import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { openLevelLabels } from "@/lib/domain";
import type { DashboardUserDetail, DashboardUserPhoto } from "@/lib/domain";
import {
  deleteUserPhotoAction,
  setMainUserPhotoAction,
  updateUserPhotoAction,
} from "@/app/actions";
import { PastePhotoForm } from "@/components/paste-photo-form";
import { StatusBadge } from "@/components/status-badge";

type UserDetailProps = {
  user: DashboardUserDetail;
};

export function UserDetail({ user }: UserDetailProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <Link href="/users" className="text-sm font-bold text-[#E00E0E]">
          사용자 목록으로
        </Link>
        <div className="mt-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-zinc-950">{user.name}</h2>
            <p className="mt-1 text-xs font-semibold text-zinc-500">UserId {user.id}</p>
            <p className="mt-2 text-sm text-zinc-600">
              {user.gender} · {formatAge(user)} · {user.heightCm > 0 ? `${user.heightCm}cm` : "키 미입력"}
            </p>
            <p className="mt-1 text-sm text-zinc-600">
              {user.jobTitle}
              {user.companyName ? ` · ${user.companyName}` : ""}
            </p>
            <p className="mt-1 text-sm font-bold text-[#E00E0E]">{openLevelLabels[user.openLevel]}</p>
          </div>
          <StatusBadge status={user.status} />
        </div>
        <div className="mt-5 space-y-4 text-sm leading-6 text-zinc-700">
          <ProfileText label="자기소개" value={user.selfIntro} />
          <ProfileText label="이상형" value={user.idealTypeDescription} />
          <div>
            <p className="text-xs font-bold text-zinc-500">역할</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {user.roles.map((role) => (
                <span key={role} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-600">
                  {role}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-zinc-950">사진</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Notion 사진 URL과 직접 업로드한 Supabase Storage 사진을 함께 관리합니다.
            </p>
          </div>
          <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-[#E00E0E]">
            {user.photos.length}장
          </span>
        </div>

        <PastePhotoForm userId={user.id} defaultSortOrder={user.photos.length} />

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {user.photos.length === 0 ? (
            <p className="rounded-lg border border-zinc-200 p-4 text-sm text-zinc-500">등록된 사진이 없습니다.</p>
          ) : (
            user.photos.map((photo) => <PhotoCard key={photo.id} userId={user.id} photo={photo} />)
          )}
        </div>
      </section>
    </div>
  );
}

function PhotoCard({ userId, photo }: { userId: number; photo: DashboardUserPhoto }) {
  return (
    <article className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <div className="aspect-[4/3] bg-zinc-100">
        <div className="photo-skeleton relative h-full w-full">
          <Image
            src={photo.url}
            alt={photo.originalFileName}
            fill
            sizes="360px"
            className="relative z-10 object-cover"
            unoptimized
          />
        </div>
      </div>
      <div className="grid gap-3 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-zinc-950" title={photo.originalFileName}>
              {photo.originalFileName}
            </p>
            <p className="mt-1 text-xs text-zinc-500">순서 {photo.sortOrder} · {photo.uploadedAt}</p>
          </div>
          {photo.isMain ? (
            <span className="shrink-0 rounded-full bg-[#FF3131] px-2.5 py-1 text-xs font-bold text-white">대표</span>
          ) : null}
        </div>

        <details>
          <summary className="cursor-pointer text-xs font-bold text-[#E00E0E]">사진 수정</summary>
          <form action={updateUserPhotoAction} className="mt-3 grid gap-3">
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="photoId" value={photo.id} />
            <Field label="URL">
              <input name="url" type="url" defaultValue={photo.sourceUrl} className={inputClassName} />
            </Field>
            <Field label="새 파일">
              <input name="photoFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className={inputClassName} />
            </Field>
            <Field label="파일명">
              <input name="originalFileName" defaultValue={photo.originalFileName} className={inputClassName} />
            </Field>
            <Field label="순서">
              <input name="sortOrder" type="number" defaultValue={photo.sortOrder} className={inputClassName} />
            </Field>
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-700">
              <input type="checkbox" name="isMain" defaultChecked={photo.isMain} />
              대표 사진
            </label>
            <button className={primaryButtonClassName}>저장</button>
          </form>
        </details>

        <div className="flex gap-3">
          {!photo.isMain ? (
            <form action={setMainUserPhotoAction}>
              <input type="hidden" name="userId" value={userId} />
              <input type="hidden" name="photoId" value={photo.id} />
              <button className="text-xs font-bold text-zinc-600 hover:text-[#E00E0E]">대표 지정</button>
            </form>
          ) : null}
          <form action={deleteUserPhotoAction}>
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="photoId" value={photo.id} />
            <button className="text-xs font-bold text-zinc-500 hover:text-[#E00E0E]">삭제</button>
          </form>
        </div>
      </div>
    </article>
  );
}

function ProfileText({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs font-bold text-zinc-500">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-zinc-700">{value || "-"}</p>
    </div>
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

function formatAge(user: DashboardUserDetail) {
  if (user.age > 0 && user.ageText) return `${user.age}세 (${user.ageText})`;
  if (user.age > 0) return `${user.age}세`;
  if (user.ageText) return user.ageText;
  return "나이 미입력";
}

const inputClassName =
  "w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-[#FF3131] focus:ring-2 focus:ring-red-100";

const primaryButtonClassName = "rounded-lg bg-[#FF3131] px-4 py-2 text-sm font-bold text-white hover:bg-[#E00E0E]";
