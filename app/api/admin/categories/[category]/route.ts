import { NextResponse } from "next/server";
import { requireAdminSession } from "@/app/_lib/adminSession";
import { deleteCategory, getAllCategories, renameCategory } from "@/app/_lib/store";

export async function PATCH(request: Request, { params }: { params: Promise<{ category: string }> }) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { category } = await params;
  if (!getAllCategories().includes(category)) {
    return NextResponse.json({ error: "존재하지 않는 카테고리입니다." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "새 카테고리 이름을 입력해주세요." }, { status: 400 });
  }
  if (getAllCategories().includes(name)) {
    return NextResponse.json({ error: "이미 있는 카테고리입니다." }, { status: 409 });
  }

  const categories = renameCategory(category, name);
  return NextResponse.json({ categories });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ category: string }> }) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { category } = await params;
  if (!getAllCategories().includes(category)) {
    return NextResponse.json({ error: "존재하지 않는 카테고리입니다." }, { status: 400 });
  }

  const categories = deleteCategory(category);
  return NextResponse.json({ categories });
}
