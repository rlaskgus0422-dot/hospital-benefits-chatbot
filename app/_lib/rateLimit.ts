import { ipAddress } from "@vercel/functions";

type Bucket = { count: number; resetAt: number };

// 메모리 기반 카운터라 서버리스 인스턴스마다 따로 세어진다는 한계가 있다(완벽한 방어는 아니다).
// 다만 Upstash/Vercel KV 같은 외부 저장소 없이 지금 당장 적용할 수 있는 최소한의 방어선으로 둔다.
// 나중에 Supabase 연동 시 테이블 기반으로 옮기는 게 정석이다.
const buckets = new Map<string, Bucket>();

function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > limit;
}

// 요청 IP를 알 수 없는 환경(로컬 개발 등)에서는 "unknown" 하나로 묶어서 세되,
// 개발 중에는 어차피 제한이 걸려도 문제없도록 호출부에서 넉넉한 limit을 쓴다.
export function isRequestRateLimited(request: Request, scope: string, limit: number, windowMs: number): boolean {
  const ip = ipAddress(request) ?? "unknown";
  return isRateLimited(`${scope}:${ip}`, limit, windowMs);
}
