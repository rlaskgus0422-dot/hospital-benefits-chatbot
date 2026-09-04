import { NextResponse } from "next/server";
import { requireAdminSession } from "@/app/_lib/adminSession";
import { deleteDocument, isCategory } from "@/app/_lib/store";

export async function DELETE(_request: Request, { params }: { params: Promise<{ category: string }> }) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { category } = await params;
  if (!isCategory(category)) {
    return NextResponse.json({ error: "존재하지 않는 카테고리입니다." }, { status: 400 });
  }

  deleteDocument(category);
  return NextResponse.json({ ok: true });
}
