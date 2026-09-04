import { NextResponse } from "next/server";
import { requireAdminSession } from "@/app/_lib/adminSession";
import { addCategory, getAllCategories } from "@/app/_lib/store";

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  return NextResponse.json({ categories: getAllCategories() });
}

export async function POST(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "카테고리 이름을 입력해주세요." }, { status: 400 });
  }
  if (getAllCategories().includes(name)) {
    return NextResponse.json({ error: "이미 있는 카테고리입니다." }, { status: 409 });
  }

  const categories = addCategory(name);
  return NextResponse.json({ categories });
}
