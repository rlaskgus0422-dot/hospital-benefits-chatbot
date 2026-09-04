import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE, createSessionCookieValue, isCorrectPassword } from "@/app/_lib/adminSession";
import { isRequestRateLimited } from "@/app/_lib/rateLimit";

export async function POST(request: Request) {
  // 단일 공유 비밀번호라 시도 횟수 제한이 없으면 전수 대입이 가능하다.
  if (isRequestRateLimited(request, "admin-login", 5, 10 * 60_000)) {
    return NextResponse.json({ error: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!password || !isCorrectPassword(password)) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, createSessionCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  });
  return response;
}
