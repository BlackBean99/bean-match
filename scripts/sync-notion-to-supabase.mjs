import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

loadEnvFile(".env");
loadEnvFile(".env.local");

const prisma = process.env.DATABASE_URL ? new PrismaClient() : null;
const NOTION_VERSION = process.env.NOTION_API_VERSION || "2022-06-28";
const NOTION_TOKEN = requiredEnv("NOTION_TOKEN");
const MAIN_DATA_SOURCE_ID =
  process.env.NOTION_MAIN_DATA_SOURCE_ID || process.env.NOTION_USERS_DATABASE_ID;
const INVITOR_DATA_SOURCE_ID = process.env.NOTION_INVITOR_DATA_SOURCE_ID;
const write = process.argv.includes("--write");
const notionSources = [
  MAIN_DATA_SOURCE_ID
    ? { id: MAIN_DATA_SOURCE_ID, name: "메인DB", sourceType: "main", defaultRoles: ["PARTICIPANT"] }
    : null,
  INVITOR_DATA_SOURCE_ID
    ? { id: INVITOR_DATA_SOURCE_ID, name: "소개모집인", sourceType: "invitor", defaultRoles: ["INVITOR"] }
    : null,
].filter(Boolean);

const genderMap = new Map([
  ["female", "FEMALE"],
  ["여성", "FEMALE"],
  ["여", "FEMALE"],
  ["여자", "FEMALE"],
  ["male", "MALE"],
  ["남성", "MALE"],
  ["남", "MALE"],
  ["남자", "MALE"],
  ["other", "OTHER"],
  ["기타", "OTHER"],
  ["undisclosed", "UNDISCLOSED"],
  ["비공개", "UNDISCLOSED"],
]);

const userStatusValues = new Set([
  "INCOMPLETE",
  "READY",
  "PROGRESSING",
  "HOLD",
  "STOP_REQUESTED",
  "ARCHIVED",
  "BLOCKED",
]);

const userRoleValues = new Set(["PARTICIPANT", "INVITOR", "ADMIN"]);

const userStatusMap = new Map([
  ["정보 미완성", "INCOMPLETE"],
  ["소개 가능", "READY"],
  ["소개 진행 중", "PROGRESSING"],
  ["잠시 보류", "HOLD"],
  ["탈퇴 요청", "STOP_REQUESTED"],
  ["보관 완료", "ARCHIVED"],
  ["운영 제한", "BLOCKED"],
]);

class NotionApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

try {
  if (notionSources.length === 0) {
    throw new Error("Missing required environment variable: NOTION_MAIN_DATA_SOURCE_ID");
  }

  const results = [];

  for (const source of notionSources) {
    const users = await collectNotionPages(source.id);

    for (const page of users) {
      let input;
      try {
        input = mapUserPage(page, source.defaultRoles);
      } catch (error) {
        results.push({
          pageId: page.id,
          source: source.name,
          action: "skipped",
          reason: error instanceof Error ? error.message : "Invalid Notion page",
        });
        continue;
      }
      const checksum = sha256(JSON.stringify(input));
      const rawChecksum = sha256(JSON.stringify(page));
      const existingSync = await findSyncRecord(page.id);

      if (existingSync?.checksum === checksum) {
        results.push({ pageId: page.id, source: source.name, action: "skipped" });
        continue;
      }

      if (!write) {
        results.push({
          pageId: page.id,
          source: source.name,
          action: existingSync ? "would_update" : "would_create",
          name: input.user.name,
          status: input.user.status,
          roles: input.roles,
        });
        continue;
      }

      const result = await writeUserFromNotion(existingSync, input, page, checksum, rawChecksum, source);

      results.push({
        pageId: page.id,
        source: source.name,
        action: existingSync ? "updated" : "created",
        userId: result.id.toString(),
        name: result.name,
      });
    }
  }

  console.log(JSON.stringify({ write, users: results }, null, 2));
} finally {
  await prisma?.$disconnect();
}

async function findSyncRecord(notionPageId) {
  if (prisma) {
    return prisma.notionSyncRecord.findUnique({
      where: { notionPageId },
    });
  }

  const [record] = await supabaseRest(
    `/notion_sync_records?notion_page_id=eq.${encodeURIComponent(notionPageId)}&select=*`,
  );

  return record
    ? {
        entityId: BigInt(record.entity_id),
        checksum: record.checksum,
        notionPageId: record.notion_page_id,
      }
    : null;
}

async function writeUserFromNotion(existingSync, input, page, checksum, rawChecksum, source) {
  if (prisma) {
    return prisma.$transaction(async (tx) => {
      await upsertRawNotionRecordWithPrisma(tx, page, rawChecksum, source);

      const user = existingSync
        ? await tx.user.update({
            where: { id: existingSync.entityId },
            data: input.user,
          })
        : await tx.user.create({
            data: input.user,
          });

      await tx.userRoleAssignment.deleteMany({
        where: { userId: user.id },
      });

      if (input.roles.length > 0) {
        await tx.userRoleAssignment.createMany({
          data: input.roles.map((role) => ({ userId: user.id, role })),
          skipDuplicates: true,
        });
      }

      await tx.notionSyncRecord.upsert({
        where: { notionPageId: page.id },
        create: {
          entityType: "User",
          entityId: user.id,
          notionPageId: page.id,
          checksum,
          notionEditedAt: page.last_edited_time ? new Date(page.last_edited_time) : null,
        },
        update: {
          entityType: "User",
          entityId: user.id,
          checksum,
          lastSyncedAt: new Date(),
          notionEditedAt: page.last_edited_time ? new Date(page.last_edited_time) : null,
        },
      });

      await syncUserPhotosWithPrisma(tx, user.id, page.id, input.photos);

      return user;
    });
  }

  await upsertRawNotionRecordWithSupabase(page, rawChecksum, source);

  const userPayload = toSupabaseUserPayload(input.user);
  const userRows = existingSync
    ? await supabaseRest(`/users?id=eq.${existingSync.entityId.toString()}&select=*`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(userPayload),
      })
    : await supabaseRest("/users?select=*", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(userPayload),
      });
  const user = userRows[0];

  await supabaseRest(`/user_roles?user_id=eq.${user.id}`, {
    method: "DELETE",
  });

  await supabaseRest("/user_roles", {
    method: "POST",
    body: JSON.stringify(input.roles.map((role) => ({ user_id: user.id, role }))),
  });

  await syncUserPhotosWithSupabase(user.id, page.id, input.photos);

  const syncPayload = {
    entity_type: "User",
    entity_id: user.id,
    notion_page_id: page.id,
    checksum,
    last_synced_at: new Date().toISOString(),
    notion_edited_at: page.last_edited_time || null,
  };

  if (existingSync) {
    await supabaseRest(`/notion_sync_records?notion_page_id=eq.${encodeURIComponent(page.id)}`, {
      method: "PATCH",
      body: JSON.stringify(syncPayload),
    });
  } else {
    await supabaseRest("/notion_sync_records", {
      method: "POST",
      body: JSON.stringify(syncPayload),
    });
  }

  return {
    id: BigInt(user.id),
    name: user.name,
  };
}

function upsertRawNotionRecordWithPrisma(tx, page, checksum, source) {
  return tx.notionRawRecord.upsert({
    where: { notionPageId: page.id },
    create: {
      sourceType: source.sourceType,
      sourceId: source.id,
      sourceName: source.name,
      notionPageId: page.id,
      payload: page,
      checksum,
      notionEditedAt: page.last_edited_time ? new Date(page.last_edited_time) : null,
    },
    update: {
      sourceType: source.sourceType,
      sourceId: source.id,
      sourceName: source.name,
      payload: page,
      checksum,
      lastSyncedAt: new Date(),
      notionEditedAt: page.last_edited_time ? new Date(page.last_edited_time) : null,
    },
  });
}

function upsertRawNotionRecordWithSupabase(page, checksum, source) {
  return supabaseRest("/notion_raw_records?on_conflict=notion_page_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      source_type: source.sourceType,
      source_id: source.id,
      source_name: source.name,
      notion_page_id: page.id,
      payload: page,
      checksum,
      last_synced_at: new Date().toISOString(),
      notion_edited_at: page.last_edited_time || null,
    }),
  });
}

function mapUserPage(page, defaultRoles) {
  const props = page.properties || {};
  const name = textProp(findProperty(props, ["Name", "name", "이름", "성명"])) || firstTitleProp(props);

  if (!name) {
    throw new Error(`Notion user page ${page.id} is missing required Name/title`);
  }

  const status = enumValue(
    selectProp(findProperty(props, ["Status", "status", "상태"])),
    userStatusValues,
    "INCOMPLETE",
    userStatusMap,
  );

  const gender =
    normalizeGender(selectProp(findProperty(props, ["Gender", "gender", "성별"]))) || "UNDISCLOSED";
  const roles = multiSelectProp(findProperty(props, ["Roles", "roles", "역할"]))
    .map((role) => enumValue(role, userRoleValues, null))
    .filter(Boolean);

  return {
    user: {
      name,
      gender,
      status,
      birthDate: dateProp(findProperty(props, ["Birth date", "BirthDate", "birth_date", "생년월일"])),
      ageText: textProp(findProperty(props, ["Age", "age", "age_text", "나이", "출생연도"])),
      phone: textProp(findProperty(props, ["Phone", "phone", "연락처", "전화번호"])),
      contactVisible: checkboxProp(findProperty(props, ["Contact visible", "ContactVisible", "연락처 공개"])),
      heightCm: numberProp(findProperty(props, ["Height", "height_cm", "키"])),
      jobTitle: textProp(findProperty(props, ["Job title", "JobTitle", "job_title", "직업"])),
      companyName: textProp(findProperty(props, ["Company name", "CompanyName", "company_name", "회사"])),
      selfIntro: textProp(
        findProperty(props, ["Self intro", "SelfIntro", "self_intro", "자기소개", "본인 소개", "본인소개"]),
      ),
      idealTypeDescription: textProp(
        findProperty(props, ["Ideal type", "IdealType", "ideal_type_description", "이상형"]),
      ),
    },
    photos: filesProp(findProperty(props, ["Photos", "photos", "Picture", "picture", "사진"])),
    roles: roles.length > 0 ? roles : defaultRoles,
  };
}

async function collectNotionPages(dataSourceId) {
  const pages = [];
  let startCursor;

  do {
    const body = startCursor ? { start_cursor: startCursor } : {};
    const response = await notionFetchWithDatabaseFallback(dataSourceId, body);
    pages.push(...response.results);
    startCursor = response.has_more ? response.next_cursor : undefined;
  } while (startCursor);

  return pages;
}

async function notionFetchWithDatabaseFallback(dataSourceId, body) {
  try {
    return await notionFetch(`/data_sources/${dataSourceId}/query`, {
      method: "POST",
      body: JSON.stringify(body),
    }, "2025-09-03");
  } catch (error) {
    if (error instanceof NotionApiError && (error.status === 400 || error.status === 404)) {
      return notionFetch(`/databases/${dataSourceId}/query`, {
        method: "POST",
        body: JSON.stringify(body),
      }, "2022-06-28");
    }

    throw error;
  }
}

async function notionFetch(path, init = {}, version = NOTION_VERSION) {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Content-Type": "application/json",
      "Notion-Version": version,
      ...init.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new NotionApiError(response.status, `Notion API ${response.status} ${response.statusText}: ${text}`);
  }

  return response.json();
}

function findProperty(props, names) {
  for (const name of names) {
    if (props[name]) return props[name];
  }

  return null;
}

function firstTitleProp(props) {
  const titleProp = Object.values(props).find((prop) => prop?.type === "title");
  return textProp(titleProp);
}

function textProp(prop) {
  if (!prop) return null;
  if (prop.type === "title") return richText(prop.title);
  if (prop.type === "rich_text") return richText(prop.rich_text);
  if (prop.type === "phone_number") return prop.phone_number || null;
  if (prop.type === "email") return prop.email || null;
  if (prop.type === "url") return prop.url || null;
  if (prop.type === "select") return prop.select?.name || null;
  if (prop.type === "status") return prop.status?.name || null;
  if (prop.type === "number") return prop.number?.toString() || null;
  return null;
}

function richText(parts = []) {
  const value = parts.map((part) => part.plain_text || "").join("").trim();
  return value || null;
}

function selectProp(prop) {
  if (prop?.type === "select") return prop.select?.name || null;
  if (prop?.type === "status") return prop.status?.name || null;
  return textProp(prop);
}

function filesProp(prop) {
  if (!prop || prop.type !== "files") return [];

  return prop.files
    .map((file) => ({
      name: file.name || "notion-file",
      url: file.file?.url || file.external?.url || null,
      sourceType: file.type,
    }))
    .filter((file) => file.url);
}

function multiSelectProp(prop) {
  if (!prop) return [];
  if (prop.type === "multi_select") return prop.multi_select.map((item) => item.name);
  const value = textProp(prop);
  return value ? value.split(",").map((item) => item.trim()) : [];
}

function numberProp(prop) {
  if (!prop) return null;
  if (prop.type === "number") return prop.number ?? null;
  const value = Number.parseInt(textProp(prop) || "", 10);
  return Number.isFinite(value) ? value : null;
}

function dateProp(prop) {
  if (!prop || prop.type !== "date" || !prop.date?.start) return null;
  return new Date(prop.date.start);
}

function checkboxProp(prop) {
  return prop?.type === "checkbox" ? prop.checkbox : false;
}

function normalizeGender(value) {
  if (!value) return null;
  return (
    genderMap.get(value.toLowerCase()) ||
    genderMap.get(value) ||
    enumValue(value, new Set(["FEMALE", "MALE", "OTHER", "UNDISCLOSED"]), null)
  );
}

function enumValue(value, allowed, fallback, aliases = new Map()) {
  if (!value) return fallback;
  const alias = aliases.get(value.trim());
  if (alias) return alias;

  const normalized = value.trim().toUpperCase().replaceAll(" ", "_").replaceAll("-", "_");
  return allowed.has(normalized) ? normalized : fallback;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function supabaseRest(path, init = {}) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("DATABASE_URL or SUPABASE_SERVICE_ROLE_KEY is required for sync state.");
  }

  const response = await fetch(`${url}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase REST ${response.status}: ${text}`);
  }

  if (response.status === 204) return null;

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function toSupabaseUserPayload(user) {
  return {
    name: user.name,
    gender: user.gender,
    status: user.status,
    birth_date: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
    age_text: user.ageText,
    phone: user.phone,
    contact_visible: user.contactVisible,
    height_cm: user.heightCm,
    job_title: user.jobTitle,
    company_name: user.companyName,
    self_intro: user.selfIntro,
    ideal_type_description: user.idealTypeDescription,
  };
}

async function syncUserPhotosWithPrisma(tx, userId, notionPageId, photos) {
  await tx.user.update({
    where: { id: userId },
    data: { mainPhotoId: null },
  });

  await tx.userPhoto.deleteMany({
    where: {
      userId,
      storedFileName: { startsWith: `notion:${notionPageId}:` },
    },
  });

  if (photos.length === 0) return;

  const [mainPhoto, ...restPhotos] = photos.map((photo, index) =>
    toPrismaPhotoPayload(userId, notionPageId, photo, index),
  );

  const createdMainPhoto = await tx.userPhoto.create({ data: mainPhoto });

  if (restPhotos.length > 0) {
    await tx.userPhoto.createMany({ data: restPhotos });
  }

  await tx.user.update({
    where: { id: userId },
    data: { mainPhotoId: createdMainPhoto.id },
  });
}

async function syncUserPhotosWithSupabase(userId, notionPageId, photos) {
  await supabaseRest(`/users?id=eq.${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ main_photo_id: null }),
  });

  await supabaseRest(
    `/user_photos?user_id=eq.${userId}&stored_file_name=like.${encodeURIComponent(`notion:${notionPageId}:%`)}`,
    { method: "DELETE" },
  );

  if (photos.length === 0) return;

  const rows = await supabaseRest("/user_photos?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(photos.map((photo, index) => toSupabasePhotoPayload(userId, notionPageId, photo, index))),
  });
  const mainPhoto = rows[0];

  await supabaseRest(`/users?id=eq.${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ main_photo_id: mainPhoto.id }),
  });
}

function toPrismaPhotoPayload(userId, notionPageId, photo, index) {
  return {
    userId,
    photoType: "PROFILE",
    originalFileName: photo.name,
    storedFileName: `notion:${notionPageId}:${index}`,
    filePath: photo.url,
    fileUrl: photo.url,
    mimeType: mimeTypeForName(photo.name),
    fileSizeBytes: BigInt(0),
    sortOrder: index,
    isMain: index === 0,
  };
}

function toSupabasePhotoPayload(userId, notionPageId, photo, index) {
  return {
    user_id: userId,
    photo_type: "PROFILE",
    original_file_name: photo.name,
    stored_file_name: `notion:${notionPageId}:${index}`,
    file_path: photo.url,
    file_url: photo.url,
    mime_type: mimeTypeForName(photo.name),
    file_size_bytes: 0,
    sort_order: index,
    is_main: index === 0,
  };
}

function mimeTypeForName(name) {
  const lowerName = name.toLowerCase();
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg";
  if (lowerName.endsWith(".png")) return "image/png";
  if (lowerName.endsWith(".webp")) return "image/webp";
  if (lowerName.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function loadEnvFile(path) {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!match || process.env[match[1]]) continue;

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[match[1]] = value;
  }
}
