import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, isValidSessionCookieValue } from "@/app/_lib/adminSession";

const ADMIN_PATH_PREFIXES = ["/admin", "/api/admin"];
const PUBLIC_ADMIN_PATHS = ["/admin/login", "/api/admin/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 관리자 세션 검사 — 로그인 경로 자체는 제외한다.
  const isAdminPath = ADMIN_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isPublicAdminPath = PUBLIC_ADMIN_PATHS.includes(pathname);

  if (isAdminPath && !isPublicAdminPath) {
    const sessionCookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    if (!isValidSessionCookieValue(sessionCookie)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  return NextResponse.next();
}
