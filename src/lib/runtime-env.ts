import { getCloudflareContext } from "@opennextjs/cloudflare";

type RuntimeEnv = NodeJS.ProcessEnv & Partial<CloudflareEnv> & Record<string, string | undefined>;

export function getRuntimeEnv(): RuntimeEnv {
  const cloudflareEnv = getCloudflareEnv();
  return cloudflareEnv ? { ...process.env, ...cloudflareEnv } : process.env;
}

export async function getRuntimeEnvAsync(): Promise<RuntimeEnv> {
  const cloudflareEnv = await getCloudflareEnvAsync();
  return cloudflareEnv ? { ...process.env, ...cloudflareEnv } : process.env;
}

export function isCloudflareRuntime() {
  const env = process.env;
  return Boolean(
    getCloudflareEnv() ||
      env.CF_PAGES ||
      env.CF_PAGES_URL ||
      env.CF_PAGES_BRANCH,
  );
}

export function getAppBaseUrl() {
  const env = getRuntimeEnv();
  return env.AUTH_URL || env.NEXT_PUBLIC_SITE_URL || env.CF_PAGES_URL || "http://localhost:3000";
}

export async function getAppBaseUrlAsync() {
  const env = await getRuntimeEnvAsync();
  return env.AUTH_URL || env.NEXT_PUBLIC_SITE_URL || env.CF_PAGES_URL || "http://localhost:3000";
}

export function getSupabaseUrl() {
  const env = getRuntimeEnv();
  return normalizeSupabaseProjectUrl(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "");
}

export function getSupabaseServerKey() {
  const env = getRuntimeEnv();
  return env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
}

export function hasDatabaseUrl() {
  return canUsePrismaRuntime();
}

export function canUsePrismaRuntime() {
  const env = getRuntimeEnv();
  return Boolean(env.DATABASE_URL) && !isCloudflareRuntime();
}

function getCloudflareEnv(): Partial<CloudflareEnv> | null {
  try {
    return getCloudflareContext().env;
  } catch {
    return null;
  }
}

async function getCloudflareEnvAsync(): Promise<Partial<CloudflareEnv> | null> {
  try {
    return (await getCloudflareContext({ async: true })).env;
  } catch {
    return getCloudflareEnv();
  }
}

function normalizeSupabaseProjectUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.endsWith(".storage.supabase.co")) {
      const projectRef = parsed.hostname.replace(/\.storage\.supabase\.co$/i, "");
      return `${parsed.protocol}//${projectRef}.supabase.co`;
    }
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}
