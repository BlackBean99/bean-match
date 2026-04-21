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
const MATCHING_HISTORY_DATA_SOURCE_ID = process.env.NOTION_MATCHING_HISTORY_DATA_SOURCE_ID;
const write = process.argv.includes("--write");
let notionSources;

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
const openLevelValues = new Set(["PRIVATE", "SEMI_OPEN", "FULL_OPEN"]);
const openLevelMap = new Map([
  ["private", "PRIVATE"],
  ["semi_open", "SEMI_OPEN"],
  ["full_open", "FULL_OPEN"],
  ["operator", "PRIVATE"],
  ["operator only", "PRIVATE"],
  ["operator matching", "PRIVATE"],
  ["운영자", "PRIVATE"],
  ["운영자만", "PRIVATE"],
  ["제한", "SEMI_OPEN"],
  ["제한 노출", "SEMI_OPEN"],
  ["전체", "FULL_OPEN"],
  ["전체 노출", "FULL_OPEN"],
  ["풀", "FULL_OPEN"],
  ["풀 오픈", "FULL_OPEN"],
]);

const userStatusMap = new Map([
  ["정보 미완성", "INCOMPLETE"],
  ["소개 가능", "READY"],
  ["소개 진행 중", "PROGRESSING"],
  ["잠시 보류", "HOLD"],
  ["탈퇴 요청", "STOP_REQUESTED"],
  ["보관 완료", "ARCHIVED"],
  ["운영 제한", "BLOCKED"],
]);

const introStatusValues = new Set([
  "OFFERED",
  "A_INTERESTED",
  "B_OFFERED",
  "WAITING_RESPONSE",
  "MATCHED",
  "CONNECTED",
  "MEETING_DONE",
  "RESULT_PENDING",
  "SUCCESS",
  "FAILED",
  "DECLINED",
  "EXPIRED",
  "CANCELLED",
]);

const introStatusMap = new Map([
  ["success", "SUCCESS"],
  ["fail", "FAILED"],
  ["failed", "FAILED"],
  ["retry", "FAILED"],
  ["제안 전달", "OFFERED"],
  ["제안", "OFFERED"],
  ["A 관심", "A_INTERESTED"],
  ["B 제안", "B_OFFERED"],
  ["응답 대기", "WAITING_RESPONSE"],
  ["양측 수락", "MATCHED"],
  ["연락 연결", "CONNECTED"],
  ["만남 완료", "MEETING_DONE"],
  ["결과 확인 대기", "RESULT_PENDING"],
  ["성사", "SUCCESS"],
  ["불발", "FAILED"],
  ["거절", "DECLINED"],
  ["만료", "EXPIRED"],
  ["취소", "CANCELLED"],
]);

const activeIntroStatusSet = new Set([
  "OFFERED",
  "A_INTERESTED",
  "B_OFFERED",
  "WAITING_RESPONSE",
  "MATCHED",
  "CONNECTED",
  "MEETING_DONE",
  "RESULT_PENDING",
]);

class NotionApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function buildNotionSources() {
  const matchingHistoryId =
    MATCHING_HISTORY_DATA_SOURCE_ID || (await discoverMatchingHistoryDataSourceId());

  return [
    MAIN_DATA_SOURCE_ID
      ? { id: MAIN_DATA_SOURCE_ID, name: "메인DB", sourceType: "main", defaultRoles: ["PARTICIPANT"] }
      : null,
    INVITOR_DATA_SOURCE_ID
      ? { id: INVITOR_DATA_SOURCE_ID, name: "소개모집인", sourceType: "invitor", defaultRoles: ["INVITOR"] }
      : null,
    matchingHistoryId
      ? { id: matchingHistoryId, name: "Matching History", sourceType: "matching_history" }
      : null,
  ].filter(Boolean);
}

async function discoverMatchingHistoryDataSourceId() {
  try {
    const response = await notionFetch(
      "/search",
      {
        method: "POST",
        body: JSON.stringify({
          query: "Matching History",
          filter: { property: "object", value: "data_source" },
          page_size: 10,
        }),
      },
      "2025-09-03",
    );
    const exact = (response.results || []).find((item) => titleForSearchResult(item) === "Matching History");
    const match = exact || (response.results || []).find((item) => titleForSearchResult(item).includes("Matching History"));
    if (match?.id) return match.id;
  } catch (error) {
    if (!(error instanceof NotionApiError)) throw error;
  }

  try {
    const response = await notionFetch("/search", {
      method: "POST",
      body: JSON.stringify({
        query: "Matching History",
        filter: { property: "object", value: "database" },
        page_size: 10,
      }),
    });
    const exact = (response.results || []).find((item) => titleForSearchResult(item) === "Matching History");
    const match = exact || (response.results || []).find((item) => titleForSearchResult(item).includes("Matching History"));
    return match?.id ?? null;
  } catch (error) {
    if (error instanceof NotionApiError) return null;
    throw error;
  }
}

function titleForSearchResult(item) {
  return richText(item?.title || []) || "";
}

function normalizePersonName(name) {
  return (name || "")
    .replace(/^내친구\s*-\s*/, "")
    .replace(/\s+/g, "")
    .trim();
}

notionSources = await buildNotionSources();

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
        input =
          source.sourceType === "matching_history"
            ? await mapMatchingHistoryPage(page)
            : mapUserPage(page, source.defaultRoles);
      } catch (error) {
        results.push({
          pageId: page.id,
          source: source.name,
          action: "skipped",
          reason: error instanceof Error ? error.message : "Invalid Notion page",
        });
        continue;
      }
      const checksum = sha256(stringifyForChecksum(stableInputForChecksum(input, source)));
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
          ...(source.sourceType === "matching_history"
            ? { introStatus: input.status, participants: input.participants.map((p) => p.name).join(" / ") }
            : { name: input.user.name, status: input.user.status, roles: input.roles }),
        });
        continue;
      }

      let result;
      try {
        result =
          source.sourceType === "matching_history"
            ? await writeIntroCaseFromNotion(existingSync, input, page, checksum, rawChecksum, source)
            : await writeUserFromNotion(existingSync, input, page, checksum, rawChecksum, source);
      } catch (error) {
        results.push({
          pageId: page.id,
          source: source.name,
          action: "skipped",
          reason: error instanceof Error ? error.message : "Write failed",
        });
        continue;
      }

      results.push({
        pageId: page.id,
        source: source.name,
        action: existingSync ? "updated" : "created",
        ...(source.sourceType === "matching_history"
          ? { introCaseId: result.id.toString(), participants: result.participants }
          : { userId: result.id.toString(), name: result.name }),
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

async function resolveUserIdForNotionPageId(notionPageId) {
  if (!notionPageId) return null;

  if (prisma) {
    const record = await prisma.notionSyncRecord.findUnique({ where: { notionPageId } });
    if (!record) return null;
    if (record.entityType !== "User") return null;
    return record.entityId;
  }

  const rows = await supabaseRest(
    `/notion_sync_records?notion_page_id=eq.${encodeURIComponent(notionPageId)}&select=entity_type,entity_id&limit=1`,
  );
  const record = rows?.[0];
  if (!record || record.entity_type !== "User") return null;
  return BigInt(record.entity_id);
}

async function resolveUserIdForName(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;

  if (prisma) {
    const user = await prisma.user.findFirst({ where: { name: trimmed }, select: { id: true } });
    if (user?.id) return user.id;
    const users = await prisma.user.findMany({ select: { id: true, name: true } });
    return users.find((candidate) => normalizePersonName(candidate.name) === normalizePersonName(trimmed))?.id ?? null;
  }

  const rows = await supabaseRest(`/users?select=id&name=eq.${encodeURIComponent(trimmed)}&limit=1`);
  if (rows?.[0]?.id) return BigInt(rows[0].id);
  const users = await supabaseRest("/users?select=id,name&limit=2000");
  const user = users.find((candidate) => normalizePersonName(candidate.name) === normalizePersonName(trimmed));
  return user?.id ? BigInt(user.id) : null;
}

async function resolveUserNameForUserId(userId) {
  if (!userId) return null;

  if (prisma) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    return user?.name ?? null;
  }

  const rows = await supabaseRest(`/users?id=eq.${encodeURIComponent(userId.toString())}&select=name&limit=1`);
  const name = rows?.[0]?.name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

function safeNumberFromBigInt(value, label) {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error(`${label} must be a safe integer.`);
    return value;
  }
  if (typeof value !== "bigint") throw new Error(`${label} must be a bigint.`);
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error(`${label} is too large to safely send to Supabase REST as a number.`);
  }
  return Number(value);
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

      await ensureEntryQueueWithPrisma(tx, user, input.roles);

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

  await ensureEntryQueueWithSupabase(user.id, user, input.roles);

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

async function writeIntroCaseFromNotion(existingSync, input, page, checksum, rawChecksum, source) {
  const participantIds = input.participants.map((p) => p.userId).filter(Boolean);
  if (participantIds.length !== 2) {
    throw new Error(`Matching History page ${page.id} must resolve exactly 2 participant user IDs`);
  }
  const [personAId, personBId] = participantIds;
  if (personAId === personBId) throw new Error("Intro case requires two different participants.");

  if (prisma) {
    return prisma.$transaction(async (tx) => {
      await upsertRawNotionRecordWithPrisma(tx, page, rawChecksum, source);

      const existingPairIntroCaseId =
        existingSync?.entityId ?? (await findIntroCaseIdForParticipantPairWithPrisma(tx, personAId, personBId));

      if (!existingPairIntroCaseId) {
        const blocked = await hasActiveIntroConflictWithPrisma(tx, [personAId, personBId]);
        if (blocked) {
          throw new Error("Active intro already exists for one of the participants; cannot create a new active intro.");
        }
      }

      const introCase = existingPairIntroCaseId
        ? await tx.introCase.update({
            where: { id: existingPairIntroCaseId },
            data: {
              status: input.status,
              memo: input.memo ?? null,
              invitorUserId: input.invitorUserId,
            },
          })
        : await tx.introCase.create({
            data: {
              status: input.status,
              memo: input.memo ?? null,
              invitorUserId: input.invitorUserId,
              participants: {
                create: [
                  { userId: personAId, participantRole: "PERSON_A", responseStatus: "PENDING" },
                  { userId: personBId, participantRole: "PERSON_B", responseStatus: "PENDING" },
                ],
              },
            },
          });

      if (existingPairIntroCaseId) {
        await tx.introCaseParticipant.deleteMany({ where: { introCaseId: introCase.id } });
        await tx.introCaseParticipant.createMany({
          data: [
            { introCaseId: introCase.id, userId: personAId, participantRole: "PERSON_A", responseStatus: "PENDING" },
            { introCaseId: introCase.id, userId: personBId, participantRole: "PERSON_B", responseStatus: "PENDING" },
          ],
        });
      }

      await tx.notionSyncRecord.upsert({
        where: { notionPageId: page.id },
        create: {
          entityType: "IntroCase",
          entityId: introCase.id,
          notionPageId: page.id,
          checksum,
          notionEditedAt: page.last_edited_time ? new Date(page.last_edited_time) : null,
        },
        update: {
          entityType: "IntroCase",
          entityId: introCase.id,
          checksum,
          lastSyncedAt: new Date(),
          notionEditedAt: page.last_edited_time ? new Date(page.last_edited_time) : null,
        },
      });

      await syncUserStatusesForIntroWithPrisma(tx, [personAId, personBId]);

      return {
        id: introCase.id,
        participants: input.participants.map((p) => p.name),
      };
    });
  }

  await upsertRawNotionRecordWithSupabase(page, rawChecksum, source);

  const existingPairIntroCaseId =
    existingSync?.entityId ?? (await findIntroCaseIdForParticipantPairWithSupabase(personAId, personBId));

  if (!existingPairIntroCaseId) {
    const blocked = await hasActiveIntroConflictWithSupabase([
      safeNumberFromBigInt(personAId, "personAId"),
      safeNumberFromBigInt(personBId, "personBId"),
    ]);
    if (blocked) {
      throw new Error("Active intro already exists for one of the participants; cannot create a new active intro.");
    }
  }

  const introRows = existingPairIntroCaseId
    ? await supabaseRest(`/intro_cases?id=eq.${existingPairIntroCaseId.toString()}&select=*`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          status: input.status,
          memo: input.memo ?? null,
          invitor_user_id: input.invitorUserId ? safeNumberFromBigInt(input.invitorUserId, "invitorUserId") : null,
        }),
      })
    : await supabaseRest("/intro_cases?select=*", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          status: input.status,
          memo: input.memo ?? null,
          invitor_user_id: input.invitorUserId ? safeNumberFromBigInt(input.invitorUserId, "invitorUserId") : null,
        }),
      });
  const introCase = introRows[0];

  await supabaseRest(`/intro_case_participants?intro_case_id=eq.${introCase.id}`, { method: "DELETE" });
  await supabaseRest("/intro_case_participants", {
    method: "POST",
    body: JSON.stringify([
      {
        intro_case_id: introCase.id,
        user_id: safeNumberFromBigInt(personAId, "personAId"),
        participant_role: "PERSON_A",
        response_status: "PENDING",
      },
      {
        intro_case_id: introCase.id,
        user_id: safeNumberFromBigInt(personBId, "personBId"),
        participant_role: "PERSON_B",
        response_status: "PENDING",
      },
    ]),
  });

  const syncPayload = {
    entity_type: "IntroCase",
    entity_id: introCase.id,
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

  await syncUserStatusesForIntroWithSupabase([
    safeNumberFromBigInt(personAId, "personAId"),
    safeNumberFromBigInt(personBId, "personBId"),
  ]);

  return {
    id: BigInt(introCase.id),
    participants: input.participants.map((p) => p.name),
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
  const photos = filesProp(findProperty(props, ["Photos", "photos", "Picture", "picture", "사진"]));
  const openLevel =
    enumValue(
      selectProp(findProperty(props, ["Open level", "OpenLevel", "open_level", "노출", "오픈레벨", "공개"])),
      openLevelValues,
      null,
      openLevelMap,
    ) || (photos.length > 0 ? "FULL_OPEN" : "PRIVATE");

  return {
    user: {
      name,
      gender,
      status,
      openLevel,
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
    photos,
    roles: roles.length > 0 ? roles : defaultRoles,
  };
}

async function mapMatchingHistoryPage(page) {
  const props = page.properties || {};

  const status = enumValue(
    selectProp(findProperty(props, ["Status", "status", "상태", "Success Signal", "success signal", "결과"])),
    introStatusValues,
    "FAILED",
    introStatusMap,
  );

  const memo =
    textProp(findProperty(props, ["Memo", "memo", "메모", "Notes", "notes"])) ||
    textProp(findProperty(props, ["Summary", "summary", "요약"])) ||
    null;

  const invitorUserId = await resolveUserIdFromProperty(
    findProperty(props, ["Invitor", "invitor", "주선자", "Operator", "operator"]),
  );

  const personA = await resolveParticipantFromProperty(
    findProperty(props, ["Person A", "A", "참여자 A", "참여자1", "대상", "남자", "user_a", "User A", "participant_a"]),
  );
  const personB = await resolveParticipantFromProperty(
    findProperty(props, ["Person B", "B", "참여자 B", "참여자2", "피소개", "피소개인", "여자", "user_b", "User B", "participant_b"]),
  );

  if (!personA?.userId || !personB?.userId) {
    throw new Error(`Matching History page ${page.id} must reference two users (A/B)`);
  }

  return {
    status,
    memo,
    invitorUserId,
    participants: [personA, personB],
  };
}

async function resolveUserIdFromProperty(prop) {
  if (!prop) return null;
  if (prop.type === "relation") {
    const ids = (prop.relation || []).map((r) => r.id).filter(Boolean);
    if (ids.length === 0) return null;
    // Only first relation is used as invitor.
    return resolveUserIdForNotionPageId(ids[0]);
  }
  const name = textProp(prop);
  if (name) return resolveUserIdForName(name);
  if (prop.type === "number" && typeof prop.number === "number") return BigInt(prop.number);
  return null;
}

async function resolveParticipantFromProperty(prop) {
  if (!prop) return null;
  if (prop.type === "relation") {
    const ids = (prop.relation || []).map((r) => r.id).filter(Boolean);
    if (ids.length === 0) return null;
    const notionPageId = ids[0];
    const userId = await resolveUserIdForNotionPageId(notionPageId);
    const resolvedName = userId ? await resolveUserNameForUserId(userId) : null;
    return { userId, name: resolvedName ?? notionPageId };
  }
  const name = textProp(prop);
  if (!name) return null;
  const userId = await resolveUserIdForName(name);
  return { userId, name };
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

async function hasActiveIntroConflictWithPrisma(tx, participantIds) {
  const active = Array.from(activeIntroStatusSet);
  for (const userId of participantIds) {
    const activeCount = await tx.introCaseParticipant.count({
      where: { userId, introCase: { status: { in: active } } },
    });
    if (activeCount > 0) return true;
  }
  return false;
}

async function findIntroCaseIdForParticipantPairWithPrisma(tx, personAId, personBId) {
  const rows = await tx.introCaseParticipant.findMany({
    where: { userId: { in: [personAId, personBId] } },
    select: { introCaseId: true, userId: true },
  });
  const byIntroCaseId = new Map();
  for (const row of rows) {
    const key = row.introCaseId.toString();
    byIntroCaseId.set(key, new Set([...(byIntroCaseId.get(key) ?? []), row.userId.toString()]));
  }
  const pair = new Set([personAId.toString(), personBId.toString()]);
  for (const [introCaseId, userIds] of byIntroCaseId) {
    if (userIds.size === 2 && [...pair].every((userId) => userIds.has(userId))) return BigInt(introCaseId);
  }
  return null;
}

async function hasActiveIntroConflictWithSupabase(participantIds) {
  for (const userId of participantIds) {
    const parts = await supabaseRest(
      `/intro_case_participants?select=intro_case_id&user_id=eq.${userId}&limit=200`,
    );
    const ids = (parts || []).map((p) => p.intro_case_id).filter(Boolean);
    if (ids.length === 0) continue;
    const active = Array.from(activeIntroStatusSet).join(",");
    const cases = await supabaseRest(`/intro_cases?select=id&id=in.(${ids.join(",")})&status=in.(${active})&limit=1`);
    if (Array.isArray(cases) && cases.length > 0) return true;
  }
  return false;
}

async function findIntroCaseIdForParticipantPairWithSupabase(personAId, personBId) {
  const a = safeNumberFromBigInt(personAId, "personAId");
  const b = safeNumberFromBigInt(personBId, "personBId");
  const parts = await supabaseRest(
    `/intro_case_participants?select=intro_case_id,user_id&user_id=in.(${a},${b})&limit=1000`,
  );
  const byIntroCaseId = new Map();
  for (const row of parts || []) {
    const key = row.intro_case_id;
    byIntroCaseId.set(key, new Set([...(byIntroCaseId.get(key) ?? []), row.user_id]));
  }
  for (const [introCaseId, userIds] of byIntroCaseId) {
    if (userIds.size === 2 && userIds.has(a) && userIds.has(b)) return BigInt(introCaseId);
  }
  return null;
}

async function syncUserStatusesForIntroWithPrisma(tx, participantIds) {
  const active = Array.from(activeIntroStatusSet);
  for (const userId of new Set(participantIds)) {
    const activeCount = await tx.introCaseParticipant.count({
      where: { userId, introCase: { status: { in: active } } },
    });
    const user = await tx.user.findUnique({ where: { id: userId }, select: { status: true } });
    if (!user) continue;
    const nextStatus = activeCount > 0 ? "PROGRESSING" : user.status === "PROGRESSING" ? "READY" : user.status;
    if (nextStatus !== user.status) {
      await tx.user.update({ where: { id: userId }, data: { status: nextStatus } });
    }
  }
}

async function syncUserStatusesForIntroWithSupabase(participantIds) {
  const active = Array.from(activeIntroStatusSet).join(",");
  for (const userId of new Set(participantIds)) {
    const parts = await supabaseRest(
      `/intro_case_participants?select=intro_case_id&user_id=eq.${userId}&limit=200`,
    );
    const ids = (parts || []).map((p) => p.intro_case_id).filter(Boolean);
    const activeCases =
      ids.length > 0
        ? await supabaseRest(`/intro_cases?select=id,status&id=in.(${ids.join(",")})&status=in.(${active})&limit=200`)
        : [];
    const userRows = await supabaseRest(`/users?id=eq.${userId}&select=status&limit=1`);
    const user = userRows?.[0];
    if (!user) continue;
    const nextStatus = activeCases.length > 0 ? "PROGRESSING" : user.status === "PROGRESSING" ? "READY" : user.status;
    if (nextStatus !== user.status) {
      await supabaseRest(`/users?id=eq.${userId}`, { method: "PATCH", body: JSON.stringify({ status: nextStatus }) });
    }
  }
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
  const trimmed = value.trim();
  const alias = aliases.get(trimmed) || aliases.get(trimmed.toLowerCase());
  if (alias) return alias;

  const normalized = trimmed.toUpperCase().replaceAll(" ", "_").replaceAll("-", "_");
  return allowed.has(normalized) ? normalized : fallback;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stringifyForChecksum(value) {
  return JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item));
}

function stableInputForChecksum(input, source) {
  if (source.sourceType !== "main" && source.sourceType !== "invitor") return input;
  return {
    ...input,
    photos: (input.photos || []).map((photo) => ({
      name: photo.name,
      sourceType: photo.sourceType,
    })),
  };
}

async function supabaseRest(path, init = {}) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("DATABASE_URL or SUPABASE_SERVICE_ROLE_KEY is required for sync state.");
  }

  let response;
  let text = "";
  for (let attempt = 0; attempt < 4; attempt += 1) {
    response = await fetch(`${url}/rest/v1${path}`, {
      ...init,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    if (response.ok || ![429, 502, 503, 504].includes(response.status)) break;
    text = await response.text();
    await sleep(400 * (attempt + 1));
  }

  if (!response?.ok) {
    text = text || (response ? await response.text() : "");
    throw new Error(`Supabase REST ${response?.status ?? "unknown"}: ${text}`);
  }

  if (response.status === 204) return null;

  text = await response.text();
  return text ? JSON.parse(text) : null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toSupabaseUserPayload(user) {
  return {
    name: user.name,
    gender: user.gender,
    status: user.status,
    open_level: user.openLevel,
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

function entryQueueStatusForUser(user) {
  return user.status === "READY" && user.openLevel === "FULL_OPEN" ? "READY" : "WAITING";
}

async function ensureEntryQueueWithPrisma(tx, user, roles) {
  if (!roles.includes("PARTICIPANT")) return;

  const existing = await tx.entryQueue.findFirst({ where: { userId: user.id }, select: { id: true } });
  if (existing) return;

  await tx.entryQueue.create({
    data: {
      userId: user.id,
      status: entryQueueStatusForUser(user),
      memo: "notion-sync",
    },
  });
}

async function ensureEntryQueueWithSupabase(userId, user, roles) {
  if (!roles.includes("PARTICIPANT")) return;

  const rows = await supabaseRest(`/entry_queue?select=id&user_id=eq.${userId}&limit=1`);
  if (Array.isArray(rows) && rows.length > 0) return;

  await supabaseRest("/entry_queue", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      status: entryQueueStatusForUser(user),
      memo: "notion-sync",
    }),
  });
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
