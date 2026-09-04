import type { MetadataRoute } from "next";

// 병원 내부 전용 서비스라 검색엔진에 노출될 필요가 없다 — 전체 색인을 막아둔다.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
