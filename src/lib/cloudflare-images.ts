import {
  getCloudflareImagesAccountId,
  getCloudflareImagesToken,
  getCloudflareImagesVariant,
} from "@/lib/runtime-env";

type CloudflareImageResult = {
  id: string;
  variants?: string[];
  draft?: boolean;
};

type CloudflareEnvelope<T> = {
  success: boolean;
  errors?: Array<{ message?: string; code?: number }>;
  result?: T;
};

type CloudflareBatchTokenEnvelope = {
  success: boolean;
  result?: {
    token?: string;
    expiresAt?: string;
  };
  errors?: Array<{ message?: string; code?: number }>;
};

type CloudflareUploadInput = {
  customId: string;
  file: File | Blob | ArrayBuffer | Uint8Array;
  fileName: string;
  metadata?: Record<string, string>;
};

const cloudflareApiBaseUrl = "https://api.cloudflare.com/client/v4";
const cloudflareBatchBaseUrl = "https://batch.imagedelivery.net";
const cloudflareImagesAvailability = { disabled: false };
const batchTokenState = {
  token: null as string | null,
  expiresAt: 0,
  pending: null as Promise<string | null> | null,
};
const batchTokenRefreshBufferMs = 60 * 1000;

export async function ensureCloudflareCachedImage(input: {
  customId: string;
  sourceUrl: string;
  fileName?: string;
  metadata?: Record<string, string>;
}) {
  if (!isCloudflareImagesConfigured()) return null;

  const existing = await getCloudflareImage(input.customId);
  if (existing) return toDeliveryUrl(existing);

  const sourceResponse = await fetch(input.sourceUrl, { cache: "no-store" });
  if (!sourceResponse.ok) return null;

  const contentType = sourceResponse.headers.get("content-type") || "application/octet-stream";
  const bytes = await sourceResponse.arrayBuffer();
  const fileName = input.fileName || fileNameFromUrl(input.sourceUrl) || input.customId || "image";

  return uploadCloudflareImage({
    customId: input.customId,
    file: new File([bytes], fileName, { type: contentType }),
    fileName,
    metadata: input.metadata,
  });
}

export async function uploadCloudflareImageFile(input: CloudflareUploadInput) {
  if (!isCloudflareImagesConfigured()) return null;

  const file = normalizeUploadFile(input.file, input.fileName);
  return uploadCloudflareImage({
    customId: input.customId,
    file,
    fileName: input.fileName,
    metadata: input.metadata,
  });
}

export async function deleteCloudflareImage(imageId: string) {
  if (!isCloudflareImagesConfigured()) return false;

  const response = await requestCloudflareImages(`/images/v1/${encodeURIComponent(imageId)}`, {
    method: "DELETE",
  });

  if (response.status === 404) return false;
  if (response.status === 401 || response.status === 403) {
    cloudflareImagesAvailability.disabled = true;
    return false;
  }

  return response.ok;
}

export function isCloudflareDeliveryUrl(url: string | null | undefined) {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return parsed.hostname === "imagedelivery.net" || parsed.pathname.includes("/cdn-cgi/imagedelivery/");
  } catch {
    return false;
  }
}

async function uploadCloudflareImage(input: CloudflareUploadInput) {
  const formData = new FormData();
  formData.set("file", normalizeUploadFile(input.file, input.fileName));
  formData.set("id", input.customId);
  formData.set("requireSignedURLs", "false");
  formData.set("metadata", JSON.stringify(input.metadata ?? {}));

  const response = await requestCloudflareImages("/images/v1", {
    method: "POST",
    body: formData,
  });

  if (response.ok) {
    const envelope = (await response.json()) as CloudflareEnvelope<CloudflareImageResult>;
    if (!envelope.success || !envelope.result) return null;
    return toDeliveryUrl(envelope.result);
  }

  if (response.status === 409) {
    const conflicted = await getCloudflareImage(input.customId);
    return conflicted ? toDeliveryUrl(conflicted) : null;
  }

  if (response.status === 401 || response.status === 403) {
    cloudflareImagesAvailability.disabled = true;
  }

  return null;
}

async function getCloudflareImage(imageId: string) {
  const response = await requestCloudflareImages(`/images/v1/${encodeURIComponent(imageId)}`, {
    method: "GET",
  });

  if (response.status === 404) return null;
  if (response.status === 401 || response.status === 403) {
    cloudflareImagesAvailability.disabled = true;
    return null;
  }
  if (!response.ok) return null;

  const envelope = (await response.json()) as CloudflareEnvelope<CloudflareImageResult>;
  if (!envelope.success || !envelope.result) return null;
  return envelope.result;
}

async function requestCloudflareImages(path: string, init: RequestInit = {}) {
  const accountId = getCloudflareImagesAccountId();
  const batchToken = await getCloudflareBatchToken();
  const endpoints: Array<{ baseUrl: string; path: string; token: string; isBatch: boolean }> = [];

  if (batchToken) {
    endpoints.push({
      baseUrl: cloudflareBatchBaseUrl,
      path,
      token: batchToken,
      isBatch: true,
    });
  }

  if (accountId) {
    const apiToken = getCloudflareImagesToken();
    if (apiToken) {
      endpoints.push({
        baseUrl: cloudflareApiBaseUrl,
        path: `/accounts/${accountId}${path}`,
        token: apiToken,
        isBatch: false,
      });
    }
  }

  let lastResponse: Response | null = null;
  for (const endpoint of endpoints) {
    const response = await fetch(`${endpoint.baseUrl}${endpoint.path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${endpoint.token}`,
        ...init.headers,
      },
      cache: "no-store",
    });

    lastResponse = response;
    if (response.ok) return response;

    if (endpoint.isBatch && (response.status === 401 || response.status === 403)) {
      invalidateBatchToken();
      continue;
    }

    if (response.status === 401 || response.status === 403) {
      cloudflareImagesAvailability.disabled = true;
    }

    if (response.status !== 404) return response;
  }

  return lastResponse ?? new Response(null, { status: 500 });
}

async function getCloudflareBatchToken() {
  if (!isCloudflareImagesConfigured()) return null;

  const accountId = getCloudflareImagesAccountId();
  if (!accountId) return null;

  if (batchTokenState.token && batchTokenState.expiresAt - batchTokenRefreshBufferMs > Date.now()) {
    return batchTokenState.token;
  }

  if (batchTokenState.pending) return batchTokenState.pending;

  batchTokenState.pending = (async () => {
    const response = await fetch(`${cloudflareApiBaseUrl}/accounts/${accountId}/images/v1/batch_token`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getCloudflareImagesToken()}`,
      },
      cache: "no-store",
    });

    if (!response.ok) return null;

    const envelope = (await response.json()) as CloudflareBatchTokenEnvelope;
    const token = envelope.result?.token ?? null;
    if (!token) return null;

    batchTokenState.token = token;
    batchTokenState.expiresAt = envelope.result?.expiresAt ? Date.parse(envelope.result.expiresAt) : 0;
    return token;
  })();

  try {
    return await batchTokenState.pending;
  } finally {
    batchTokenState.pending = null;
  }
}

function invalidateBatchToken() {
  batchTokenState.token = null;
  batchTokenState.expiresAt = 0;
}

function normalizeUploadFile(file: File | Blob | ArrayBuffer | Uint8Array, fileName: string) {
  if (file instanceof File) return file;
  if (file instanceof Blob) return new File([file], fileName);
  if (file instanceof Uint8Array) {
    const bytes = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
    return new File([bytes], fileName);
  }
  return new File([file], fileName);
}

function isCloudflareImagesConfigured() {
  return Boolean(getCloudflareImagesToken() && getCloudflareImagesAccountId()) && !cloudflareImagesAvailability.disabled;
}

function toDeliveryUrl(result: CloudflareImageResult) {
  const preferredVariant = getCloudflareImagesVariant();
  return (
    result.variants?.find((variant) => variant.endsWith(`/${preferredVariant}`)) ??
    result.variants?.[0] ??
    null
  );
}

function fileNameFromUrl(url: string) {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).at(-1) || "image").slice(0, 255);
  } catch {
    return "image";
  }
}
