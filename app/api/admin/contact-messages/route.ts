import { NextResponse } from "next/server";
import { requireAdminSession } from "@/app/_lib/adminSession";
import { isCategory, listContactMessages, setContactMessage } from "@/app/_lib/store";

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  return NextResponse.json({ contactMessages: await listContactMessages() });
}

// message를 빈 문자열로 보내면 그 카테고리의 문구를 지우고 공통 기본 문구로 되돌린다.
export async function POST(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message : "";

  if (!(await isCategory(body?.category))) {
    return NextResponse.json({ error: "잘못된 카테고리입니다." }, { status: 400 });
  }

  await setContactMessage(body.category, message);
  return NextResponse.json({ ok: true });
}
