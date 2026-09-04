import { NextResponse } from "next/server";
import { requireAdminSession } from "@/app/_lib/adminSession";
import { listChatLogs } from "@/app/_lib/store";

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  return NextResponse.json({ logs: await listChatLogs() });
}
