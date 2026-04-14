import {
  IntroCaseStatus,
  IntroParticipantRole,
  Prisma,
  type Gender,
  type UserRole,
  type UserStatus,
} from "@prisma/client";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { prisma, hasDatabaseUrl } from "@/lib/prisma";
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
};

type UploadedPhotoInput = Required<Pick<PhotoInput, "url" | "storedFileName" | "filePath" | "mimeType" | "fileSizeBytes">> & {
  originalFileName: string;
};

const userInclude = {
  roles: true,
  mainPhoto: true,
  photos: {
    where: {
      isMain: true,
      deletedAt: null,
    },
    take: 1,
  },
} satisfies Prisma.UserInclude;

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
const photoBucketName = process.env.SUPABASE_PHOTO_BUCKET || "user-photos";
const photoUploadMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const maxPhotoUploadBytes = 10 * 1024 * 1024;

export type MemberDashboardData = {
  users: DashboardUser[];
  allUsers: DashboardUser[];
  introCases: DashboardIntroCase[];
  databaseConnected: boolean;
  loadError: string | null;
};

export async function getMemberDashboardData(filters: MemberFilterState = defaultFilters()): Promise<MemberDashboardData> {
  if (hasDatabaseUrl()) {
    return getMemberDashboardDataFromPrisma(filters);
  }

  if (hasSupabaseRestConfig()) {
    return getMemberDashboardDataFromSupabaseRest(filters);
  }

    return {
      users: [],
      allUsers: [],
      introCases: [],
      databaseConnected: false,
      loadError: "DATABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.",
    };
}

async function getMemberDashboardDataFromPrisma(filters: MemberFilterState): Promise<MemberDashboardData> {
  try {
    const users = await prisma.user.findMany({
      include: userInclude,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 100,
    });
    const introCases = await prisma.introCase.findMany({
      include: introCaseInclude,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 100,
    });
    const dashboardUsers = users.map((user) => {
      const userAge = ageFromProfile(user.birthDate, user.ageText);
      const mainPhoto = user.mainPhoto && !user.mainPhoto.deletedAt ? user.mainPhoto : user.photos[0];
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
        roles: user.roles.map((role) => role.role),
        hasMainPhoto: Boolean(mainPhoto),
        mainPhotoUrl: photoDisplayUrl(mainPhoto?.id),
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

async function getMemberDashboardDataFromSupabaseRest(filters: MemberFilterState): Promise<MemberDashboardData> {
  try {
    const users = await supabaseRest<SupabaseUserRow[]>(
      "/users?select=*&order=updated_at.desc,id.desc&limit=100",
    );
    const userIds = users.map((user) => user.id);
    const roles =
      userIds.length > 0
        ? await supabaseRest<SupabaseRoleRow[]>(`/user_roles?select=user_id,role&user_id=in.(${userIds.join(",")})`)
        : [];
    const photos =
      userIds.length > 0
        ? await supabaseRest<SupabasePhotoRow[]>(
            `/user_photos?select=id,user_id,original_file_name,stored_file_name,file_path,file_url,mime_type,sort_order,is_main,uploaded_at&user_id=in.(${userIds.join(",")})&deleted_at=is.null&order=user_id.asc,sort_order.asc,id.asc`,
          )
        : [];
    const rolesByUserId = groupByUserId(roles);
    const photosByUserId = groupPhotosByUserId(photos);
    const introCases = await supabaseRest<SupabaseIntroCaseRow[]>(
      "/intro_cases?select=id,status,invitor_user_id,updated_at,memo&order=updated_at.desc,id.desc&limit=100",
    );
    const introCaseIds = introCases.map((introCase) => introCase.id);
    const introParticipants =
      introCaseIds.length > 0
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
      const mainPhoto = findMainSupabasePhoto(photosByUserId.get(user.id) ?? [], user.main_photo_id);
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
        openLevel: user.open_level ?? (mainPhoto ? "FULL_OPEN" : "PRIVATE"),
        roles: rolesByUserId.get(user.id) ?? [],
        hasMainPhoto: Boolean(mainPhoto),
        mainPhotoUrl: photoDisplayUrl(mainPhoto?.id),
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
      roles: user.roles.map((role) => role.role),
      hasMainPhoto: Boolean(mainPhoto),
      mainPhotoUrl: photoDisplayUrl(mainPhoto?.id),
      lastChangedAt: formatDateTime(user.updatedAt),
      photos: user.photos.map((photo) => ({
        id: Number(photo.id),
        url: photoDisplayUrl(photo.id) ?? photo.fileUrl ?? photo.filePath,
        sourceUrl: photo.fileUrl ?? photo.filePath,
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
    roles: roles.map((role) => role.role),
    hasMainPhoto: Boolean(mainPhoto),
    mainPhotoUrl: photoDisplayUrl(mainPhoto?.id),
    lastChangedAt: formatDateTime(new Date(user.updated_at)),
    photos: photos.map(toDashboardPhoto),
  };
}

export async function uploadUserPhotoFile(userId: bigint, file: File): Promise<UploadedPhotoInput> {
  assertPhotoFile(file);

  const originalFileName = sanitizeFileName(file.name || "clipboard-image");
  const extension = extensionForPhoto(file.type, originalFileName);
  const storedFileName = `${randomUUID()}${extension}`;
  const filePath = `users/${userId.toString()}/${storedFileName}`;
  const body = Buffer.from(await file.arrayBuffer());

  await ensureSupabasePhotoBucket();
  await supabaseStorage(`/object/${photoBucketName}/${encodePathSegments(filePath)}`, {
    method: "POST",
    headers: {
      "Content-Type": file.type,
      "x-upsert": "false",
    },
    body,
  });

  return {
    url: `${getSupabaseUrl()}/storage/v1/object/public/${photoBucketName}/${encodePathSegments(filePath)}`,
    originalFileName,
    storedFileName,
    filePath,
    mimeType: file.type,
    fileSizeBytes: file.size,
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

    return resolvePhotoRedirectUrl(
      {
        id: Number(photo.id),
        storedFileName: photo.storedFileName,
        filePath: photo.filePath,
        fileUrl: photo.fileUrl,
      },
      (freshUrl) =>
        prisma.userPhoto.update({
          where: { id: photo.id },
          data: { fileUrl: freshUrl, filePath: freshUrl },
        }),
    );
  }

  if (!hasSupabaseRestConfig()) return null;

  const [photo] = await supabaseRest<SupabasePhotoRow[]>(
    `/user_photos?id=eq.${photoId.toString()}&deleted_at=is.null&select=*`,
  );
  if (!photo) return null;

  return resolvePhotoRedirectUrl(
    {
      id: photo.id,
      storedFileName: photo.stored_file_name,
      filePath: photo.file_path,
      fileUrl: photo.file_url,
    },
    (freshUrl) =>
      supabaseRest(`/user_photos?id=eq.${photo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ file_url: freshUrl, file_path: freshUrl }),
      }),
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
    const [photo] = await supabaseRest<SupabasePhotoRow[]>(`/user_photos?id=eq.${photoId.toString()}&select=*`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(toSupabasePhotoPayload(existing.user_id, input)),
    });
    if (input.isMain) await updateSupabaseMainPhoto(existing.user_id, photo.id);
    return photo;
  }

  assertDatabaseUrl();

  return prisma.$transaction(async (tx) => {
    const existing = await tx.userPhoto.findUniqueOrThrow({ where: { id: photoId } });
    if (input.isMain) {
      await tx.userPhoto.updateMany({ where: { userId: existing.userId }, data: { isMain: false } });
    }
    const photo = await tx.userPhoto.update({
      where: { id: photoId },
      data: toPrismaPhotoPayload(existing.userId, input),
    });
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
    await tx.userPhoto.delete({ where: { id: photoId } });
  });
}

export async function createIntroCase(input: IntroCaseInput) {
  if (input.personAId === input.personBId) {
    throw new Error("Intro case requires two different participants.");
  }

  if (!hasDatabaseUrl() && hasSupabaseRestConfig()) {
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

async function supabaseStorage<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!hasSupabaseRestConfig()) {
    throw new Error("Supabase URL or service role key is not configured.");
  }

  const response = await fetch(`${getSupabaseUrl()}/storage/v1${path}`, {
    ...init,
    headers: {
      apikey: getSupabaseServerKey(),
      Authorization: `Bearer ${getSupabaseServerKey()}`,
      ...init.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase Storage ${response.status}: ${text}`);
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function ensureSupabasePhotoBucket() {
  const response = await fetch(`${getSupabaseUrl()}/storage/v1/bucket/${photoBucketName}`, {
    headers: {
      apikey: getSupabaseServerKey(),
      Authorization: `Bearer ${getSupabaseServerKey()}`,
    },
  });

  if (response.ok) return;
  if (response.status !== 404) {
    const text = await response.text();
    throw new Error(`Supabase Storage ${response.status}: ${text}`);
  }

  try {
    await supabaseStorage("/bucket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: photoBucketName,
        name: photoBucketName,
        public: true,
        file_size_limit: maxPhotoUploadBytes,
        allowed_mime_types: [...photoUploadMimeTypes],
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("409")) return;
    throw error;
  }
}

function toSupabaseUserPayload(input: MemberInput, includePhone: boolean) {
  return {
    name: input.name,
    gender: input.gender,
    status: input.status,
    open_level: input.openLevel,
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
    url: photoDisplayUrl(photo.id) ?? photo.file_url ?? photo.file_path,
    sourceUrl: photo.file_url ?? photo.file_path,
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

function encodePathSegments(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
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

function groupPhotosByUserId(rows: SupabasePhotoRow[]) {
  const photosByUserId = new Map<number, SupabasePhotoRow[]>();

  for (const row of rows) {
    photosByUserId.set(row.user_id, [...(photosByUserId.get(row.user_id) ?? []), row]);
  }

  return photosByUserId;
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

type PhotoRedirectRecord = {
  id: number;
  storedFileName: string;
  filePath: string;
  fileUrl: string | null;
};

async function resolvePhotoRedirectUrl(
  photo: PhotoRedirectRecord,
  persistFreshUrl: (freshUrl: string) => Promise<unknown>,
) {
  const fallbackUrl = photo.fileUrl ?? photo.filePath;
  const notionPhoto = parseNotionStoredFileName(photo.storedFileName);
  if (!notionPhoto) return fallbackUrl;

  const freshUrl = await fetchNotionPhotoUrl(notionPhoto.pageId, notionPhoto.index);
  if (!freshUrl) return fallbackUrl;
  if (freshUrl !== fallbackUrl) await persistFreshUrl(freshUrl);
  return freshUrl;
}

function parseNotionStoredFileName(storedFileName: string) {
  const match = storedFileName.match(/^notion:([^:]+):(\d+)$/);
  if (!match) return null;

  return {
    pageId: match[1],
    index: Number.parseInt(match[2], 10),
  };
}

type NotionFile = {
  file?: { url?: string };
  external?: { url?: string };
};

type NotionProperty = {
  type?: string;
  files?: NotionFile[];
};

async function fetchNotionPhotoUrl(pageId: string, index: number) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return null;

  const response = await fetch(`https://api.notion.com/v1/pages/${encodeURIComponent(pageId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": process.env.NOTION_API_VERSION || "2022-06-28",
    },
    cache: "no-store",
  });
  if (!response.ok) return null;

  const page = (await response.json()) as { properties?: Record<string, NotionProperty> };
  const files = findNotionFilesProperty(page.properties);
  return files?.[index]?.file?.url ?? files?.[index]?.external?.url ?? null;
}

function findNotionFilesProperty(properties: Record<string, NotionProperty> | undefined) {
  if (!properties) return null;

  for (const key of ["Photos", "photos", "Picture", "picture", "사진"]) {
    const property = properties[key];
    if (property?.type === "files") return property.files ?? [];
  }

  return Object.values(properties).find((property) => property.type === "files")?.files ?? null;
}

function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}

function getSupabaseServerKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
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
