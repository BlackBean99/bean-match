import {
  getCloudflareImagesAccountId,
  getCloudflareImagesToken,
  getCloudflareImagesVariant,
} from "@/lib/runtime-env";

type CloudflareImageResult = {
  id: string;
  variants?: string[];
};

type CloudflareEnvelope = {
  success: boolean;
  errors?: Array<{ message?: string; code?: number }>;
  result?: CloudflareImageResult;
};

const cloudflareApiBaseUrl = "https://api.cloudflare.com/client/v4";
const cloudflareImagesAvailability = { disabled: false };

export async function ensureCloudflareCachedImage(input: {
  customId: string;
  sourceUrl: string;
  fileName?: string;
  metadata?: Record<string, string>;
}) {
  if (!isCloudflareImagesConfigured()) return null;

  const accountId = getCloudflareImagesAccountId();
  if (!accountId) return null;

  const existing = await getCloudflareImage(accountId, input.customId);
  if (existing) return toDeliveryUrl(existing);

  const sourceResponse = await fetch(input.sourceUrl, { cache: "no-store" });
  if (!sourceResponse.ok) return null;

  const contentType = sourceResponse.headers.get("content-type") || "application/octet-stream";
  const bytes = await sourceResponse.arrayBuffer();
  const fileName = input.fileName || fileNameFromUrl(input.sourceUrl) || input.customId || "image";

  const formData = new FormData();
  formData.set("file", new File([bytes], fileName, { type: contentType }));
  formData.set("id", input.customId);
  formData.set("requireSignedURLs", "false");
  formData.set("metadata", JSON.stringify(input.metadata ?? {}));

  const response = await fetch(`${cloudflareApiBaseUrl}/accounts/${accountId}/images/v1`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getCloudflareImagesToken()}`,
    },
    body: formData,
    cache: "no-store",
  });

  if (response.ok) {
    const envelope = (await response.json()) as CloudflareEnvelope;
    if (!envelope.success || !envelope.result) return null;
    return toDeliveryUrl(envelope.result);
  }

  if (response.status === 409) {
    const conflicted = await getCloudflareImage(accountId, input.customId);
    return conflicted ? toDeliveryUrl(conflicted) : null;
  }

  if (response.status === 401 || response.status === 403) {
    cloudflareImagesAvailability.disabled = true;
  }

  return null;
}

export async function deleteCloudflareImage(imageId: string) {
  if (!isCloudflareImagesConfigured()) return false;

  const accountId = getCloudflareImagesAccountId();
  if (!accountId) return false;

  const response = await fetch(
    `${cloudflareApiBaseUrl}/accounts/${accountId}/images/v1/${encodeURIComponent(imageId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${getCloudflareImagesToken()}`,
      },
      cache: "no-store",
    },
  );

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

function toDeliveryUrl(result: CloudflareImageResult) {
  const preferredVariant = getCloudflareImagesVariant();
  return (
    result.variants?.find((variant) => variant.endsWith(`/${preferredVariant}`)) ??
    result.variants?.[0] ??
    null
  );
}

async function getCloudflareImage(accountId: string, imageId: string) {
  const response = await fetch(`${cloudflareApiBaseUrl}/accounts/${accountId}/images/v1/${encodeURIComponent(imageId)}`, {
    headers: {
      Authorization: `Bearer ${getCloudflareImagesToken()}`,
    },
    cache: "no-store",
  });

  if (response.status === 404) return null;
  if (response.status === 401 || response.status === 403) {
    cloudflareImagesAvailability.disabled = true;
    return null;
  }
  if (!response.ok) return null;

  const envelope = (await response.json()) as CloudflareEnvelope;
  if (!envelope.success || !envelope.result) return null;
  return envelope.result;
}

function isCloudflareImagesConfigured() {
  return Boolean(getCloudflareImagesToken()) && !cloudflareImagesAvailability.disabled;
}

function fileNameFromUrl(url: string) {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).at(-1) || "image").slice(0, 255);
  } catch {
    return "image";
  }
}
