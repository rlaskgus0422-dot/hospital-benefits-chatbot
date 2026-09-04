import { NextResponse } from "next/server";
import { requireAdminSession } from "@/app/_lib/adminSession";
import { isCategory, listFaqAnswers, upsertFaqAnswer } from "@/app/_lib/store";

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  return NextResponse.json({ faqAnswers: await listFaqAnswers() });
}

// answer를 빈 문자열로 보내면 해당 답변을 지운다.
export async function POST(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const category = body?.category;
  const question = typeof body?.question === "string" ? body.question : "";
  const answer = typeof body?.answer === "string" ? body.answer : "";

  if (!(await isCategory(category)) || !question) {
    return NextResponse.json({ error: "카테고리와 질문이 필요합니다." }, { status: 400 });
  }

  await upsertFaqAnswer(category, question, answer);
  return NextResponse.json({ ok: true });
}
