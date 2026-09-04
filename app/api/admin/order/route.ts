import { NextResponse } from "next/server";
import { requireAdminSession } from "@/app/_lib/adminSession";
import type { Category } from "@/app/_lib/categories";
import { getCategoryOrder, isCategory, setCategoryOrder } from "@/app/_lib/store";

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  return NextResponse.json({ categoryOrder: getCategoryOrder() });
}

export async function POST(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  if (!isStringArray(body?.categoryOrder) || !body.categoryOrder.every(isCategory)) {
    return NextResponse.json({ error: "잘못된 카테고리 순서입니다." }, { status: 400 });
  }
  setCategoryOrder(body.categoryOrder as Category[]);

  return NextResponse.json({ ok: true });
}
