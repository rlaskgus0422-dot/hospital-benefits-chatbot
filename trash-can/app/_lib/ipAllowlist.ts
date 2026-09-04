import type { NextRequest } from "next/server";
import { ipAddress } from "@vercel/functions";

function ipToInt(ip: string): number | null {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isIpInCidr(ip: string, cidr: string): boolean {
  const [rangeIp, prefixLengthRaw] = cidr.trim().split("/");
  const prefixLength = prefixLengthRaw ? Number(prefixLengthRaw) : 32;
  const ipInt = ipToInt(ip);
  const rangeInt = ipToInt(rangeIp);
  if (ipInt === null || rangeInt === null) return false;
  if (!Number.isInteger(prefixLength) || prefixLength < 0 || prefixLength > 32) return false;

  const mask = prefixLength === 0 ? 0 : (~0 << (32 - prefixLength)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

// 병원 공인 IP 대역(ALLOWED_IP_RANGES, 콤마 구분 CIDR)만 허용한다.
// 개발 중(NODE_ENV !== "production")에는 검사를 건너뛰지만, 프로덕션에서는 대역이
// 설정되지 않았다는 이유로 통과시키면 안 되므로 fail-closed(거부)로 처리한다 —
// 환경변수 등록 누락·오타 하나로 접근 제한이 통째로 무력화되는 걸 막기 위함.
export function isIpAllowed(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return true;

  const allowedRanges = process.env.ALLOWED_IP_RANGES;
  if (!allowedRanges) return false;

  // 헤더를 직접 파싱하면 클라이언트가 x-forwarded-for를 조작해 우회할 수 있어,
  // Vercel 엣지가 검증한 실제 접속 IP를 반환하는 공식 헬퍼를 사용한다.
  // (다만 이 검증은 Vercel 인프라가 x-real-ip를 덮어써준다는 전제에 의존한다 —
  // Vercel 외 환경에서 직접 실행하거나 다른 프록시/CDN을 앞에 두면 신뢰할 수 없다.)
  const clientIp = ipAddress(request);
  if (!clientIp) return false;

  return allowedRanges
    .split(",")
    .some((range) => isIpInCidr(clientIp, range));
}
