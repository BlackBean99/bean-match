import {
  IntroCaseStatus,
  IntroParticipantRole,
  Prisma,
  type Gender,
  type UserRole,
  type UserStatus,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma, hasDatabaseUrl } from "@/lib/prisma";
import {
  getRuntimeEnv,
  getSupabaseServerKey,
  getSupabaseUrl,
} from "@/lib/runtime-env";
import {
  deleteCloudflareImage,
  ensureCloudflareCachedImage,
  isCloudflareDeliveryUrl,
  uploadCloudflareImageFile,
} from "@/lib/cloudflare-images";
import {
  activeIntroStatuses,
  type DashboardIntroCase,
  type DashboardUser,
  type DashboardUserDetail,
  type DashboardUserPhoto,
  type MemberFilterState,
  type OpenLevel,
} from "@/lib/domain";

type MemberInput = {
  name: string;
  gender: Gender;
  status: UserStatus;
  openLevel: OpenLevel;
  exposureConsent: boolean;
  newMemberNotificationsEnabled: boolean;
  exposurePaused: boolean;
  birthDate: Date | null;
  ageText: string | null;
  heightCm: number | null;
  jobTitle: string | null;
  companyName: string | null;
  selfIntro: string | null;
  idealTypeDescription: string | null;
  phone: string | null;
  roles: UserRole[];
};

type SupabaseUserRow = {
  id: number;
  name: string;
  gender: Gender;
  status: UserStatus;
  open_level: OpenLevel | null;
  main_photo_id: number | null;
  exposure_consent: boolean;
  new_member_notifications_enabled: boolean;
  exposure_paused: boolean;
  birth_date: string | null;
  age_text: string | null;
  phone: string | null;
  height_cm: number | null;
  job_title: string | null;
  company_name: string | null;
  self_intro: string | null;
  ideal_type_description: string | null;
  updated_at: string;
};

type SupabaseRoleRow = {
  user_id: number;
  role: UserRole;
};

type SupabasePhotoRow = {
  id: number;
  user_id: number;
  original_file_name: string;
  stored_file_name: string;
  file_path: string;
  file_url: string | null;
  mime_type: string;
  sort_order: number;
  is_main: boolean;
  uploaded_at: string;
};

type SupabaseIntroCaseRow = {
  id: number;
  status: IntroCaseStatus;
  invitor_user_id: number | null;
  updated_at: string;
  memo: string | null;
};

type SupabaseIntroParticipantRow = {
  intro_case_id: number;
  user_id: number;
  participant_role: IntroParticipantRole;
  response_status: string | null;
};

type IntroCaseInput = {
  status: IntroCaseStatus;
  personAId: bigint;
  personBId: bigint;
  invitorUserId: bigint | null;
  memo: string | null;
};

type IntroCaseUpdateInput = {
  status: IntroCaseStatus;
  memo: string | null;
};

type PhotoInput = {
  url: string;
  originalFileName: string | null;
  storedFileName?: string;
  filePath?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  sortOrder: number;
  isMain: boolean;
  cloudflareImageId?: string | null;
};

type UploadedPhotoInput = Required<Pick<PhotoInput, "url" | "storedFileName" | "filePath" | "mimeType" | "fileSizeBytes">> & {
  originalFileName: string;
  cloudflareImageId: string;
};

const introCaseInclude = {
  invitor: true,
  participants: {
    include: {
      user: true,
    },
    orderBy: { participantRole: "asc" },
  },
} satisfies Prisma.IntroCaseInclude;

const activeIntroStatusSet = new Set<IntroCaseStatus>(activeIntroStatuses as IntroCaseStatus[]);
const photoUploadMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const maxPhotoUploadBytes = 10 * 1024 * 1024;

export type MemberDashboardData = {
  users: DashboardUser[];
  allUsers: DashboardUser[];
  introCases: DashboardIntroCase[];
  databaseConnected: boolean;
  loadError: string | null;
};

type MemberDashboardQueryOptions = {
  includeIntroCases?: boolean;
  includeRoles?: boolean;
};

const defaultMemberDashboardQueryOptions: Required<MemberDashboardQueryOptions> = {
  includeIntroCases: true,
  includeRoles: true,
};

export async function getMemberDashboardData(
  filters: MemberFilterState = defaultFilters(),
  options: MemberDashboardQueryOptions = defaultMemberDashboardQueryOptions,
): Promise<MemberDashboardData> {
  const resolvedOptions = { ...defaultMemberDashboardQueryOptions, ...options };
  if (hasDatabaseUrl()) {
    return getMemberDashboardDataFromPrisma(filters, resolvedOptions);
  }

  if (hasSupabaseRestConfig()) {
    return getMemberDashboardDataFromSupabaseRest(filters, resolvedOptions);
  }

    return {
      users: [],
      allUsers: [],
      introCases: [],
      databaseConnected: false,
      loadError: "DATABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.",
    };
}

async function getMemberDashboardDataFromPrisma(
  filters: MemberFilterState,
  options: Required<MemberDashboardQueryOptions>,
): Promise<MemberDashboardData> {
  try {
    const [users, introCases] = await Promise.all([
      prisma.user.findMany({
        include: {
          mainPhoto: true,
          ...(options.includeRoles ? { roles: true } : {}),
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 100,
      }),
      options.includeIntroCases
        ? prisma.introCase.findMany({
            include: introCaseInclude,
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            take: 100,
          })
        : Promise.resolve([]),
    ]);
    const dashboardUsers = users.map((user) => {
      const userAge = ageFromProfile(user.birthDate, user.ageText);
      const mainPhoto = user.mainPhoto && !user.mainPhoto.deletedAt ? user.mainPhoto : null;
      return {
        id: Number(user.id),
        name: user.name,
        age: userAge,
        ageSortValue: userAge,
        ageText: user.ageText ?? "",
        gender: labelForGender(user.gender),
        genderCode: user.gender,
        birthDateInput: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : "",
        heightCm: user.heightCm ?? 0,
        jobTitle: user.jobTitle ?? "직업 미입력",
        companyName: user.companyName ?? "",
        selfIntro: user.selfIntro ?? "",
        idealTypeDescription: user.idealTypeDescription ?? "",
        status: user.status,
        openLevel: user.openLevel,
        exposureConsent: user.exposureConsent,
        newMemberNotificationsEnabled: user.newMemberNotificationsEnabled,
        exposurePaused: user.exposurePaused,
        roles: "roles" in user && Array.isArray(user.roles) ? user.roles.map((role) => role.role) : [],
        hasMainPhoto: Boolean(mainPhoto),
        mainPhotoUrl: photoDeliveryOrProxyUrl(mainPhoto?.fileUrl, mainPhoto?.filePath, mainPhoto?.id),
        lastChangedAt: formatDateTime(user.updatedAt),
      };
    });

    return {
      users: applyUserFiltersAndSort(filters, dashboardUsers),
      allUsers: dashboardUsers,
      introCases: introCases.map((introCase) => toDashboardIntroCase(introCase)),
      databaseConnected: true,
      loadError: null,
    };
  } catch (error) {
    return {
      users: [],
      allUsers: [],
      introCases: [],
      databaseConnected: false,
      loadError: error instanceof Error ? error.message : "Database query failed.",
    };
  }
}

async function getMemberDashboardDataFromSupabaseRest(
  filters: MemberFilterState,
  options: Required<MemberDashboardQueryOptions>,
): Promise<MemberDashboardData> {
  try {
    const users = await supabaseRest<SupabaseUserRow[]>(
      "/users?select=id,name,gender,status,open_level,main_photo_id,exposure_consent,new_member_notifications_enabled,exposure_paused,birth_date,age_text,height_cm,job_title,company_name,self_intro,ideal_type_description,updated_at&order=updated_at.desc,id.desc&limit=100",
    );
    const userIds = users.map((user) => user.id);
    const [mainPhotos, roles, introCases] = await Promise.all([
      userIds.length > 0
        ? supabaseRest<SupabasePhotoRow[]>(
          `/user_photos?select=id,user_id,file_path,file_url&user_id=in.(${userIds.join(",")})&is_main=is.true&deleted_at=is.null`,
        )
        : Promise.resolve([]),
      options.includeRoles && userIds.length > 0
        ? supabaseRest<SupabaseRoleRow[]>(`/user_roles?select=user_id,role&user_id=in.(${userIds.join(",")})`)
        : Promise.resolve([]),
      options.includeIntroCases
        ? supabaseRest<SupabaseIntroCaseRow[]>(
            "/intro_cases?select=id,status,invitor_user_id,updated_at,memo&order=updated_at.desc,id.desc&limit=100",
          )
        : Promise.resolve([]),
    ]);
    const mainPhotoByUserId = new Map<number, SupabasePhotoRow>();
    for (const photo of mainPhotos) {
      mainPhotoByUserId.set(photo.user_id, photo);
    }
    const rolesByUserId = groupByUserId(roles);
    const introCaseIds = introCases.map((introCase) => introCase.id);
    const introParticipants =
      options.includeIntroCases && introCaseIds.length > 0
        ? await supabaseRest<SupabaseIntroParticipantRow[]>(
            `/intro_case_participants?select=intro_case_id,user_id,participant_role,response_status&intro_case_id=in.(${introCaseIds.join(",")})`,
          )
        : [];
    const namesByUserId = new Map(users.map((user) => [user.id, user.name]));
    const dashboardUsers = users.map((user) => {
      const userAge = ageFromProfile(
        user.birth_date ? new Date(`${user.birth_date}T00:00:00.000Z`) : null,
        user.age_text,
      );
      return {
        id: user.id,
        name: user.name,
        age: userAge,
        ageSortValue: userAge,
        ageText: user.age_text ?? "",
        gender: labelForGender(user.gender),
        genderCode: user.gender,
        birthDateInput: user.birth_date ?? "",
        heightCm: user.height_cm ?? 0,
        jobTitle: user.job_title ?? "직업 미입력",
        companyName: user.company_name ?? "",
        selfIntro: user.self_intro ?? "",
        idealTypeDescription: user.ideal_type_description ?? "",
        status: user.status,
        // 정책: 사진을 제공한 사람은 디폴트로 FULL_OPEN. (명시적 open_level이 있으면 그 값을 우선)
        openLevel: user.open_level ?? (user.main_photo_id ? "FULL_OPEN" : "PRIVATE"),
        exposureConsent: user.exposure_consent,
        newMemberNotificationsEnabled: user.new_member_notifications_enabled,
        exposurePaused: user.exposure_paused,
        roles: rolesByUserId.get(user.id) ?? [],
        hasMainPhoto: Boolean(user.main_photo_id),
        mainPhotoUrl: photoDeliveryOrProxyUrl(
          mainPhotoByUserId.get(user.id)?.file_url,
          mainPhotoByUserId.get(user.id)?.file_path,
          mainPhotoByUserId.get(user.id)?.id,
        ),
        lastChangedAt: formatDateTime(new Date(user.updated_at)),
      };
    });

    return {
      users: applyUserFiltersAndSort(filters, dashboardUsers),
      allUsers: dashboardUsers,
      introCases: introCases.map((introCase) =>
        toDashboardIntroCaseFromSupabase(introCase, introParticipants, namesByUserId),
      ),
      databaseConnected: true,
      loadError: null,
    };
  } catch (error) {
    return {
      users: [],
      allUsers: [],
      introCases: [],
      databaseConnected: false,
      loadError: error instanceof Error ? error.message : "Database query failed.",
    };
  }
}

export async function createMember(input: MemberInput) {
  if (!hasDatabaseUrl() && hasSupabaseRestConfig()) {
    const normalizedRoles = normalizeRoles(input.roles);
    const [user] = await supabaseRest<SupabaseUserRow[]>("/users?select=*", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(toSupabaseUserPayload(input, true)),
    });

    await upsertSupabaseRoles(user.id, normalizedRoles);
    if (normalizedRoles.includes("PARTICIPANT" as UserRole)) {
      await ensureSupabaseEntryQueueRow(user.id, input.status, input.openLevel, "member:create");
    }
    return user;
  }

  assertDatabaseUrl();

  const normalizedRoles = normalizeRoles(input.roles);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: input.name,
        gender: input.gender,
        status: input.status,
        openLevel: input.openLevel,
        exposureConsent: input.exposureConsent,
        newMemberNotificationsEnabled: input.newMemberNotificationsEnabled,
        exposurePaused: input.exposurePaused,
        exposurePausedAt: input.exposurePaused ? new Date() : null,
        birthDate: input.birthDate,
        ageText: input.ageText,
        heightCm: input.heightCm,
        jobTitle: input.jobTitle,
        companyName: input.companyName,
        selfIntro: input.selfIntro,
        idealTypeDescription: input.idealTypeDescription,
        phone: input.phone,
        roles: {
          create: normalizedRoles.map((role) => ({ role })),
        },
      },
    });

    if (normalizedRoles.includes("PARTICIPANT" as UserRole)) {
      await tx.entryQueue.create({
        data: {
          userId: user.id,
          status: entryQueueStatusFor(user.status, user.openLevel),
          memo: "member:create",
        },
      });
    }

    return user;
  });
}

export async function getUserDetail(id: bigint): Promise<DashboardUserDetail | null> {
  if (hasDatabaseUrl()) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        roles: true,
        photos: {
          where: { deletedAt: null },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        },
      },
    });
    if (!user) return null;
    const userAge = ageFromProfile(user.birthDate, user.ageText);
    const mainPhoto =
      user.photos.find((photo) => photo.id === user.mainPhotoId) ??
      user.photos.find((photo) => photo.isMain) ??
      user.photos[0];

    return {
      id: Number(user.id),
      name: user.name,
      age: userAge,
      ageSortValue: userAge,
      ageText: user.ageText ?? "",
      gender: labelForGender(user.gender),
      genderCode: user.gender,
      birthDateInput: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : "",
      heightCm: user.heightCm ?? 0,
      jobTitle: user.jobTitle ?? "직업 미입력",
      companyName: user.companyName ?? "",
      selfIntro: user.selfIntro ?? "",
      idealTypeDescription: user.idealTypeDescription ?? "",
      status: user.status,
      openLevel: user.openLevel,
      exposureConsent: user.exposureConsent,
      newMemberNotificationsEnabled: user.newMemberNotificationsEnabled,
      exposurePaused: user.exposurePaused,
      roles: user.roles.map((role) => role.role),
      hasMainPhoto: Boolean(mainPhoto),
      mainPhotoUrl: photoDeliveryOrProxyUrl(mainPhoto?.fileUrl, mainPhoto?.filePath, mainPhoto?.id),
      lastChangedAt: formatDateTime(user.updatedAt),
      photos: user.photos.map((photo) => ({
        id: Number(photo.id),
        url: photoDeliveryOrProxyUrl(photo.fileUrl, photo.filePath, photo.id) ?? "",
        sourceUrl: photoSourceUrl(photo.filePath, photo.fileUrl) ?? "",
        originalFileName: photo.originalFileName,
        isMain: photo.isMain,
        sortOrder: photo.sortOrder,
        uploadedAt: formatDateTime(photo.uploadedAt),
      })),
    };
  }

  if (!hasSupabaseRestConfig()) return null;

  const [user] = await supabaseRest<SupabaseUserRow[]>(`/users?id=eq.${id.toString()}&select=*`);
  if (!user) return null;
  const roles = await supabaseRest<SupabaseRoleRow[]>(`/user_roles?select=user_id,role&user_id=eq.${id.toString()}`);
  const photos = await supabaseRest<SupabasePhotoRow[]>(
    `/user_photos?select=*&user_id=eq.${id.toString()}&deleted_at=is.null&order=sort_order.asc,id.asc`,
  );
  const userAge = ageFromProfile(user.birth_date ? new Date(`${user.birth_date}T00:00:00.000Z`) : null, user.age_text);
  const mainPhoto = findMainSupabasePhoto(photos, user.main_photo_id);

  return {
    id: user.id,
    name: user.name,
    age: userAge,
    ageSortValue: userAge,
    ageText: user.age_text ?? "",
    gender: labelForGender(user.gender),
    genderCode: user.gender,
    birthDateInput: user.birth_date ?? "",
    heightCm: user.height_cm ?? 0,
    jobTitle: user.job_title ?? "직업 미입력",
    companyName: user.company_name ?? "",
    selfIntro: user.self_intro ?? "",
    idealTypeDescription: user.ideal_type_description ?? "",
    status: user.status,
    openLevel: user.open_level ?? "PRIVATE",
    exposureConsent: user.exposure_consent,
    newMemberNotificationsEnabled: user.new_member_notifications_enabled,
    exposurePaused: user.exposure_paused,
    roles: roles.map((role) => role.role),
    hasMainPhoto: Boolean(mainPhoto),
    mainPhotoUrl: photoDeliveryOrProxyUrl(mainPhoto?.file_url, mainPhoto?.file_path, mainPhoto?.id),
    lastChangedAt: formatDateTime(new Date(user.updated_at)),
    photos: photos.map(toDashboardPhoto),
  };
}

export async function uploadUserPhotoFile(userId: bigint, file: File): Promise<UploadedPhotoInput> {
  assertPhotoFile(file);

  const originalFileName = sanitizeFileName(file.name || "clipboard-image");
  const extension = extensionForPhoto(file.type, originalFileName);
  const storedFileName = `${randomUUID()}${extension}`;
  const cloudflareImageId = storedFileName;
  const deliveryUrl = await uploadCloudflareImageFile({
    customId: cloudflareImageId,
    file,
    fileName: originalFileName,
    metadata: {
      userId: userId.toString(),
      uploadedBy: "manual-upload",
      originalFileName,
    },
  });

  if (!deliveryUrl) {
    throw new Error("Cloudflare Images upload failed.");
  }

  return {
    url: deliveryUrl,
    originalFileName,
    storedFileName,
    filePath: `cloudflare:${cloudflareImageId}`,
    mimeType: file.type,
    fileSizeBytes: file.size,
    cloudflareImageId,
  };
}

export async function getPhotoRedirectUrl(photoId: bigint): Promise<string | null> {
  if (hasDatabaseUrl()) {
    const photo = await prisma.userPhoto.findFirst({
      where: { id: photoId, deletedAt: null },
      select: {
        id: true,
        storedFileName: true,
        filePath: true,
        fileUrl: true,
      },
    });
    if (!photo) return null;

    return getOrCreatePhotoDeliveryUrl(
      {
        id: Number(photo.id),
        storedFileName: photo.storedFileName,
        filePath: photo.filePath,
        fileUrl: photo.fileUrl,
      },
      async (freshUrl) => {
        await prisma.userPhoto.update({
          where: { id: photo.id },
          data: { fileUrl: freshUrl },
        });
      },
    );
  }

  if (!hasSupabaseRestConfig()) return null;

  const [photo] = await supabaseRest<SupabasePhotoRow[]>(
    `/user_photos?id=eq.${photoId.toString()}&deleted_at=is.null&select=*`,
  );
  if (!photo) return null;

  return getOrCreatePhotoDeliveryUrl(
    {
      id: photo.id,
      storedFileName: photo.stored_file_name,
      filePath: photo.file_path,
      fileUrl: photo.file_url,
    },
    async (freshUrl) => {
      await supabaseRest(`/user_photos?id=eq.${photo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ file_url: freshUrl }),
      });
    },
  );
}

export async function addUserPhoto(userId: bigint, input: PhotoInput) {
  assertPhotoUrl(input.url);

  if (!hasDatabaseUrl() && hasSupabaseRestConfig()) {
    const numericUserId = Number(userId);
    const shouldBeMain = input.isMain || !(await hasSupabaseUserPhotos(numericUserId));
    const photoInput = { ...input, isMain: shouldBeMain };
    if (shouldBeMain) await clearSupabaseMainPhotos(numericUserId);
    const [photo] = await supabaseRest<SupabasePhotoRow[]>("/user_photos?select=*", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(toSupabasePhotoPayload(numericUserId, photoInput)),
    });
    if (!input.cloudflareImageId) {
      await refreshPhotoCloudflareDelivery(
        {
          id: photo.id,
          storedFileName: photo.stored_file_name,
          filePath: photo.file_path,
          fileUrl: photo.file_url,
        },
        input.url,
        async (freshUrl) => {
          await supabaseRest(`/user_photos?id=eq.${photo.id}`, {
            method: "PATCH",
            body: JSON.stringify({ file_url: freshUrl }),
          });
        },
      );
    }
    if (!(await getPhotoRedirectUrl(BigInt(photo.id)))) {
      await supabaseRest(`/user_photos?id=eq.${photo.id}`, { method: "DELETE" });
      throw new Error("Cloudflare Images upload failed.");
    }
    if (shouldBeMain) await updateSupabaseMainPhoto(numericUserId, photo.id);
    await promoteUserToFullOpenOnPhotoSupabase(numericUserId);
    return photo;
  }

  assertDatabaseUrl();

  return prisma.$transaction(async (tx) => {
    const shouldBeMain = input.isMain || (await tx.userPhoto.count({ where: { userId, deletedAt: null } })) === 0;
    const photoInput = { ...input, isMain: shouldBeMain };
    if (shouldBeMain) {
      await tx.userPhoto.updateMany({ where: { userId }, data: { isMain: false } });
    }
    const photo = await tx.userPhoto.create({
      data: toPrismaPhotoPayload(userId, photoInput),
    });
    if (!input.cloudflareImageId) {
      await refreshPhotoCloudflareDelivery(
        {
          id: Number(photo.id),
          storedFileName: photo.storedFileName,
          filePath: photo.filePath,
          fileUrl: photo.fileUrl,
        },
        input.url,
        async (freshUrl) => {
          await tx.userPhoto.update({
            where: { id: photo.id },
            data: { fileUrl: freshUrl },
          });
        },
      );
    }
    if (shouldBeMain) {
      await tx.user.update({ where: { id: userId }, data: { mainPhotoId: photo.id } });
    }
    await promoteUserToFullOpenOnPhotoPrisma(tx, userId);
    return photo;
  });
}

export async function updateUserPhoto(photoId: bigint, input: PhotoInput) {
  assertPhotoUrl(input.url);

  if (!hasDatabaseUrl() && hasSupabaseRestConfig()) {
    const [existing] = await supabaseRest<SupabasePhotoRow[]>(`/user_photos?id=eq.${photoId.toString()}&select=*`);
    if (!existing) throw new Error("Photo not found.");
    if (input.isMain) await clearSupabaseMainPhotos(existing.user_id);
    const updateInput = { ...input, storedFileName: existing.stored_file_name };
    const [photo] = await supabaseRest<SupabasePhotoRow[]>(`/user_photos?id=eq.${photoId.toString()}&select=*`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(toSupabasePhotoPayload(existing.user_id, updateInput)),
    });
    if (!input.cloudflareImageId) {
      await refreshPhotoCloudflareDelivery(
        {
          id: photo.id,
          storedFileName: photo.stored_file_name,
          filePath: photo.file_path,
          fileUrl: photo.file_url,
        },
        input.url,
        async (freshUrl) => {
          await supabaseRest(`/user_photos?id=eq.${photo.id}`, {
            method: "PATCH",
            body: JSON.stringify({ file_url: freshUrl }),
          });
        },
        resolveStoredSourceUrl(existing.file_path, existing.file_url),
      );
    }
    if (!(await getPhotoRedirectUrl(photoId))) {
      throw new Error("Cloudflare Images upload failed.");
    }
    if (input.isMain) await updateSupabaseMainPhoto(existing.user_id, photo.id);
    return photo;
  }

  assertDatabaseUrl();

  return prisma.$transaction(async (tx) => {
    const existing = await tx.userPhoto.findUniqueOrThrow({ where: { id: photoId } });
    if (input.isMain) {
      await tx.userPhoto.updateMany({ where: { userId: existing.userId }, data: { isMain: false } });
    }
    const updateInput = { ...input, storedFileName: existing.storedFileName };
    const photo = await tx.userPhoto.update({
      where: { id: photoId },
      data: toPrismaPhotoPayload(existing.userId, updateInput),
    });
    if (!input.cloudflareImageId) {
      await refreshPhotoCloudflareDelivery(
        {
          id: Number(photo.id),
          storedFileName: photo.storedFileName,
          filePath: photo.filePath,
          fileUrl: photo.fileUrl,
        },
        input.url,
        async (freshUrl) => {
          await tx.userPhoto.update({
            where: { id: photo.id },
            data: { fileUrl: freshUrl },
          });
        },
        resolveStoredSourceUrl(existing.filePath, existing.fileUrl),
      );
    }
    if (!(await getPhotoRedirectUrl(photoId))) {
      throw new Error("Cloudflare Images upload failed.");
    }
    if (input.isMain) {
      await tx.user.update({ where: { id: existing.userId }, data: { mainPhotoId: photo.id } });
    }
    return photo;
  });
}

export async function setMainUserPhoto(photoId: bigint) {
  if (!hasDatabaseUrl() && hasSupabaseRestConfig()) {
    const [photo] = await supabaseRest<SupabasePhotoRow[]>(`/user_photos?id=eq.${photoId.toString()}&select=*`);
    if (!photo) throw new Error("Photo not found.");
    await clearSupabaseMainPhotos(photo.user_id);
    await supabaseRest(`/user_photos?id=eq.${photoId.toString()}`, {
      method: "PATCH",
      body: JSON.stringify({ is_main: true }),
    });
    await updateSupabaseMainPhoto(photo.user_id, photo.id);
    return;
  }

  assertDatabaseUrl();

  return prisma.$transaction(async (tx) => {
    const photo = await tx.userPhoto.findUniqueOrThrow({ where: { id: photoId } });
    await tx.userPhoto.updateMany({ where: { userId: photo.userId }, data: { isMain: false } });
    await tx.userPhoto.update({ where: { id: photoId }, data: { isMain: true } });
    await tx.user.update({ where: { id: photo.userId }, data: { mainPhotoId: photo.id } });
  });
}

export async function deleteUserPhoto(photoId: bigint) {
  if (!hasDatabaseUrl() && hasSupabaseRestConfig()) {
    const [photo] = await supabaseRest<SupabasePhotoRow[]>(`/user_photos?id=eq.${photoId.toString()}&select=*`);
    if (!photo) return;
    if (photo.is_main) {
      await updateSupabaseMainPhoto(photo.user_id, null);
    }
    await deleteCloudflareImage(photo.stored_file_name);
    await supabaseRest(`/user_photos?id=eq.${photoId.toString()}`, { method: "DELETE" });
    return;
  }

  assertDatabaseUrl();

  return prisma.$transaction(async (tx) => {
    const photo = await tx.userPhoto.findUnique({ where: { id: photoId } });
    if (!photo) return;
    if (photo.isMain) {
      await tx.user.update({ where: { id: photo.userId }, data: { mainPhotoId: null } });
    }
    await deleteCloudflareImage(photo.storedFileName);
    await tx.userPhoto.delete({ where: { id: photoId } });
  });
}

export async function createIntroCase(input: IntroCaseInput) {
  if (input.personAId === input.personBId) {
    throw new Error("Intro case requires two different participants.");
  }

  if (!hasDatabaseUrl() && hasSupabaseRestConfig()) {
    const participants = await supabaseRest<Pick<SupabaseUserRow, "id" | "status">[]>(
      `/users?select=id,status&id=in.(${Number(input.personAId)},${Number(input.personBId)})`,
    );
    if (participants.length !== 2 || participants.some((participant) => participant.status !== "READY")) {
      throw new Error("새 소개는 READY 상태 사용자끼리만 생성할 수 있습니다.");
    }

    const existingIntroCaseId = await findSupabaseIntroCaseIdForParticipantPair(
      Number(input.personAId),
      Number(input.personBId),
    );
    if (existingIntroCaseId) {
      throw new Error("이미 매칭 이력이 있는 두 사용자는 다시 매칭할 수 없습니다.");
    }
    const activeConflict = await hasSupabaseActiveIntroConflict([Number(input.personAId), Number(input.personBId)]);
    if (activeConflict) {
      throw new Error("소개 진행 중인 사용자는 새 매칭을 생성할 수 없습니다.");
    }

    const [introCase] = await supabaseRest<SupabaseIntroCaseRow[]>("/intro_cases?select=*", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(toSupabaseIntroCasePayload(input)),
    });

    try {
      await supabaseRest("/intro_case_participants", {
        method: "POST",
        body: JSON.stringify([
          {
            intro_case_id: introCase.id,
            user_id: Number(input.personAId),
            participant_role: "PERSON_A",
            response_status: "PENDING",
          },
          {
            intro_case_id: introCase.id,
            user_id: Number(input.personBId),
            participant_role: "PERSON_B",
            response_status: "PENDING",
          },
        ]),
      });
      await syncUserStatusesAfterIntroChange([Number(input.personAId), Number(input.personBId)]);
    } catch (error) {
      await supabaseRest(`/intro_cases?id=eq.${introCase.id}`, { method: "DELETE" });
      throw error;
    }

    return introCase;
  }

  assertDatabaseUrl();

  return prisma.$transaction(async (tx) => {
    const participants = await tx.user.findMany({
      where: { id: { in: [input.personAId, input.personBId] } },
      select: { id: true, status: true },
    });
    if (participants.length !== 2 || participants.some((participant) => participant.status !== "READY")) {
      throw new Error("새 소개는 READY 상태 사용자끼리만 생성할 수 있습니다.");
    }

    const existingIntroCaseId = await findPrismaIntroCaseIdForParticipantPair(tx, input.personAId, input.personBId);
    if (existingIntroCaseId) {
      throw new Error("이미 매칭 이력이 있는 두 사용자는 다시 매칭할 수 없습니다.");
    }
    const activeConflict = await hasPrismaActiveIntroConflict(tx, [input.personAId, input.personBId]);
    if (activeConflict) {
      throw new Error("소개 진행 중인 사용자는 새 매칭을 생성할 수 없습니다.");
    }

    const introCase = await tx.introCase.create({
      data: {
        status: input.status,
        invitorUserId: input.invitorUserId,
        memo: input.memo,
        participants: {
          create: [
            {
              userId: input.personAId,
              participantRole: "PERSON_A",
              responseStatus: "PENDING",
            },
            {
              userId: input.personBId,
              participantRole: "PERSON_B",
              responseStatus: "PENDING",
            },
          ],
        },
      },
    });

    await syncUserStatusesAfterIntroChangeWithPrisma(tx, [input.personAId, input.personBId]);
    return introCase;
  });
}

export async function updateIntroCase(id: bigint, input: IntroCaseUpdateInput) {
  if (!hasDatabaseUrl() && hasSupabaseRestConfig()) {
    const participants = await supabaseRest<SupabaseIntroParticipantRow[]>(
      `/intro_case_participants?select=user_id&intro_case_id=eq.${id.toString()}`,
    );
    const [introCase] = await supabaseRest<SupabaseIntroCaseRow[]>(`/intro_cases?id=eq.${id.toString()}&select=*`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        status: input.status,
        memo: input.memo,
      }),
    });
    await syncUserStatusesAfterIntroChange(participants.map((participant) => participant.user_id));
    return introCase;
  }

  assertDatabaseUrl();

  return prisma.$transaction(async (tx) => {
    const participants = await tx.introCaseParticipant.findMany({
      where: { introCaseId: id },
      select: { userId: true },
    });
    const introCase = await tx.introCase.update({
      where: { id },
      data: {
        status: input.status,
        memo: input.memo,
      },
    });
    await syncUserStatusesAfterIntroChangeWithPrisma(
      tx,
      participants.map((participant) => participant.userId),
    );
    return introCase;
  });
}

export async function deleteIntroCase(id: bigint) {
  if (!hasDatabaseUrl() && hasSupabaseRestConfig()) {
    const participants = await supabaseRest<SupabaseIntroParticipantRow[]>(
      `/intro_case_participants?select=user_id&intro_case_id=eq.${id.toString()}`,
    );
    await supabaseRest(`/intro_cases?id=eq.${id.toString()}`, { method: "DELETE" });
    await syncUserStatusesAfterIntroChange(participants.map((participant) => participant.user_id));
    return;
  }

  assertDatabaseUrl();

  return prisma.$transaction(async (tx) => {
    const participants = await tx.introCaseParticipant.findMany({
      where: { introCaseId: id },
      select: { userId: true },
    });
    await tx.introCase.delete({ where: { id } });
    await syncUserStatusesAfterIntroChangeWithPrisma(
      tx,
      participants.map((participant) => participant.userId),
    );
  });
}

export async function updateMember(id: bigint, input: MemberInput) {
  if (!hasDatabaseUrl() && hasSupabaseRestConfig()) {
    const [user] = await supabaseRest<SupabaseUserRow[]>(`/users?id=eq.${id.toString()}&select=*`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(toSupabaseUserPayload(input, false)),
    });

    await upsertSupabaseRoles(Number(id), input.roles);
    return user;
  }

  assertDatabaseUrl();

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id },
      data: {
        name: input.name,
        gender: input.gender,
        status: input.status,
        openLevel: input.openLevel,
        exposureConsent: input.exposureConsent,
        newMemberNotificationsEnabled: input.newMemberNotificationsEnabled,
        exposurePaused: input.exposurePaused,
        exposurePausedAt: input.exposurePaused ? new Date() : null,
        birthDate: input.birthDate,
        ageText: input.ageText,
        heightCm: input.heightCm,
        jobTitle: input.jobTitle,
        companyName: input.companyName,
        selfIntro: input.selfIntro,
        idealTypeDescription: input.idealTypeDescription,
        ...(input.phone === null ? {} : { phone: input.phone }),
      },
    });

    await tx.userRoleAssignment.deleteMany({
      where: { userId: id },
    });

    await tx.userRoleAssignment.createMany({
      data: normalizeRoles(input.roles).map((role) => ({ userId: id, role })),
      skipDuplicates: true,
    });

    return user;
  });
}

export async function updateMemberExposure(
  id: bigint,
  input: { status: UserStatus; openLevel: OpenLevel; roles?: UserRole[] },
) {
  if (!hasDatabaseUrl() && hasSupabaseRestConfig()) {
    const userId = Number(id);
    const [user] = await supabaseRest<SupabaseUserRow[]>(`/users?id=eq.${id.toString()}&select=*`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status: input.status, open_level: input.openLevel }),
    });

    if (input.roles) {
      await upsertSupabaseRoles(userId, input.roles);
    }

    await reconcileSupabaseEntryQueueForExposure(userId, user.status, user.open_level ?? "PRIVATE", "admin:exposure");
    return user;
  }

  assertDatabaseUrl();

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id },
      data: { status: input.status, openLevel: input.openLevel },
    });

    if (input.roles) {
      await tx.userRoleAssignment.deleteMany({ where: { userId: id } });
      await tx.userRoleAssignment.createMany({
        data: normalizeRoles(input.roles).map((role) => ({ userId: id, role })),
        skipDuplicates: true,
      });
    }

    await reconcileEntryQueueForExposureWithPrisma(tx, user.id, user.status, user.openLevel, "admin:exposure");
    return user;
  });
}

export async function bulkApplyRoundParticipationDefaults(input: { exceptNames: string[] }) {
  const exceptSet = new Set(input.exceptNames.map(normalizeHumanName));

  if (!hasDatabaseUrl() && hasSupabaseRestConfig()) {
    const roles = await supabaseRest<{ user_id: number }[]>(
      "/user_roles?select=user_id&role=eq.PARTICIPANT&limit=2000",
    );
    const participantIds = new Set(roles.map((row) => row.user_id));
    const users = await supabaseRest<{ id: number; name: string; status: UserStatus; open_level: OpenLevel | null }[]>(
      "/users?select=id,name,status,open_level&limit=2000",
    );

    const results = { fullOpen: 0, private: 0, skipped: 0 };
    for (const user of users) {
      if (!participantIds.has(user.id)) continue;

      const target = exceptSet.has(normalizeHumanName(user.name)) ? ("PRIVATE" as const) : ("FULL_OPEN" as const);
      const current = user.open_level ?? "PRIVATE";

      if (current !== target) {
        await supabaseRest(`/users?id=eq.${user.id}`, {
          method: "PATCH",
          body: JSON.stringify({ open_level: target }),
        });
      }

      await reconcileSupabaseEntryQueueForExposure(user.id, user.status, target, "admin:bulk-defaults");

      if (target === "FULL_OPEN") results.fullOpen += 1;
      else results.private += 1;
      if (current === target) results.skipped += 1;
    }

    return results;
  }

  assertDatabaseUrl();

  return prisma.$transaction(async (tx) => {
    const participantUserIds = await tx.userRoleAssignment.findMany({
      where: { role: "PARTICIPANT" },
      select: { userId: true },
    });
    const participantIdSet = new Set(participantUserIds.map((row) => row.userId.toString()));
    const users = await tx.user.findMany({
      where: { id: { in: participantUserIds.map((row) => row.userId) } },
      select: { id: true, name: true, status: true, openLevel: true },
    });

    const results = { fullOpen: 0, private: 0, skipped: 0 };
    for (const user of users) {
      if (!participantIdSet.has(user.id.toString())) continue;
      const target = exceptSet.has(normalizeHumanName(user.name)) ? ("PRIVATE" as const) : ("FULL_OPEN" as const);
      const current = user.openLevel ?? "PRIVATE";

      if (current !== target) {
        await tx.user.update({ where: { id: user.id }, data: { openLevel: target } });
      } else {
        results.skipped += 1;
      }

      await reconcileEntryQueueForExposureWithPrisma(tx, user.id, user.status, target, "admin:bulk-defaults");

      if (target === "FULL_OPEN") results.fullOpen += 1;
      else results.private += 1;
    }

    return results;
  });
}

export async function deleteMember(id: bigint) {
  if (!hasDatabaseUrl() && hasSupabaseRestConfig()) {
    return supabaseRest(`/users?id=eq.${id.toString()}`, {
      method: "DELETE",
    });
  }

  assertDatabaseUrl();

  return prisma.user.delete({
    where: { id },
  });
}

function assertDatabaseUrl() {
  if (!hasDatabaseUrl()) {
    throw new Error("DATABASE_URL is not configured.");
  }
}

async function upsertSupabaseRoles(userId: number, roles: UserRole[]) {
  await supabaseRest(`/user_roles?user_id=eq.${userId}`, {
    method: "DELETE",
  });

  await supabaseRest("/user_roles", {
    method: "POST",
    body: JSON.stringify(normalizeRoles(roles).map((role) => ({ user_id: userId, role }))),
  });
}

function hasSupabaseRestConfig() {
  return Boolean(getSupabaseUrl() && getSupabaseServerKey());
}

async function supabaseRest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getSupabaseUrl()}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: getSupabaseServerKey(),
      Authorization: `Bearer ${getSupabaseServerKey()}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase REST ${response.status}: ${text}`);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function toSupabaseUserPayload(input: MemberInput, includePhone: boolean) {
  return {
    name: input.name,
    gender: input.gender,
    status: input.status,
    open_level: input.openLevel,
    exposure_consent: input.exposureConsent,
    new_member_notifications_enabled: input.newMemberNotificationsEnabled,
    exposure_paused: input.exposurePaused,
    exposure_paused_at: input.exposurePaused ? new Date().toISOString() : null,
    birth_date: input.birthDate ? input.birthDate.toISOString().slice(0, 10) : null,
    age_text: input.ageText,
    height_cm: input.heightCm,
    job_title: input.jobTitle,
    company_name: input.companyName,
    self_intro: input.selfIntro,
    ideal_type_description: input.idealTypeDescription,
    ...(includePhone || input.phone !== null ? { phone: input.phone } : {}),
  };
}

function toSupabaseIntroCasePayload(input: IntroCaseInput) {
  return {
    status: input.status,
    invitor_user_id: input.invitorUserId ? Number(input.invitorUserId) : null,
    memo: input.memo,
  };
}

function toSupabasePhotoPayload(userId: number, input: PhotoInput) {
  const originalFileName = input.originalFileName || fileNameFromUrl(input.url);
  const storedFileName = input.storedFileName || `manual:${Date.now()}:${originalFileName}`;
  const filePath = input.filePath || input.url;
  const mimeType = input.mimeType || mimeTypeForName(originalFileName);

  return {
    user_id: userId,
    photo_type: "PROFILE",
    original_file_name: originalFileName,
    stored_file_name: storedFileName.slice(0, 255),
    file_path: filePath,
    file_url: input.url,
    mime_type: mimeType,
    file_size_bytes: input.fileSizeBytes ?? 0,
    sort_order: input.sortOrder,
    is_main: input.isMain,
  };
}

function toPrismaPhotoPayload(userId: bigint, input: PhotoInput) {
  const originalFileName = input.originalFileName || fileNameFromUrl(input.url);
  const storedFileName = input.storedFileName || `manual:${Date.now()}:${originalFileName}`;
  const filePath = input.filePath || input.url;
  const mimeType = input.mimeType || mimeTypeForName(originalFileName);

  return {
    userId,
    photoType: "PROFILE" as const,
    originalFileName,
    storedFileName: storedFileName.slice(0, 255),
    filePath,
    fileUrl: input.url,
    mimeType,
    fileSizeBytes: BigInt(input.fileSizeBytes ?? 0),
    sortOrder: input.sortOrder,
    isMain: input.isMain,
  };
}

function toDashboardPhoto(photo: SupabasePhotoRow): DashboardUserPhoto {
  return {
    id: photo.id,
    url: photoDeliveryOrProxyUrl(photo.file_url, photo.file_path, photo.id) ?? "",
    sourceUrl: photoSourceUrl(photo.file_path, photo.file_url) ?? "",
    originalFileName: photo.original_file_name,
    isMain: photo.is_main,
    sortOrder: photo.sort_order,
    uploadedAt: formatDateTime(new Date(photo.uploaded_at)),
  };
}

async function clearSupabaseMainPhotos(userId: number) {
  await supabaseRest(`/user_photos?user_id=eq.${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ is_main: false }),
  });
}

async function updateSupabaseMainPhoto(userId: number, photoId: number | null) {
  await supabaseRest(`/users?id=eq.${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ main_photo_id: photoId }),
  });
}

async function hasSupabaseUserPhotos(userId: number) {
  const rows = await supabaseRest<{ id: number }[]>(
    `/user_photos?select=id&user_id=eq.${userId}&deleted_at=is.null&limit=1`,
  );
  return rows.length > 0;
}

function assertPhotoUrl(url: string) {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("Photo URL is invalid.");
  }

  if (parsedUrl.protocol !== "https:") {
    throw new Error("Photo URL must use https.");
  }
}

function assertPhotoFile(file: File) {
  if (!photoUploadMimeTypes.has(file.type)) {
    throw new Error("Photo file must be JPEG, PNG, WebP, or GIF.");
  }

  if (file.size > maxPhotoUploadBytes) {
    throw new Error("Photo file must be 10MB or smaller.");
  }
}

function sanitizeFileName(name: string) {
  const normalized = name.trim().replaceAll(/[^a-zA-Z0-9._-]/g, "-").replaceAll(/-+/g, "-");
  return (normalized || "clipboard-image").slice(0, 180);
}

function extensionForPhoto(mimeType: string, fileName: string) {
  const existingExtension = fileName.match(/\.(jpe?g|png|webp|gif)$/i)?.[0]?.toLowerCase();
  if (existingExtension) return existingExtension === ".jpeg" ? ".jpg" : existingExtension;
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/gif") return ".gif";
  return "";
}

function fileNameFromUrl(url: string) {
  const pathname = new URL(url).pathname;
  const fileName = decodeURIComponent(pathname.split("/").filter(Boolean).at(-1) || "profile-photo");
  return fileName.slice(0, 255);
}

function mimeTypeForName(name: string) {
  const lowerName = name.toLowerCase();
  if (lowerName.includes(".jpg") || lowerName.includes(".jpeg")) return "image/jpeg";
  if (lowerName.includes(".png")) return "image/png";
  if (lowerName.includes(".webp")) return "image/webp";
  if (lowerName.includes(".gif")) return "image/gif";
  return "application/octet-stream";
}

function groupByUserId(rows: SupabaseRoleRow[]) {
  const rolesByUserId = new Map<number, UserRole[]>();

  for (const row of rows) {
    rolesByUserId.set(row.user_id, [...(rolesByUserId.get(row.user_id) ?? []), row.role]);
  }

  return rolesByUserId;
}

function findMainSupabasePhoto(photos: SupabasePhotoRow[], mainPhotoId: number | null) {
  return (
    photos.find((photo) => photo.id === mainPhotoId) ??
    photos.find((photo) => photo.is_main) ??
    photos[0] ??
    null
  );
}

function photoDisplayUrl(photoId: bigint | number | null | undefined) {
  return photoId === null || photoId === undefined ? undefined : `/api/photos/${photoId.toString()}`;
}

function photoDeliveryOrProxyUrl(
  fileUrl: string | null | undefined,
  filePath: string | null | undefined,
  photoId: bigint | number | null | undefined,
) {
  if (fileUrl && isUsableImageUrl(fileUrl)) return fileUrl;
  if (filePath && isUsableImageUrl(filePath)) return filePath;
  return photoDisplayUrl(photoId);
}

function photoSourceUrl(filePath: string | null | undefined, fileUrl: string | null | undefined): string | undefined {
  if (fileUrl && isUsableImageUrl(fileUrl)) return fileUrl;
  if (filePath && isUsableImageUrl(filePath)) return filePath;
  return undefined;
}

type PhotoRedirectRecord = {
  id: number;
  storedFileName: string;
  filePath: string;
  fileUrl: string | null;
};

async function getOrCreatePhotoDeliveryUrl(
  photo: PhotoRedirectRecord,
  persistFreshUrl: (freshUrl: string) => Promise<unknown>,
) {
  if (isCloudflareDeliveryUrl(photo.fileUrl)) return photo.fileUrl;

  const sourceUrl = isUsableImageUrl(photo.fileUrl)
    ? photo.fileUrl
    : isUsableImageUrl(photo.filePath)
      ? photo.filePath
      : null;
  if (!sourceUrl) return retryCloudflareFromNotionSource(photo, persistFreshUrl);

  const freshUrl = await ensureCloudflareCachedImage({
    customId: photo.storedFileName,
    sourceUrl,
    metadata: {
      photoId: photo.id.toString(),
    },
  });
  if (freshUrl && freshUrl !== photo.fileUrl) await persistFreshUrl(freshUrl);
  if (freshUrl) return freshUrl;

  return retryCloudflareFromNotionSource(photo, persistFreshUrl);
}

async function refreshPhotoCloudflareDelivery(
  photo: PhotoRedirectRecord,
  sourceUrl: string,
  persistFreshUrl: (freshUrl: string) => Promise<unknown>,
  previousSourceUrl?: string | null,
) {
  if (!sourceUrl) return photo.fileUrl ?? null;

  if (previousSourceUrl && previousSourceUrl !== sourceUrl) {
    await deleteCloudflareImage(photo.storedFileName);
  }

  const deliveryUrl = await ensureCloudflareCachedImage({
    customId: photo.storedFileName,
    sourceUrl,
    metadata: {
      photoId: photo.id.toString(),
    },
  });
  if (deliveryUrl && deliveryUrl !== photo.fileUrl) await persistFreshUrl(deliveryUrl);
  return deliveryUrl ?? null;
}

function isUsableImageUrl(url: string | null | undefined) {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !isCloudflareDeliveryUrl(url);
  } catch {
    return false;
  }
}

function resolveStoredSourceUrl(filePath: string | null | undefined, fileUrl: string | null | undefined) {
  return isUsableImageUrl(fileUrl) ? fileUrl : isUsableImageUrl(filePath) ? filePath : null;
}

async function retryCloudflareFromNotionSource(
  photo: PhotoRedirectRecord,
  persistFreshUrl: (freshUrl: string) => Promise<unknown>,
) {
  const notionSourceUrl = await resolveNotionPhotoSourceUrl(photo.storedFileName);
  if (!notionSourceUrl || notionSourceUrl === photo.fileUrl) return null;

  const freshUrl = await ensureCloudflareCachedImage({
    customId: photo.storedFileName,
    sourceUrl: notionSourceUrl,
    metadata: {
      photoId: photo.id.toString(),
    },
  });
  if (freshUrl && freshUrl !== photo.fileUrl) {
    await persistFreshUrl(freshUrl);
    return freshUrl;
  }

  return null;
}

async function resolveNotionPhotoSourceUrl(storedFileName: string) {
  const env = getRuntimeEnv();
  const notionToken = env.NOTION_TOKEN;
  if (!notionToken) return null;

  const match = /^notion:([^:]+):(\d+)$/.exec(storedFileName || "");
  if (!match) return null;

  const pageId = match[1];
  const index = Number(match[2]);
  if (!Number.isFinite(index)) return null;

  const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: {
      Authorization: `Bearer ${notionToken}`,
      "Content-Type": "application/json",
      "Notion-Version": env.NOTION_API_VERSION || "2025-09-03",
    },
    cache: "no-store",
  });

  if (!response.ok) return null;

  const page = (await response.json()) as {
    properties?: Record<string, { type?: string; files?: Array<{ file?: { url?: string }; external?: { url?: string } }> }>;
  };
  const photosProp = findProperty(page.properties, ["Photos", "photos", "Picture", "picture", "사진"]);
  if (!photosProp || photosProp.type !== "files") return null;

  const photo = photosProp.files?.[index];
  return photo?.file?.url || photo?.external?.url || null;
}

function findProperty(
  props: Record<string, { type?: string; files?: Array<{ file?: { url?: string }; external?: { url?: string } }> }> | undefined,
  names: string[],
) {
  if (!props) return null;
  for (const name of names) {
    if (props[name]) return props[name];
  }
  return null;
}

type EntryQueueUpsertStatus = "WAITING" | "READY";

function entryQueueStatusFor(status: UserStatus, openLevel: OpenLevel): EntryQueueUpsertStatus {
  return status === "READY" && openLevel === "FULL_OPEN" ? "READY" : "WAITING";
}

function normalizeHumanName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
}

async function ensureSupabaseEntryQueueRow(
  userId: number,
  status: UserStatus,
  openLevel: OpenLevel,
  memo: string,
) {
  if (!hasSupabaseRestConfig()) return;

  const [existing] = await supabaseRest<{ id: number }[]>(
    `/entry_queue?select=id&user_id=eq.${userId}&limit=1`,
  );
  if (existing) return;

  await supabaseRest("/entry_queue", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      status: entryQueueStatusFor(status, openLevel),
      memo,
    }),
  });
}

async function promoteUserToFullOpenOnPhotoSupabase(userId: number) {
  if (!hasSupabaseRestConfig()) return;

  const roles = await supabaseRest<{ role: UserRole }[]>(`/user_roles?select=role&user_id=eq.${userId}`);
  if (!roles.some((row) => row.role === ("PARTICIPANT" as UserRole))) return;

  const [user] = await supabaseRest<
    { id: number; status: UserStatus; open_level: OpenLevel | null }[]
  >(`/users?select=id,status,open_level&id=eq.${userId}&limit=1`);
  if (!user) return;

  if (user.open_level !== "FULL_OPEN") {
    await supabaseRest(`/users?id=eq.${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ open_level: "FULL_OPEN" }),
    });
  }

  if (user.status !== "READY") return;

  const payload = {
    ready_at: new Date().toISOString(),
    memo: "auto:photo:full-open",
  };

  const [ready] = await supabaseRest<{ id: number }[]>(
    `/entry_queue?select=id&user_id=eq.${userId}&status=eq.READY&limit=1`,
  );
  if (ready) {
    await supabaseRest(`/entry_queue?id=eq.${ready.id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return;
  }

  const [waiting] = await supabaseRest<{ id: number }[]>(
    `/entry_queue?select=id&user_id=eq.${userId}&status=eq.WAITING&limit=1`,
  );
  if (waiting) {
    await supabaseRest(`/entry_queue?id=eq.${waiting.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "READY", ...payload }),
    });
    return;
  }

  await supabaseRest("/entry_queue", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      status: "READY",
      ...payload,
    }),
  });
}

async function promoteUserToFullOpenOnPhotoPrisma(tx: Prisma.TransactionClient, userId: bigint) {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { status: true, openLevel: true } });
  if (!user) return;

  const roleCount = await tx.userRoleAssignment.count({
    where: { userId, role: "PARTICIPANT" },
  });
  if (roleCount === 0) return;

  if (user.openLevel !== "FULL_OPEN") {
    await tx.user.update({ where: { id: userId }, data: { openLevel: "FULL_OPEN" } });
  }

  if (user.status !== "READY") return;

  const payload = {
    readyAt: new Date(),
    memo: "auto:photo:full-open",
  };

  const ready = await tx.entryQueue.findUnique({
    where: { userId_status: { userId, status: "READY" } },
    select: { id: true },
  });
  if (ready) {
    await tx.entryQueue.update({
      where: { id: ready.id },
      data: payload,
    });
    return;
  }

  const waiting = await tx.entryQueue.findUnique({
    where: { userId_status: { userId, status: "WAITING" } },
    select: { id: true },
  });
  if (waiting) {
    await tx.entryQueue.update({
      where: { id: waiting.id },
      data: { status: "READY", ...payload },
    });
    return;
  }

  await tx.entryQueue.create({
    data: {
      userId,
      status: "READY",
      ...payload,
    },
  });
}

async function reconcileSupabaseEntryQueueForExposure(
  userId: number,
  status: UserStatus,
  openLevel: OpenLevel,
  memo: string,
) {
  if (!hasSupabaseRestConfig()) return;

  const roles = await supabaseRest<{ role: UserRole }[]>(`/user_roles?select=role&user_id=eq.${userId}`);
  if (!roles.some((row) => row.role === ("PARTICIPANT" as UserRole))) return;

  const shouldBeReady = status === "READY" && openLevel === "FULL_OPEN";
  const payload = shouldBeReady
    ? { status: "READY", ready_at: new Date().toISOString(), memo }
    : { status: "WAITING", memo };

  const [ready] = await supabaseRest<{ id: number }[]>(
    `/entry_queue?select=id&user_id=eq.${userId}&status=eq.READY&limit=1`,
  );
  const [waiting] = await supabaseRest<{ id: number }[]>(
    `/entry_queue?select=id&user_id=eq.${userId}&status=eq.WAITING&limit=1`,
  );

  if (shouldBeReady) {
    if (ready) {
      await supabaseRest(`/entry_queue?id=eq.${ready.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      return;
    }
    if (waiting) {
      await supabaseRest(`/entry_queue?id=eq.${waiting.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      return;
    }
    await supabaseRest("/entry_queue", { method: "POST", body: JSON.stringify({ user_id: userId, ...payload }) });
    return;
  }

  if (waiting) {
    await supabaseRest(`/entry_queue?id=eq.${waiting.id}`, { method: "PATCH", body: JSON.stringify(payload) });
    return;
  }
  if (ready) {
    await supabaseRest(`/entry_queue?id=eq.${ready.id}`, { method: "PATCH", body: JSON.stringify(payload) });
    return;
  }
  await supabaseRest("/entry_queue", { method: "POST", body: JSON.stringify({ user_id: userId, ...payload }) });
}

async function reconcileEntryQueueForExposureWithPrisma(
  tx: Prisma.TransactionClient,
  userId: bigint,
  status: UserStatus,
  openLevel: OpenLevel,
  memo: string,
) {
  const roleCount = await tx.userRoleAssignment.count({ where: { userId, role: "PARTICIPANT" } });
  if (roleCount === 0) return;

  const shouldBeReady = status === "READY" && openLevel === "FULL_OPEN";
  const payload = shouldBeReady
    ? { status: "READY" as const, readyAt: new Date(), memo }
    : { status: "WAITING" as const, memo };

  const ready = await tx.entryQueue.findUnique({
    where: { userId_status: { userId, status: "READY" } },
    select: { id: true },
  });
  const waiting = await tx.entryQueue.findUnique({
    where: { userId_status: { userId, status: "WAITING" } },
    select: { id: true },
  });

  if (shouldBeReady) {
    if (ready) {
      await tx.entryQueue.update({ where: { id: ready.id }, data: payload });
      return;
    }
    if (waiting) {
      await tx.entryQueue.update({ where: { id: waiting.id }, data: payload });
      return;
    }
    await tx.entryQueue.create({ data: { userId, ...payload } });
    return;
  }

  if (waiting) {
    await tx.entryQueue.update({ where: { id: waiting.id }, data: payload });
    return;
  }
  if (ready) {
    await tx.entryQueue.update({ where: { id: ready.id }, data: payload });
    return;
  }
  await tx.entryQueue.create({ data: { userId, ...payload } });
}

function normalizeRoles(roles: UserRole[]): UserRole[] {
  return roles.length > 0 ? roles : ["PARTICIPANT" as UserRole];
}

function applyUserFiltersAndSort(filters: MemberFilterState, users: DashboardUser[]) {
  const ageMin = parseOptionalNumber(filters.ageMin);
  const ageMax = parseOptionalNumber(filters.ageMax);
  const heightMin = parseOptionalNumber(filters.heightMin);
  const heightMax = parseOptionalNumber(filters.heightMax);

  return users
    .filter((user) => {
      if (filters.status !== "ALL" && user.status !== filters.status) return false;
      if (filters.gender !== "ALL" && user.genderCode !== filters.gender) return false;
      if (ageMin !== null && (user.ageSortValue === 0 || user.ageSortValue < ageMin)) return false;
      if (ageMax !== null && (user.ageSortValue === 0 || user.ageSortValue > ageMax)) return false;
      if (heightMin !== null && (user.heightCm === 0 || user.heightCm < heightMin)) return false;
      if (heightMax !== null && (user.heightCm === 0 || user.heightCm > heightMax)) return false;
      return true;
    })
    .sort((a, b) => {
      if (filters.sort === "name_asc") return a.name.localeCompare(b.name, "ko-KR");
      if (filters.sort === "age_asc") return sortNumber(a.ageSortValue, b.ageSortValue, "asc");
      if (filters.sort === "age_desc") return sortNumber(a.ageSortValue, b.ageSortValue, "desc");
      if (filters.sort === "height_asc") return sortNumber(a.heightCm, b.heightCm, "asc");
      if (filters.sort === "height_desc") return sortNumber(a.heightCm, b.heightCm, "desc");
      if (filters.sort === "gender_asc") return (a.genderCode ?? "").localeCompare(b.genderCode ?? "");
      return 0;
    });
}

function sortNumber(a: number, b: number, direction: "asc" | "desc") {
  if (a === 0 && b === 0) return 0;
  if (a === 0) return 1;
  if (b === 0) return -1;
  return direction === "asc" ? a - b : b - a;
}

function parseOptionalNumber(value: string) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function ageFromBirthDate(birthDate: Date | null) {
  if (!birthDate) return 0;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hadBirthday =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());

  if (!hadBirthday) age -= 1;
  return age;
}

function ageFromProfile(birthDate: Date | null, ageText: string | null) {
  const birthDateAge = ageFromBirthDate(birthDate);
  if (birthDateAge > 0) return birthDateAge;
  return ageFromText(ageText);
}

function ageFromText(ageText: string | null) {
  const match = ageText?.match(/\d{2,4}/);
  if (!match) return 0;

  const value = Number.parseInt(match[0], 10);
  if (!Number.isFinite(value)) return 0;
  if (value >= 1900) return new Date().getFullYear() - value;
  if (value >= 0 && value <= 9) return 2000 + value <= new Date().getFullYear() ? new Date().getFullYear() - (2000 + value) : 0;
  if (value >= 10 && value <= 29) return new Date().getFullYear() - (2000 + value);
  if (value >= 30 && value <= 99) return new Date().getFullYear() - (1900 + value);
  return value;
}

function toDashboardIntroCase(
  introCase: Prisma.IntroCaseGetPayload<{ include: typeof introCaseInclude }>,
): DashboardIntroCase {
  const sortedParticipants = [...introCase.participants].sort((a, b) =>
    a.participantRole.localeCompare(b.participantRole),
  );
  const participants = sortedParticipants.map((participant) => participant.user.name);
  const participantIds = sortedParticipants.map((participant) => Number(participant.userId));

  return {
    id: Number(introCase.id),
    status: introCase.status,
    participantIds: participantIds.length === 2 ? [participantIds[0], participantIds[1]] : [],
    participants: participants.length === 2 ? [participants[0], participants[1]] : [],
    invitorId: introCase.invitorUserId ? Number(introCase.invitorUserId) : undefined,
    invitor: introCase.invitor?.name ?? "미지정",
    memo: introCase.memo ?? "",
    updatedAt: formatDateTime(introCase.updatedAt),
    updatedAtIso: introCase.updatedAt.toISOString(),
  };
}

function toDashboardIntroCaseFromSupabase(
  introCase: SupabaseIntroCaseRow,
  participants: SupabaseIntroParticipantRow[],
  namesByUserId: Map<number, string>,
): DashboardIntroCase {
  const sortedParticipants = participants
    .filter((participant) => participant.intro_case_id === introCase.id)
    .sort((a, b) => a.participant_role.localeCompare(b.participant_role));
  const participantNames = sortedParticipants.map((participant) => namesByUserId.get(participant.user_id) ?? "미확인");
  const participantIds = sortedParticipants.map((participant) => participant.user_id);

  return {
    id: introCase.id,
    status: introCase.status,
    participantIds: participantIds.length === 2 ? [participantIds[0], participantIds[1]] : [],
    participants: participantNames.length === 2 ? [participantNames[0], participantNames[1]] : [],
    invitorId: introCase.invitor_user_id ?? undefined,
    invitor: introCase.invitor_user_id ? namesByUserId.get(introCase.invitor_user_id) ?? "미확인" : "미지정",
    memo: introCase.memo ?? "",
    updatedAt: formatDateTime(new Date(introCase.updated_at)),
    updatedAtIso: introCase.updated_at,
  };
}

async function syncUserStatusesAfterIntroChange(userIds: number[]) {
  for (const userId of new Set(userIds)) {
    const activeParticipations = await supabaseRest<SupabaseIntroParticipantRow[]>(
      `/intro_case_participants?select=intro_case_id,user_id,participant_role,response_status,user_id&user_id=eq.${userId}`,
    );
    const introCaseIds = activeParticipations.map((participant) => participant.intro_case_id);
    const activeCases =
      introCaseIds.length > 0
        ? await supabaseRest<SupabaseIntroCaseRow[]>(
            `/intro_cases?select=id,status&id=in.(${introCaseIds.join(",")})&status=in.(${Array.from(activeIntroStatusSet).join(",")})`,
          )
        : [];
    const [user] = await supabaseRest<SupabaseUserRow[]>(`/users?id=eq.${userId}&select=status`);
    const nextStatus = activeCases.length > 0 ? "PROGRESSING" : user.status === "PROGRESSING" ? "READY" : user.status;

    if (nextStatus !== user.status) {
      await supabaseRest(`/users?id=eq.${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
    }
  }
}

async function findSupabaseIntroCaseIdForParticipantPair(personAId: number, personBId: number) {
  const participants = await supabaseRest<Pick<SupabaseIntroParticipantRow, "intro_case_id" | "user_id">[]>(
    `/intro_case_participants?select=intro_case_id,user_id&user_id=in.(${personAId},${personBId})&limit=1000`,
  );
  const userIdsByIntroCaseId = new Map<number, Set<number>>();
  for (const participant of participants) {
    userIdsByIntroCaseId.set(
      participant.intro_case_id,
      new Set([...(userIdsByIntroCaseId.get(participant.intro_case_id) ?? []), participant.user_id]),
    );
  }

  for (const [introCaseId, userIds] of userIdsByIntroCaseId) {
    if (userIds.size === 2 && userIds.has(personAId) && userIds.has(personBId)) return introCaseId;
  }

  return null;
}

async function hasSupabaseActiveIntroConflict(userIds: number[]) {
  for (const userId of userIds) {
    const participants = await supabaseRest<Pick<SupabaseIntroParticipantRow, "intro_case_id">[]>(
      `/intro_case_participants?select=intro_case_id&user_id=eq.${userId}&limit=200`,
    );
    const introCaseIds = participants.map((participant) => participant.intro_case_id);
    if (introCaseIds.length === 0) continue;
    const activeCases = await supabaseRest<Pick<SupabaseIntroCaseRow, "id">[]>(
      `/intro_cases?select=id&id=in.(${introCaseIds.join(",")})&status=in.(${Array.from(activeIntroStatusSet).join(",")})&limit=1`,
    );
    if (activeCases.length > 0) return true;
  }

  return false;
}

async function findPrismaIntroCaseIdForParticipantPair(
  tx: Prisma.TransactionClient,
  personAId: bigint,
  personBId: bigint,
) {
  const participants = await tx.introCaseParticipant.findMany({
    where: { userId: { in: [personAId, personBId] } },
    select: { introCaseId: true, userId: true },
  });
  const userIdsByIntroCaseId = new Map<string, Set<string>>();
  for (const participant of participants) {
    const introCaseId = participant.introCaseId.toString();
    userIdsByIntroCaseId.set(
      introCaseId,
      new Set([...(userIdsByIntroCaseId.get(introCaseId) ?? []), participant.userId.toString()]),
    );
  }

  for (const [introCaseId, userIds] of userIdsByIntroCaseId) {
    if (
      userIds.size === 2 &&
      userIds.has(personAId.toString()) &&
      userIds.has(personBId.toString())
    ) {
      return BigInt(introCaseId);
    }
  }

  return null;
}

async function hasPrismaActiveIntroConflict(tx: Prisma.TransactionClient, userIds: bigint[]) {
  for (const userId of userIds) {
    const activeCount = await tx.introCaseParticipant.count({
      where: {
        userId,
        introCase: { status: { in: Array.from(activeIntroStatusSet) } },
      },
    });
    if (activeCount > 0) return true;
  }

  return false;
}

async function syncUserStatusesAfterIntroChangeWithPrisma(
  tx: Prisma.TransactionClient,
  userIds: bigint[],
) {
  for (const userId of new Set(userIds)) {
    const activeCount = await tx.introCaseParticipant.count({
      where: {
        userId,
        introCase: {
          status: {
            in: Array.from(activeIntroStatusSet),
          },
        },
      },
    });
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { status: true },
    });
    const nextStatus = activeCount > 0 ? "PROGRESSING" : user.status === "PROGRESSING" ? "READY" : user.status;

    if (nextStatus !== user.status) {
      await tx.user.update({
        where: { id: userId },
        data: { status: nextStatus },
      });
    }
  }
}

function defaultFilters(): MemberFilterState {
  return {
    view: "pool",
    recommendationFor: "",
    introStatus: "ALL",
    status: "ALL",
    gender: "ALL",
    ageMin: "",
    ageMax: "",
    heightMin: "",
    heightMax: "",
    sort: "updated_desc",
  };
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function labelForGender(gender: Gender): DashboardUser["gender"] {
  if (gender === "FEMALE") return "여성";
  if (gender === "MALE") return "남성";
  if (gender === "OTHER") return "기타";
  return "비공개";
}
