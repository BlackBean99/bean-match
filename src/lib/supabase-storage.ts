import { getSupabaseServerKey, getSupabaseUrl, getRuntimeEnv } from "@/lib/runtime-env";

const defaultSupabaseStorageBucket = "beanmatch-image-storage";
const storageReferencePrefix = "supabase-storage:";

type SupabaseStorageObjectInput = {
  bucket?: string;
  path: string;
  body: BodyInit;
  contentType?: string;
  upsert?: boolean;
};

export type SupabaseStorageReference = {
  bucket: string;
  path: string;
};

export function getSupabaseStorageBucket() {
  const env = getRuntimeEnv();
  return env.SUPABASE_STORAGE_BUCKET || defaultSupabaseStorageBucket;
}

export function buildSupabaseStorageReference(path: string, bucket = getSupabaseStorageBucket()) {
  return `${storageReferencePrefix}${bucket}/${path}`;
}

export function isSupabaseStorageReference(value: string | null | undefined): value is string {
  return Boolean(value?.startsWith(storageReferencePrefix));
}

export function parseSupabaseStorageReference(value: string | null | undefined): SupabaseStorageReference | null {
  if (!isSupabaseStorageReference(value)) return null;

  const rawPath = value.slice(storageReferencePrefix.length);
  const slashIndex = rawPath.indexOf("/");
  if (slashIndex <= 0 || slashIndex >= rawPath.length - 1) return null;

  return {
    bucket: rawPath.slice(0, slashIndex),
    path: rawPath.slice(slashIndex + 1),
  };
}

export async function uploadSupabaseStorageObject({
  bucket = getSupabaseStorageBucket(),
  path,
  body,
  contentType = "application/octet-stream",
  upsert = true,
}: SupabaseStorageObjectInput) {
  const response = await fetch(storageObjectUrl(bucket, path), {
    method: "POST",
    headers: {
      apikey: getSupabaseServerKey(),
      Authorization: `Bearer ${getSupabaseServerKey()}`,
      "Content-Type": contentType,
      "x-upsert": upsert ? "true" : "false",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Supabase Storage upload failed (${response.status})`);
  }

  return buildSupabaseStorageReference(path, bucket);
}

export async function deleteSupabaseStorageObject(reference: string | SupabaseStorageReference | null | undefined) {
  const parsedReference =
    typeof reference === "string" ? parseSupabaseStorageReference(reference) : (reference ?? null);
  if (!parsedReference) return false;

  const response = await fetch(storageObjectUrl(parsedReference.bucket, parsedReference.path), {
    method: "DELETE",
    headers: {
      apikey: getSupabaseServerKey(),
      Authorization: `Bearer ${getSupabaseServerKey()}`,
    },
  });

  return response.ok || response.status === 404;
}

export async function fetchSupabaseStorageObject(
  reference: string | SupabaseStorageReference,
  method: "GET" | "HEAD" = "GET",
) {
  const parsedReference =
    typeof reference === "string" ? parseSupabaseStorageReference(reference) : reference;
  if (!parsedReference) {
    throw new Error("Supabase Storage reference is invalid.");
  }

  const response = await fetch(storageAuthenticatedUrl(parsedReference.bucket, parsedReference.path), {
    method,
    headers: {
      apikey: getSupabaseServerKey(),
      Authorization: `Bearer ${getSupabaseServerKey()}`,
    },
    cache: "no-store",
  });

  return response;
}

function storageObjectUrl(bucket: string, path: string) {
  return `${getSupabaseUrl()}/storage/v1/object/${encodeURIComponent(bucket)}/${encodePath(path)}`;
}

function storageAuthenticatedUrl(bucket: string, path: string) {
  return `${getSupabaseUrl()}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${encodePath(path)}`;
}

function encodePath(path: string) {
  return path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}
