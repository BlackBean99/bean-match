import { existsSync, readFileSync } from "node:fs";

loadEnvFile(".env");
loadEnvFile(".env.local");

const args = process.argv.slice(2);
const write = args.includes("--write");
const limit = parseIntegerArg(args, "--limit");
const pageSize = parseIntegerArg(args, "--page-size") ?? 100;

const SUPABASE_URL = requiredEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
const CLOUDFLARE_API_TOKEN = requiredEnv("CLOUDFLARE_API_TOKEN");
const CLOUDFLARE_IMAGES_ACCOUNT_ID = requiredEnv("CLOUDFLARE_IMAGES_ACCOUNT_ID");
const CLOUDFLARE_IMAGES_VARIANT = process.env.CLOUDFLARE_IMAGES_VARIANT || "public";
const NOTION_TOKEN = process.env.NOTION_TOKEN || "";
const NOTION_VERSION = process.env.NOTION_API_VERSION || "2025-09-03";

const summary = {
  scanned: 0,
  candidates: 0,
  backfilled: 0,
  skipped: 0,
  failed: 0,
  fallbackSourceLookups: 0,
};

await main();

async function main() {
  const rows = await loadPhotoRows();
  console.log(`[backfill-cloudflare-images] loaded ${rows.length} photo rows${write ? " (write)" : " (dry-run)"}`);

  for (const row of rows) {
    summary.scanned += 1;

    if (isCloudflareDeliveryUrl(row.file_url)) {
      summary.skipped += 1;
      continue;
    }

    summary.candidates += 1;
    const sourceUrl = await resolveSourceUrl(row);
    if (!sourceUrl) {
      summary.failed += 1;
      console.warn(
        `[backfill-cloudflare-images] skip photo ${row.id}: source url missing (${row.stored_file_name})`,
      );
      continue;
    }

    const deliveryUrl = await ensureCloudflareCachedImage({
      customId: row.stored_file_name,
      sourceUrl,
      fileName: row.original_file_name || fileNameFromUrl(sourceUrl),
      metadata: {
        photoId: String(row.id),
        userId: String(row.user_id),
        storedFileName: row.stored_file_name,
      },
    });

    if (!deliveryUrl) {
      summary.failed += 1;
      console.warn(`[backfill-cloudflare-images] failed photo ${row.id}: ${sourceUrl}`);
      continue;
    }

    if (write) {
      await updatePhotoUrl(row.id, deliveryUrl);
    }

    summary.backfilled += 1;
    console.log(
      `[backfill-cloudflare-images] ${write ? "updated" : "dry-run"} photo ${row.id} -> ${deliveryUrl}`,
    );

    if (limit && summary.backfilled >= limit) break;
  }

  console.log(
    JSON.stringify(
      {
        scope: "backfill-cloudflare-images",
        write,
        scanned: summary.scanned,
        candidates: summary.candidates,
        backfilled: summary.backfilled,
        skipped: summary.skipped,
        failed: summary.failed,
        fallbackSourceLookups: summary.fallbackSourceLookups,
      },
      null,
      2,
    ),
  );
}

async function loadPhotoRows() {
  const rows = [];
  let offset = 0;

  while (true) {
    const batch = await supabaseRest(
      `/user_photos?select=id,user_id,stored_file_name,original_file_name,file_path,file_url,uploaded_at&deleted_at=is.null&order=id.asc&limit=${pageSize}&offset=${offset}`,
    );
    rows.push(...(batch || []));
    if (!batch || batch.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}

async function resolveSourceUrl(row) {
  if (isUsableSourceUrl(row.file_path)) return row.file_path;
  if (isUsableSourceUrl(row.file_url)) return row.file_url;

  const notionFallback = await resolveNotionSourceUrl(row.stored_file_name);
  if (notionFallback) {
    summary.fallbackSourceLookups += 1;
    return notionFallback;
  }

  return null;
}

function isUsableSourceUrl(url) {
  if (!url) return false;
  if (!/^https?:\/\//i.test(url)) return false;
  if (isCloudflareDeliveryUrl(url)) return false;
  return true;
}

function isCloudflareDeliveryUrl(url) {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return parsed.hostname === "imagedelivery.net" || parsed.pathname.includes("/cdn-cgi/imagedelivery/");
  } catch {
    return false;
  }
}

async function resolveNotionSourceUrl(storedFileName) {
  if (!NOTION_TOKEN) return null;

  const parsed = parseNotionStoredFileName(storedFileName);
  if (!parsed) return null;

  const page = await notionFetch(`/pages/${parsed.pageId}`);
  const props = page.properties || {};
  const photos = filesProp(findProperty(props, ["Photos", "photos", "Picture", "picture", "사진"]));
  return photos[parsed.index]?.url || null;
}

function parseNotionStoredFileName(storedFileName) {
  const match = /^notion:([^:]+):(\d+)$/.exec(storedFileName || "");
  if (!match) return null;

  return {
    pageId: match[1],
    index: Number(match[2]),
  };
}

async function ensureCloudflareCachedImage(input) {
  const sourceResponse = await fetch(input.sourceUrl, { cache: "no-store" });
  if (!sourceResponse.ok) return null;

  const contentType = sourceResponse.headers.get("content-type") || "application/octet-stream";
  const bytes = await sourceResponse.arrayBuffer();
  const fileName = input.fileName || input.customId || "image";

  const formData = new FormData();
  formData.set("file", new File([bytes], fileName, { type: contentType }));
  formData.set("id", input.customId);
  formData.set("requireSignedURLs", "false");
  formData.set("metadata", JSON.stringify(input.metadata ?? {}));

  const response = await fetch(`${cloudflareApiBaseUrl}/accounts/${CLOUDFLARE_IMAGES_ACCOUNT_ID}/images/v1`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
    },
    body: formData,
    cache: "no-store",
  });

  if (response.ok) {
    const envelope = await response.json();
    return toDeliveryUrl(envelope?.result);
  }

  if (response.status === 409) {
    const existing = await getCloudflareImage(input.customId);
    return existing ? toDeliveryUrl(existing) : null;
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error(`Cloudflare Images authentication failed (${response.status})`);
  }

  return null;
}

async function updatePhotoUrl(photoId, fileUrl) {
  await supabaseRest(`/user_photos?id=eq.${photoId}`, {
    method: "PATCH",
    body: JSON.stringify({ file_url: fileUrl }),
  });
}

async function getCloudflareImage(imageId) {
  const response = await fetch(
    `${cloudflareApiBaseUrl}/accounts/${CLOUDFLARE_IMAGES_ACCOUNT_ID}/images/v1/${encodeURIComponent(imageId)}`,
    {
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
      cache: "no-store",
    },
  );

  if (response.status === 404) return null;
  if (!response.ok) return null;

  const envelope = await response.json();
  return envelope?.result || null;
}

function toDeliveryUrl(result) {
  if (!result) return null;
  const variants = Array.isArray(result.variants) ? result.variants : [];
  return variants.find((variant) => variant.endsWith(`/${CLOUDFLARE_IMAGES_VARIANT}`)) ?? variants[0] ?? null;
}

async function supabaseRest(path, init = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase REST ${response.status}: ${text}`);
  }

  if (response.status === 204) return undefined;
  const text = await response.text();
  return text ? JSON.parse(text) : undefined;
}

async function notionFetch(path, init = {}) {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
      ...init.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Notion API ${response.status} ${response.statusText}: ${text}`);
  }

  return response.json();
}

function findProperty(props, names) {
  for (const name of names) {
    if (props[name]) return props[name];
  }
  return null;
}

function filesProp(prop) {
  if (!prop || prop.type !== "files") return [];

  return prop.files
    .map((file) => ({
      name: file.name || "notion-file",
      url: file.file?.url || file.external?.url || null,
    }))
    .filter((file) => file.url);
}

function fileNameFromUrl(url) {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).at(-1) || "image").slice(0, 255);
  } catch {
    return "image";
  }
}

function parseIntegerArg(argv, flag) {
  const index = argv.findIndex((item) => item === flag || item.startsWith(`${flag}=`));
  if (index === -1) return null;

  const value = argv[index].includes("=") ? argv[index].split("=", 2)[1] : argv[index + 1];
  if (!value) return null;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
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

const cloudflareApiBaseUrl = "https://api.cloudflare.com/client/v4";
