import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse(pdfjs-dist)는 내부적으로 워커 스크립트를 상대 경로로 불러오는데,
  // 서버 번들에 포함되면 그 경로가 깨져서 번들링 대상에서 제외한다.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],

  // 병원 내부 전용 서비스라 클릭재킹(관리자 페이지를 iframe에 숨겨 넣는 공격)과
  // MIME 스니핑을 막아둔다. 로그인 없이 IP 대역만으로 접근을 제한하는 구조라 더 중요하다.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
