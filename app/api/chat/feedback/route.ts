import { NextResponse } from "next/server";
import { setChatLogFeedback } from "@/app/_lib/store";
import { isRequestRateLimited } from "@/app/_lib/rateLimit";

function isFeedback(value: unknown): value is "helpful" | "unhelpful" {
  return value === "helpful" || value === "unhelpful";
}

// 답변에 대한 도움됐어요/아니에요 피드백을 저장한다. 개인 식별 정보는 담지 않는다.
// logId는 로그인 없이도 아는 사람이면 누구나 바꿀 수 있어(추측 불가능한 UUID라 실질 위험은 낮음)
// 남용을 줄이기 위해 레이트리밋만 걸어둔다.
export async function POST(request: Request) {
  if (isRequestRateLimited(request, "feedback", 30, 60_000)) {
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const logId = typeof body?.logId === "string" ? body.logId : "";

  if (!logId || !isFeedback(body?.feedback)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const updated = setChatLogFeedback(logId, body.feedback);
  if (!updated) {
    return NextResponse.json({ error: "해당 로그를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
