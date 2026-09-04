import { cookies } from "next/headers";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

export const ADMIN_SESSION_COOKIE = "admin_session";
export const ADMIN_SESSION_MAX_AGE = 8 * 60 * 60; // 8시간

// 세션 서명은 ADMIN_PASSWORD가 아니라 별도의 SESSION_SECRET을 써야 한다 —
// 같은 값을 쓰면 쿠키 한 번 유출로 오프라인 사전공격에 관리자 비밀번호 자체가 뚫린다.
// SESSION_SECRET이 아직 .env에 없으면 당장 로그인이 깨지지 않도록 ADMIN_PASSWORD로 폴백하되,
// 반드시 `openssl rand -hex 32`로 만든 무작위 값을 SESSION_SECRET에 등록해야 한다.
function sign(payload: string): string {
  const secret = process.env.SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? "";
  return createHmac("sha256", secret).update(payload).digest("hex");
}

// 토큰·만료시각·서명을 함께 묶어 서명한다 — 만료시각도 서명 대상에 포함해야
// 쿠키를 조작해 만료시각만 늘리는 걸 막을 수 있다.
export function createSessionCookieValue(): string {
  const token = randomBytes(16).toString("hex");
  const expiresAt = Date.now() + ADMIN_SESSION_MAX_AGE * 1000;
  return `${token}.${expiresAt}.${sign(`${token}.${expiresAt}`)}`;
}

// 쿠키 값이 "있는지"가 아니라 서명이 올바른지, 그리고 만료되지 않았는지까지 검사한다.
// 서명 대상에 만료시각이 포함돼 있어 쿠키를 조작해 만료시각만 늘릴 수는 없다 —
// 그래서 로그아웃 이후나 8시간이 지난 뒤에도 예전 쿠키 값이 영구히 살아있던 문제가 해결된다.
export function isValidSessionCookieValue(value: string | undefined | null): boolean {
  if (!value) return false;
  const [token, expiresAtRaw, signature] = value.split(".");
  if (!token || !expiresAtRaw || !signature) return false;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || Date.now() >= expiresAt) return false;

  const expected = Buffer.from(sign(`${token}.${expiresAtRaw}`), "hex");
  const actual = Buffer.from(signature, "hex");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

// 두 값을 먼저 고정 길이(SHA-256, 32바이트)로 해시한 뒤 비교한다 — 길이가 다르다고
// 비교 전에 바로 반환하면, 그 응답 시간 차이로 실제 비밀번호 자릿수가 새어나갈 수 있다.
export function isCorrectPassword(password: string): boolean {
  const configured = process.env.ADMIN_PASSWORD ?? "";
  if (!configured) return false;
  const expected = createHash("sha256").update(configured).digest();
  const actual = createHash("sha256").update(password).digest();
  return timingSafeEqual(expected, actual);
}

// proxy 통과 여부와 별개로 각 관리자 API 안에서도 한 번 더 세션을 확인한다(이중 방어).
export async function requireAdminSession(): Promise<boolean> {
  const store = await cookies();
  return isValidSessionCookieValue(store.get(ADMIN_SESSION_COOKIE)?.value);
}
