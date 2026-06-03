import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  getAdminAccessCookieName,
  hasValidAdminAccessCookie,
  isAdminAccessConfigured,
  isPublicAppPath,
} from "./src/lib/admin-access";

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicAppPath(pathname)) {
    return NextResponse.next();
  }

  if (!isAdminAccessConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.next();
    }

    const lockedUrl = new URL("/admin-access", request.url);
    lockedUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(lockedUrl);
  }

  const cookieValue = request.cookies.get(getAdminAccessCookieName())?.value;
  if (await hasValidAdminAccessCookie(cookieValue)) {
    return NextResponse.next();
  }

  const lockedUrl = new URL("/admin-access", request.url);
  lockedUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(lockedUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
