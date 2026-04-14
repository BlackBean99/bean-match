import { NextResponse } from "next/server";
import { getPhotoRedirectUrl } from "@/lib/member-repository";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return servePhoto(params, false);
}

export async function HEAD(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return servePhoto(params, true);
}

async function servePhoto(params: Promise<{ id: string }>, headOnly: boolean) {
  const { id } = await params;

  let photoId: bigint;
  try {
    photoId = BigInt(id);
  } catch {
    return photoFallbackResponse(headOnly);
  }

  const url = await getPhotoRedirectUrl(photoId);
  if (!url) return photoFallbackResponse(headOnly);

  try {
    const upstream = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "blackbean-match-admin/1.0",
      },
    });
    if (!upstream.ok) return photoFallbackResponse(headOnly);

    const headers = new Headers();
    headers.set("Cache-Control", "private, no-store");
    headers.set("Content-Type", upstream.headers.get("Content-Type") ?? "image/jpeg");

    return new Response(headOnly ? null : upstream.body, {
      status: 200,
      headers,
    });
  } catch {
    return photoFallbackResponse(headOnly);
  }
}

function photoFallbackResponse(headOnly: boolean) {
  const headers = new Headers();
  headers.set("Cache-Control", "private, no-store");
  headers.set("Content-Type", "image/svg+xml; charset=utf-8");

  return new NextResponse(headOnly ? null : fallbackSvg, {
    status: 200,
    headers,
  });
}

const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240" role="img" aria-label="사진을 불러오지 못했습니다"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#fff1f2"/><stop offset=".5" stop-color="#ffffff"/><stop offset="1" stop-color="#fee2e2"/></linearGradient></defs><rect width="320" height="240" fill="url(#g)"/><circle cx="160" cy="100" r="32" fill="#FF3131" opacity=".18"/><path d="M82 178l54-62 34 38 22-25 46 49H82z" fill="#E00E0E" opacity=".18"/><text x="160" y="210" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#E00E0E">사진을 다시 불러오는 중</text></svg>`;
