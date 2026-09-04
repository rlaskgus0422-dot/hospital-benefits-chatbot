import { NextResponse } from "next/server";
import { requireAdminSession } from "@/app/_lib/adminSession";
import type { Category } from "@/app/_lib/categories";
import {
  addCategoryQuestion,
  deleteCategoryQuestion,
  getAllCategories,
  getCategoryQuestions,
  isCategory,
  renameCategoryQuestion,
  setCategoryQuestions,
} from "@/app/_lib/store";

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const categories = await getAllCategories();
  const questionsByCategory = Object.fromEntries(
    await Promise.all(categories.map(async (category) => [category, await getCategoryQuestions(category)] as const))
  ) as Record<Category, string[]>;
  return NextResponse.json({ questionsByCategory });
}

// 질문을 새로 추가하거나(순서 뒤에 붙임) 목록 전체를 새 순서로 통째로 저장한다.
export async function POST(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!(await isCategory(body?.category))) {
    return NextResponse.json({ error: "잘못된 카테고리입니다." }, { status: 400 });
  }

  if (typeof body?.addQuestion === "string") {
    if (!body.addQuestion.trim()) {
      return NextResponse.json({ error: "질문 내용을 입력해주세요." }, { status: 400 });
    }
    const questions = await addCategoryQuestion(body.category, body.addQuestion);
    return NextResponse.json({ questions });
  }

  if (isStringArray(body?.questions)) {
    await setCategoryQuestions(body.category, body.questions);
    return NextResponse.json({ questions: body.questions });
  }

  if (body?.renameQuestion && typeof body.renameQuestion === "object") {
    const { oldQuestion, newQuestion } = body.renameQuestion;
    if (typeof oldQuestion !== "string" || typeof newQuestion !== "string" || !newQuestion.trim()) {
      return NextResponse.json({ error: "잘못된 질문 수정 요청입니다." }, { status: 400 });
    }
    const questions = await renameCategoryQuestion(body.category, oldQuestion, newQuestion);
    return NextResponse.json({ questions });
  }

  if (typeof body?.deleteQuestion === "string") {
    const questions = await deleteCategoryQuestion(body.category, body.deleteQuestion);
    return NextResponse.json({ questions });
  }

  return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
}
