import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { openLevelLabels } from "@/lib/domain";
import type { DashboardUserDetail, DashboardUserPhoto } from "@/lib/domain";
import {
  deleteMemberAction,
  deleteUserPhotoAction,
  setMainUserPhotoAction,
  updateUserPhotoAction,
} from "@/app/actions";
import { OfferLinkQuickActions } from "@/components/offer-link-quick-actions";
import { OnboardingAccessTokenManager } from "@/components/onboarding-access-token-manager";
import { ReadOnlyTokenManager } from "@/components/readonly-token-manager";
import { FormPendingFieldset } from "@/components/form-pending-fieldset";
import { FormSubmitButton } from "@/components/form-submit-button";
import { CompressedPhotoInput } from "@/components/compressed-photo-input";
import { PastePhotoForm } from "@/components/paste-photo-form";
import { StatusBadge } from "@/components/status-badge";
import { formatBirthYearLabel } from "@/lib/birth-year-label";
import type { OnboardingAccessTokenManagerData } from "@/lib/onboarding-access-repository";
import type { ReadOnlyBrowseTokenManagerData } from "@/lib/readonly-browse-repository";

type UserDetailProps = {
  canManage?: boolean;
  onboardingAccessTokenManager: OnboardingAccessTokenManagerData;
  readOnlyTokenManager: ReadOnlyBrowseTokenManagerData;
  user: DashboardUserDetail;
};

export function UserDetail({
  canManage = false,
  onboardingAccessTokenManager,
  user,
  readOnlyTokenManager,
}: UserDetailProps) {
  const accessUrl = readOnlyTokenManager.accessPath;

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
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
            <div className="flex flex-col items-end gap-3">
              <StatusBadge status={user.status} />
              {canManage ? (
                <form action={deleteMemberAction}>
                  <FormPendingFieldset className="contents">
                    <input type="hidden" name="id" value={user.id} />
                    <FormSubmitButton
                      label="회원 삭제"
                      pendingLabel="삭제 중..."
                      className="rounded-2xl border border-red-100 bg-red-50 px-4 py-2 text-sm font-bold text-[#b10606] hover:bg-red-100"
                    />
                  </FormPendingFieldset>
                </form>
              ) : null}
            </div>
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

        <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-zinc-950">사진</h2>
              <p className="mt-1 text-sm text-zinc-500">Notion 사진과 업로드 사진을 함께 봅니다.</p>
            </div>
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-[#E00E0E]">
              {user.photos.length}장
            </span>
          </div>

          {canManage ? <PastePhotoForm userId={user.id} defaultSortOrder={user.photos.length} /> : null}

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {user.photos.length === 0 ? (
              <p className="rounded-[24px] border border-[#ece7e4] p-4 text-sm text-zinc-500">등록된 사진이 없습니다.</p>
            ) : (
              user.photos.map((photo) => <PhotoCard key={photo.id} readOnly={!canManage} userId={user.id} photo={photo} />)
            )}
          </div>
        </section>
      </div>

      <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-zinc-950">오퍼 공유</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          상세 화면에서도 오퍼 링크와 토큰을 바로 복사할 수 있습니다. 유효한 원문 토큰이 없으면 7일 만료 토큰을 새로 발급합니다.
        </p>
        <OfferLinkQuickActions userId={user.id} />
      </section>

      {canManage ? (
        <>
          <OnboardingAccessTokenManager
            databaseConnected={onboardingAccessTokenManager.databaseConnected}
            loadError={onboardingAccessTokenManager.loadError}
            tokens={onboardingAccessTokenManager.tokens}
            userId={user.id}
            userName={user.name}
          />

          <ReadOnlyTokenManager
            accessUrl={accessUrl}
            databaseConnected={readOnlyTokenManager.databaseConnected}
            loadError={readOnlyTokenManager.loadError}
            tokens={readOnlyTokenManager.tokens}
            userId={user.id}
            userName={user.name}
          />
        </>
      ) : (
        <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-zinc-950">모집인 권한</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            모집인 계정은 회원 상세와 오퍼 공유 기능은 사용할 수 있지만, 사진 편집과 사용자 수정/삭제, 동기화는 할 수 없습니다.
          </p>
        </section>
      )}
    </div>
  );
}

function PhotoCard({ userId, photo, readOnly }: { userId: number; photo: DashboardUserPhoto; readOnly: boolean }) {
  return (
    <article className="overflow-hidden rounded-[24px] border border-[#ece7e4] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
      <div className="bg-[#f6f3ef] p-3">
        <div className="photo-skeleton relative aspect-[4/3] overflow-hidden rounded-[18px] bg-white">
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
      <div className="grid gap-3 p-4">
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

        {readOnly ? (
          <p className="text-xs text-zinc-500">열람 전용 프로필이라 사진 수정 기능이 비활성화되어 있습니다.</p>
        ) : (
          <>
            <details>
              <summary className="cursor-pointer text-xs font-bold text-[#c96a2b]">사진 수정</summary>
              <form action={updateUserPhotoAction} className="mt-3 grid gap-3">
                <FormPendingFieldset className="grid gap-3">
                  <input type="hidden" name="userId" value={userId} />
                  <input type="hidden" name="photoId" value={photo.id} />
                  <Field label="URL">
                    <input name="url" type="url" defaultValue={photo.sourceUrl} className={inputClassName} />
                  </Field>
                  <Field label="새 파일">
                    <CompressedPhotoInput name="photoFile" className={inputClassName} />
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
                  <FormSubmitButton
                    label="저장"
                    pendingLabel="저장 중..."
                    className={`${primaryButtonClassName} disabled:cursor-not-allowed disabled:bg-zinc-300`}
                  />
                </FormPendingFieldset>
              </form>
            </details>

            <div className="flex gap-3">
              {!photo.isMain ? (
                <form action={setMainUserPhotoAction}>
                  <FormPendingFieldset className="contents">
                    <input type="hidden" name="userId" value={userId} />
                    <input type="hidden" name="photoId" value={photo.id} />
                    <FormSubmitButton
                      label="대표 지정"
                      pendingLabel="변경 중..."
                      className="text-xs font-bold text-zinc-600 hover:text-[#E00E0E] disabled:text-zinc-300"
                    />
                  </FormPendingFieldset>
                </form>
              ) : null}
              <form action={deleteUserPhotoAction}>
                <FormPendingFieldset className="contents">
                  <input type="hidden" name="userId" value={userId} />
                  <input type="hidden" name="photoId" value={photo.id} />
                  <FormSubmitButton
                    label="삭제"
                    pendingLabel="삭제 중..."
                    className="text-xs font-bold text-zinc-500 hover:text-[#E00E0E] disabled:text-zinc-300"
                  />
                </FormPendingFieldset>
              </form>
            </div>
          </>
        )}
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
  return formatBirthYearLabel(user);
}

const inputClassName =
  "w-full min-w-0 rounded-2xl border border-[#ded5c8] bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-[#d98b51] focus:ring-2 focus:ring-[#f8e1cf]";

const primaryButtonClassName =
  "rounded-2xl bg-[linear-gradient(135deg,#da7a37,#ee9b55)] px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(217,122,50,0.2)]";
