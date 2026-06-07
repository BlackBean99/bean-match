import { NextResponse } from "next/server";
import { getPhotoServeTarget } from "@/lib/member-repository";
import { fetchSupabaseStorageObject } from "@/lib/supabase-storage";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return servePhoto(_request, params, false);
}

export async function HEAD(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return servePhoto(_request, params, true);
}

async function servePhoto(request: Request, params: Promise<{ id: string }>, headOnly: boolean) {
  const { id } = await params;
  const url = new URL(request.url);
  const variant = url.searchParams.get("variant") === "thumb" ? "thumb" : "original";

  let photoId: bigint;
  try {
    photoId = BigInt(id);
  } catch {
    return photoFallbackResponse(headOnly);
  }

  const target = await getPhotoServeTarget(photoId, variant);
  if (!target) return photoFallbackResponse(headOnly);

  if (target.kind === "redirect") {
    const response = NextResponse.redirect(target.url, 307);
    response.headers.set("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
    return response;
  }

  if (target.kind === "storage") {
    return proxySupabaseStorageResponse(target.reference, headOnly);
  }

  return proxyPhotoResponse(target.url, headOnly);
}

async function proxyPhotoResponse(sourceUrl: string, headOnly: boolean) {
  try {
    const upstream = await fetch(sourceUrl, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
    });
    if (!upstream.ok) return photoFallbackResponse(headOnly);

    const headers = new Headers();
    headers.set(
      "Content-Type",
      upstream.headers.get("Content-Type") || upstream.headers.get("content-type") || "image/jpeg",
    );
    headers.set("Cache-Control", "public, max-age=120, s-maxage=900, stale-while-revalidate=3600");

    const contentLength = upstream.headers.get("Content-Length") || upstream.headers.get("content-length");
    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }

    return new NextResponse(headOnly ? null : upstream.body, {
      status: 200,
      headers,
    });
  } catch {
    return photoFallbackResponse(headOnly);
  }
}

async function proxySupabaseStorageResponse(reference: string, headOnly: boolean) {
  try {
    const upstream = await fetchSupabaseStorageObject(reference, headOnly ? "HEAD" : "GET");
    if (!upstream.ok) return photoFallbackResponse(headOnly);

    const headers = new Headers();
    headers.set(
      "Content-Type",
      upstream.headers.get("Content-Type") || upstream.headers.get("content-type") || "image/jpeg",
    );
    headers.set("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");

    const contentLength = upstream.headers.get("Content-Length") || upstream.headers.get("content-length");
    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }

    return new NextResponse(headOnly ? null : upstream.body, {
      status: 200,
      headers,
    });
  } catch {
    return photoFallbackResponse(headOnly);
  }
}

function photoFallbackResponse(headOnly: boolean) {
  const headers = new Headers();
  headers.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  headers.set("Content-Type", "image/svg+xml; charset=utf-8");

  return new NextResponse(headOnly ? null : fallbackSvg, {
    status: 200,
    headers,
  });
}

const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240" role="img" aria-label="사진을 불러오지 못했습니다"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#fff1f2"/><stop offset=".5" stop-color="#ffffff"/><stop offset="1" stop-color="#fee2e2"/></linearGradient></defs><rect width="320" height="240" fill="url(#g)"/><circle cx="160" cy="100" r="32" fill="#FF3131" opacity=".18"/><path d="M82 178l54-62 34 38 22-25 46 49H82z" fill="#E00E0E" opacity=".18"/><text x="160" y="210" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#E00E0E">사진을 다시 불러오는 중</text></svg>`;
