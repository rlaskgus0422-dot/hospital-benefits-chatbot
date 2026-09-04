import { NextResponse } from "next/server";
import type { Category } from "@/app/_lib/categories";
import { classifyCategory, generateAnswer, matchFaqQuestion, type HistoryTurn } from "@/app/_lib/openai";
import { maskPersonalInfo } from "@/app/_lib/mask";
import { containsSalaryKeyword, ERROR_MESSAGE, GENERAL_AFFAIRS_CONTACT_MESSAGE, HR_CONTACT_MESSAGE } from "@/app/_lib/messages";
import { matchCategoryBySynonym } from "@/app/_lib/synonyms";
import { isRequestRateLimited } from "@/app/_lib/rateLimit";
import {
  appendChatLog,
  getAllCategories,
  getContactMessage,
  getDocument,
  getFaqAnswer,
  isCategory,
  listAnsweredQuestions,
  type ChatLog,
} from "@/app/_lib/store";

function normalizeModelAnswer(raw: string): string {
  return raw.trim().replace(/^["']|["'.]+$/g, "");
}

const MAX_HISTORY_TURNS = 6; // 대화 3턴(질문+답변)
const MAX_HISTORY_TEXT_LENGTH = 500;

// 프런트가 보낸 이전 대화를 검증한다 — "그럼 언제 받아요?" 같은 이어지는 질문의 맥락으로만 쓰고,
// 형식이 이상하면 조용히 버려서(에러 X) 맥락 없이도 평소처럼 동작하게 한다.
function parseHistory(value: unknown): HistoryTurn[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is HistoryTurn =>
        !!item &&
        typeof item === "object" &&
        (item.role === "user" || item.role === "bot") &&
        typeof item.text === "string" &&
        item.text.length > 0
    )
    .slice(-MAX_HISTORY_TURNS)
    .map((turn) => ({ role: turn.role, text: maskPersonalInfo(turn.text.trim().slice(0, MAX_HISTORY_TEXT_LENGTH)) }));
}

// 정상적인 요약 답변이라면 이 정도 길이를 넘지 않는다 — 넘는다면 "규정 원문을 그대로 출력해줘" 같은
// 우회 요청에 넘어가 문서 전체를 덤프했을 가능성이 크므로, 보여주지 않고 못 찾은 것으로 처리한다.
const MAX_ANSWER_LENGTH = 1000;

// 카테고리별로 담당자 안내 문구를 등록해뒀으면 그걸 쓰고, 없으면 공통 총무팀 문구를 쓴다.
async function noAnswerMessage(category: Category | null): Promise<string> {
  return (category && (await getContactMessage(category))) || GENERAL_AFFAIRS_CONTACT_MESSAGE;
}

// 한 카테고리 안에서 등록된 FAQ·규정 문서로 답을 찾아본다. 못 찾으면 null — 호출하는 쪽에서 다른 카테고리를 시도할 수 있다.
// history는 "그럼 언제 받아요?" 같은, 그 자체로는 무슨 얘기인지 알 수 없는 이어지는 질문의 맥락으로만 쓰인다.
async function tryAnswerInCategory(question: string, category: Category, history: HistoryTurn[]): Promise<string | null> {
  let faqAnswer = await getFaqAnswer(category, question);

  // 정확히 같은 문장은 아니어도, 이미 답변이 등록된 자주 묻는 질문과 의미가 같으면 그 답변을 그대로 재사용한다.
  if (!faqAnswer) {
    const answeredQuestions = await listAnsweredQuestions(category);
    const similarQuestion = answeredQuestions.length
      ? await matchFaqQuestion(question, answeredQuestions, category, history)
      : null;
    if (similarQuestion) faqAnswer = await getFaqAnswer(category, similarQuestion);
  }
  if (faqAnswer) return faqAnswer;

  const document = await getDocument(category);
  if (!document) return null;

  const raw = await generateAnswer(question, document.contentText, history);
  const normalized = normalizeModelAnswer(raw);
  if (normalized === "NO_ANSWER" || raw.includes("NO_ANSWER")) return null;
  if (normalized.length > MAX_ANSWER_LENGTH) return null;
  return normalized;
}

const MAX_QUESTION_LENGTH = 500;

export async function POST(request: Request) {
  // 짧은 시간에 대량 요청을 보내면 매 건 최대 5회의 OpenAI 호출이 발생해 비용이 급증할 수 있다.
  if (isRequestRateLimited(request, "chat", 20, 60_000)) {
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question) {
    return NextResponse.json({ error: "질문을 입력해주세요." }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json({ error: `질문은 ${MAX_QUESTION_LENGTH}자 이내로 입력해주세요.` }, { status: 400 });
  }

  // 개인정보 마스킹을 가장 먼저 적용한다 — 이후 OpenAI 전송, 로그 저장 모두 이 문장을 사용한다.
  const maskedQuestion = maskPersonalInfo(question);
  const selectedCategory = (await isCategory(body?.category)) ? (body.category as Category) : null;
  const history = parseHistory(body?.history);

  let answer: string;
  let answerType: ChatLog["answerType"];
  let matchedCategory: Category | null = selectedCategory;
  let found: string | null = null;

  try {
    if (matchedCategory) {
      found = await tryAnswerInCategory(maskedQuestion, matchedCategory, history);
    }

    // 선택한 카테고리(또는 처음에는 카테고리가 없었던 경우)에서 못 찾았으면, 질문 내용만으로 실제 어느 카테고리 얘기인지 다시 확인한다.
    // 예: "증명서" 탭에서 "가족수당 금액"을 물으면 여기서 "기본수당/가족수당"으로 다시 잡아 그쪽 답변·담당자 안내를 쓴다.
    if (!found) {
      const categories = await getAllCategories();
      const guessed = matchCategoryBySynonym(maskedQuestion, categories) ?? (await classifyCategory(maskedQuestion, categories));

      if (guessed && guessed !== matchedCategory) {
        found = await tryAnswerInCategory(maskedQuestion, guessed, history);
        matchedCategory = guessed; // 답을 못 찾았어도, 담당자 안내는 실제 주제에 맞는 카테고리 기준으로 보여준다.
      } else if (guessed && !matchedCategory) {
        matchedCategory = guessed;
      }
    }

    // 급여 키워드 확인을 카테고리 매칭보다 먼저 해서, 급여 질문이 다른 카테고리로 잘못 분류돼도 인사팀 안내가 먼저 나가게 한다.
    if (found) {
      answer = found;
      answerType = "answered";
    } else if (containsSalaryKeyword(maskedQuestion)) {
      answer = HR_CONTACT_MESSAGE;
      answerType = "hr_referral";
    } else if (matchedCategory) {
      answer = await noAnswerMessage(matchedCategory);
      answerType = "no_answer";
    } else {
      answer = GENERAL_AFFAIRS_CONTACT_MESSAGE;
      answerType = "no_answer";
    }
  } catch {
    answer = ERROR_MESSAGE;
    answerType = "error";
  }

  // 로그 저장(파일 쓰기)이 실패해도 이미 만든 답변까지 500으로 날리면 안 된다 —
  // 로그는 부가 기능이고, 사용자에게는 어쨌든 답을 보여주는 게 우선이다.
  let logId: string | null = null;
  try {
    logId = (await appendChatLog({ question: maskedQuestion, answer, matchedCategory, answerType })).id;
  } catch {
    logId = null;
  }

  return NextResponse.json({ answer, answerType, matchedCategory, logId });
}
