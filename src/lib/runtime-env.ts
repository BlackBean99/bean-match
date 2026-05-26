import { getCloudflareContext } from "@opennextjs/cloudflare";

type RuntimeEnv = NodeJS.ProcessEnv & Partial<CloudflareEnv> & Record<string, string | undefined>;

export function getRuntimeEnv(): RuntimeEnv {
  const cloudflareEnv = getCloudflareEnv();
  return cloudflareEnv ? { ...process.env, ...cloudflareEnv } : process.env;
}

export function isCloudflareRuntime() {
  return Boolean(getCloudflareEnv());
}

export function getAppBaseUrl() {
  const env = getRuntimeEnv();
  return env.AUTH_URL || env.NEXT_PUBLIC_SITE_URL || env.CF_PAGES_URL || "http://localhost:3000";
}

export function getSupabaseUrl() {
  const env = getRuntimeEnv();
  return env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "";
}

export function getSupabaseServerKey() {
  const env = getRuntimeEnv();
  return env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
}

export function hasDatabaseUrl() {
  return Boolean(getRuntimeEnv().DATABASE_URL);
}

export function getPhotoBucketName() {
  return getRuntimeEnv().SUPABASE_PHOTO_BUCKET || "user-photos";
}

export function getCloudflareImagesToken() {
  const env = getRuntimeEnv();
  return env.CLOUDFLARE_API_TOKEN || env.CloudFlare_Token || "";
}

export function getCloudflareImagesVariant() {
  return getRuntimeEnv().CLOUDFLARE_IMAGES_VARIANT || "public";
}

export function getCloudflareImagesAccountId() {
  const env = getRuntimeEnv();
  return env.CLOUDFLARE_IMAGES_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID || "";
}

function getCloudflareEnv(): Partial<CloudflareEnv> | null {
  try {
    return getCloudflareContext().env;
  } catch {
    return null;
  }
}
