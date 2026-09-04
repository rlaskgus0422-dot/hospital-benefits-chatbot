import { createHash } from "crypto";
import { getSupabase, DOCUMENTS_BUCKET } from "./supabase";
import type { Category } from "./categories";

// Supabase(Postgres + Storage)를 저장소로 쓴다. 카테고리 이름 변경/삭제는 DB의 외래키
// (on update cascade / on delete cascade·set null)가 category_questions·faq_answers·
// documents·contact_messages·chat_logs.matched_category까지 자동으로 전파한다 —
// supabase/migrations/0001_init.sql 참고.

export type StoredDocument = {
  category: Category;
  fileName: string;
  contentText: string;
  storagePath: string;
  createdAt: string;
};

export type ChatLog = {
  id: string;
  question: string;
  answer: string;
  matchedCategory: Category | null;
  answerType: "answered" | "no_answer" | "hr_referral" | "error";
  feedback: "helpful" | "unhelpful" | null;
  createdAt: string;
};

export type FaqAnswer = {
  category: Category;
  question: string;
  answer: string;
};

function fail(action: string, error: { message: string }): never {
  throw new Error(`[store] ${action} 실패: ${error.message}`);
}

// 카테고리 이름을 파일명에 그대로 쓰면 "/"가 섞인 이름(예: "보육료/학자금")이 Storage 경로의
// 하위 폴더로 해석되므로, 해시로 바꿔 고정 길이 안전한 경로로 만든다.
function documentStoragePath(category: Category): string {
  return `${createHash("sha256").update(category).digest("hex").slice(0, 16)}.pdf`;
}

export async function listDocuments(): Promise<StoredDocument[]> {
  const { data, error } = await getSupabase().from("documents").select("*");
  if (error) fail("문서 목록 조회", error);
  return data.map((row) => ({
    category: row.category,
    fileName: row.file_name,
    contentText: row.content_text,
    storagePath: row.storage_path,
    createdAt: row.created_at,
  }));
}

export async function getDocument(category: Category): Promise<StoredDocument | undefined> {
  const { data, error } = await getSupabase().from("documents").select("*").eq("category", category).maybeSingle();
  if (error) fail("문서 조회", error);
  if (!data) return undefined;
  return {
    category: data.category,
    fileName: data.file_name,
    contentText: data.content_text,
    storagePath: data.storage_path,
    createdAt: data.created_at,
  };
}

export async function saveDocument(
  category: Category,
  fileName: string,
  contentText: string,
  fileBuffer: Buffer
): Promise<StoredDocument> {
  const supabase = getSupabase();
  const storagePath = documentStoragePath(category);

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, fileBuffer, { contentType: "application/pdf", upsert: true });
  if (uploadError) fail("문서 파일 업로드", uploadError);

  const { data, error } = await supabase
    .from("documents")
    .upsert({ category, file_name: fileName, content_text: contentText, storage_path: storagePath }, { onConflict: "category" })
    .select("*")
    .single();
  if (error) fail("문서 정보 저장", error);

  return {
    category: data.category,
    fileName: data.file_name,
    contentText: data.content_text,
    storagePath: data.storage_path,
    createdAt: data.created_at,
  };
}

export async function deleteDocument(category: Category): Promise<void> {
  const supabase = getSupabase();
  await supabase.storage.from(DOCUMENTS_BUCKET).remove([documentStoragePath(category)]);
  const { error } = await supabase.from("documents").delete().eq("category", category);
  if (error) fail("문서 삭제", error);
}

const CHAT_LOG_RETENTION_DAYS = 90;

function retentionCutoffIso(): string {
  return new Date(Date.now() - CHAT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function toChatLog(row: {
  id: string;
  question: string;
  answer: string;
  matched_category: string | null;
  answer_type: ChatLog["answerType"];
  feedback: ChatLog["feedback"];
  created_at: string;
}): ChatLog {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    matchedCategory: row.matched_category,
    answerType: row.answer_type,
    feedback: row.feedback,
    createdAt: row.created_at,
  };
}

export async function appendChatLog(log: Omit<ChatLog, "id" | "createdAt" | "feedback">): Promise<ChatLog> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("chat_logs")
    .insert({ question: log.question, answer: log.answer, matched_category: log.matchedCategory, answer_type: log.answerType })
    .select("*")
    .single();
  if (error) fail("대화 로그 저장", error);

  // 새 질문이 들어올 때마다 90일 지난 로그를 함께 정리해서, 별도 배치 작업 없이도 테이블이 무한정 커지지 않게 한다.
  await supabase.from("chat_logs").delete().lt("created_at", retentionCutoffIso());

  return toChatLog(data);
}

export async function listChatLogs(): Promise<ChatLog[]> {
  const { data, error } = await getSupabase()
    .from("chat_logs")
    .select("*")
    .gte("created_at", retentionCutoffIso())
    .order("created_at", { ascending: false });
  if (error) fail("대화 로그 목록 조회", error);
  return data.map(toChatLog);
}

export async function setChatLogFeedback(id: string, feedback: "helpful" | "unhelpful"): Promise<boolean> {
  const { data, error } = await getSupabase().from("chat_logs").update({ feedback }).eq("id", id).select("id");
  if (error) fail("피드백 저장", error);
  return data.length > 0;
}

export async function listFaqAnswers(): Promise<FaqAnswer[]> {
  const { data, error } = await getSupabase().from("faq_answers").select("category, question, answer");
  if (error) fail("FAQ 답변 목록 조회", error);
  return data;
}

export async function getFaqAnswer(category: Category, question: string): Promise<string | undefined> {
  const { data, error } = await getSupabase()
    .from("faq_answers")
    .select("answer")
    .eq("category", category)
    .eq("question", question)
    .maybeSingle();
  if (error) fail("FAQ 답변 조회", error);
  return data?.answer;
}

// answer가 빈 문자열이면 기존 항목을 지운다.
export async function upsertFaqAnswer(category: Category, question: string, answer: string): Promise<void> {
  const supabase = getSupabase();
  const trimmed = answer.trim();
  if (!trimmed) {
    const { error } = await supabase.from("faq_answers").delete().eq("category", category).eq("question", question);
    if (error) fail("FAQ 답변 삭제", error);
    return;
  }
  const { error } = await supabase.from("faq_answers").upsert({ category, question, answer: trimmed }, { onConflict: "category,question" });
  if (error) fail("FAQ 답변 저장", error);
}

export type BulkFaqRow = { category: string; question: string; answer: string };
export type BulkFaqResult = { added: number; skipped: { row: number; reason: string }[] };

// 엑셀 일괄 업로드로 받은 행들을 검증한 뒤 질문 등록 + 답변 저장을 한 번에 처리한다.
// 최대 2000행까지 올 수 있어 행마다 순차 요청하면 Vercel 함수 시간 제한에 걸릴 수 있으므로,
// category_questions·faq_answers 각각 한 번의 배치 upsert로 반영한다.
export async function bulkUpsertFaqAnswers(rows: BulkFaqRow[]): Promise<BulkFaqResult> {
  const supabase = getSupabase();
  const validCategories = new Set(await getAllCategories());
  const skipped: { row: number; reason: string }[] = [];
  const validRows: { category: string; question: string; answer: string }[] = [];

  rows.forEach((entry, index) => {
    const rowNumber = index + 2; // 1행은 헤더이므로 실제 엑셀 행 번호 기준으로 안내
    if (!entry.category || !validCategories.has(entry.category)) {
      skipped.push({ row: rowNumber, reason: `존재하지 않는 카테고리: "${entry.category || "(비어있음)"}"` });
      return;
    }
    if (!entry.question || !entry.answer) {
      skipped.push({ row: rowNumber, reason: "질문 또는 답변이 비어있음" });
      return;
    }
    validRows.push(entry);
  });

  if (validRows.length === 0) return { added: 0, skipped };

  const touchedCategories = [...new Set(validRows.map((r) => r.category))];
  const { data: existingQuestions, error: existingError } = await supabase
    .from("category_questions")
    .select("category, question, position")
    .in("category", touchedCategories);
  if (existingError) fail("기존 질문 조회", existingError);

  const existingKeys = new Set(existingQuestions.map((q) => `${q.category}|||${q.question}`));
  const maxPositionByCategory = new Map<string, number>();
  for (const q of existingQuestions) {
    maxPositionByCategory.set(q.category, Math.max(maxPositionByCategory.get(q.category) ?? -1, q.position));
  }

  const newQuestionRows: { category: string; question: string; position: number }[] = [];
  const seenNewKeys = new Set<string>();
  for (const row of validRows) {
    const key = `${row.category}|||${row.question}`;
    if (existingKeys.has(key) || seenNewKeys.has(key)) continue;
    seenNewKeys.add(key);
    const nextPosition = (maxPositionByCategory.get(row.category) ?? -1) + 1;
    maxPositionByCategory.set(row.category, nextPosition);
    newQuestionRows.push({ category: row.category, question: row.question, position: nextPosition });
  }

  if (newQuestionRows.length) {
    const { error } = await supabase.from("category_questions").insert(newQuestionRows);
    if (error) fail("질문 일괄 등록", error);
  }

  // 같은 업로드 안에 같은 (카테고리,질문)이 여러 번 나오면 뒤에 나온 답변이 이기도록
  // (엑셀을 순서대로 처리하던 기존 동작과 동일하게) 먼저 값으로 덮어쓴 뒤 한 번에 upsert한다 —
  // Postgres는 한 INSERT 문 안에서 같은 충돌 대상을 두 번 건드리는 걸 허용하지 않는다.
  const dedupedAnswers = new Map<string, { category: string; question: string; answer: string }>();
  for (const row of validRows) dedupedAnswers.set(`${row.category}|||${row.question}`, row);

  const { error: upsertError } = await supabase
    .from("faq_answers")
    .upsert([...dedupedAnswers.values()], { onConflict: "category,question" });
  if (upsertError) fail("FAQ 답변 일괄 저장", upsertError);

  return { added: validRows.length, skipped };
}

export async function getAllCategories(): Promise<string[]> {
  const { data, error } = await getSupabase().from("categories").select("name").order("position");
  if (error) fail("카테고리 목록 조회", error);
  return data.map((row) => row.name);
}

// 클라이언트가 보낸 카테고리 값이 실제로 유효한지 검사한다. 여러 라우트에서 각자 정의하던 걸 하나로 모았다.
// (async라 타입가드(`value is Category`)는 쓸 수 없다 — 호출부에서 확인 후 필요하면 그대로 문자열로 쓴다.)
export async function isCategory(value: unknown): Promise<boolean> {
  return typeof value === "string" && (await getAllCategories()).includes(value);
}

const CATEGORY_NAME_PATTERN = /^[가-힣a-zA-Z0-9()·./\-\s]{1,30}$/;

// "toString"·"constructor" 같은 이름을 허용하면, 이후 이 이름을 객체 키로 쓰는 로직에서
// 상속된 프로토타입 멤버(함수)가 튀어나올 수 있다. 글자 자체는 허용 문자셋 검사만으로 못 걸러내므로
// (예: "constructor"는 전부 영문자라 통과함) 알려진 위험한 이름은 별도로 명시해 막는다.
const RESERVED_OBJECT_KEYS = new Set([
  "__proto__",
  "constructor",
  "prototype",
  "tostring",
  "valueof",
  "hasownproperty",
  "isprototypeof",
  "propertyisenumerable",
  "tolocalestring",
  "length",
]);

function isSafeCategoryName(name: string): boolean {
  return CATEGORY_NAME_PATTERN.test(name) && !RESERVED_OBJECT_KEYS.has(name.toLowerCase());
}

export async function addCategory(name: string): Promise<string[]> {
  const trimmed = name.trim();
  const current = await getAllCategories();
  if (!trimmed || !isSafeCategoryName(trimmed) || current.includes(trimmed)) return current;

  const supabase = getSupabase();
  const { data: maxRow, error: maxError } = await supabase
    .from("categories")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxError) fail("카테고리 순서 조회", maxError);

  const { error } = await supabase.from("categories").insert({ name: trimmed, position: (maxRow?.position ?? -1) + 1 });
  if (error) fail("카테고리 추가", error);
  return [...current, trimmed];
}

// 카테고리 이름 변경. 관련 질문·FAQ 답변·문서·담당자 안내·대화 로그는 DB 외래키(on update cascade)가 자동으로 옮긴다.
export async function renameCategory(oldName: string, newName: string): Promise<string[]> {
  const trimmed = newName.trim();
  const current = await getAllCategories();
  if (!trimmed || !isSafeCategoryName(trimmed) || !current.includes(oldName) || current.includes(trimmed)) return current;

  const { error } = await getSupabase().from("categories").update({ name: trimmed }).eq("name", oldName);
  if (error) fail("카테고리 이름 변경", error);
  return getAllCategories();
}

// 카테고리 삭제. 관련 질문·FAQ 답변·담당자 안내·문서 행은 DB 외래키(on delete cascade)가 자동으로 지운다
// (대화 로그의 matched_category는 on delete set null로 로그 자체는 남기고 분류만 비운다).
// Storage에 남은 PDF 파일은 cascade 대상이 아니므로 먼저 직접 지운다.
export async function deleteCategory(name: string): Promise<string[]> {
  await deleteDocument(name);
  const { error } = await getSupabase().from("categories").delete().eq("name", name);
  if (error) fail("카테고리 삭제", error);
  return getAllCategories();
}

export async function getCategoryOrder(): Promise<Category[]> {
  return getAllCategories();
}

// 넘어온 순서 중 지금도 유효한 카테고리만 반영하고, 빠진 카테고리는 뒤에 그대로 남긴다
// (요청에 실수로 빠진 카테고리가 목록에서 사라지지 않도록 하는 안전장치).
export async function setCategoryOrder(order: Category[]): Promise<void> {
  const current = await getAllCategories();
  const validOrdered = order.filter((name) => current.includes(name));
  const missing = current.filter((name) => !validOrdered.includes(name));
  const finalOrder = [...validOrdered, ...missing];

  const { error } = await getSupabase()
    .from("categories")
    .upsert(finalOrder.map((name, position) => ({ name, position })), { onConflict: "name" });
  if (error) fail("카테고리 순서 저장", error);
}

export async function getCategoryQuestions(category: Category): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from("category_questions")
    .select("question")
    .eq("category", category)
    .order("position");
  if (error) fail("질문 목록 조회", error);
  return data.map((row) => row.question);
}

export async function setCategoryQuestions(category: Category, questions: string[]): Promise<void> {
  const supabase = getSupabase();
  const { error: deleteError } = await supabase.from("category_questions").delete().eq("category", category);
  if (deleteError) fail("질문 목록 저장", deleteError);
  if (!questions.length) return;

  const { error } = await supabase
    .from("category_questions")
    .insert(questions.map((question, position) => ({ category, question, position })));
  if (error) fail("질문 목록 저장", error);
}

export async function addCategoryQuestion(category: Category, question: string): Promise<string[]> {
  const trimmed = question.trim();
  const current = await getCategoryQuestions(category);
  if (!trimmed || current.includes(trimmed)) return current;

  const { error } = await getSupabase()
    .from("category_questions")
    .insert({ category, question: trimmed, position: current.length });
  if (error) fail("질문 추가", error);
  return [...current, trimmed];
}

// 질문 내용 수정. 이미 등록된 답변이 있으면 새 질문 텍스트로 함께 옮긴다.
export async function renameCategoryQuestion(category: Category, oldQuestion: string, newQuestion: string): Promise<string[]> {
  const trimmed = newQuestion.trim();
  if (!trimmed) return getCategoryQuestions(category);

  const supabase = getSupabase();
  const { error } = await supabase
    .from("category_questions")
    .update({ question: trimmed })
    .eq("category", category)
    .eq("question", oldQuestion);
  if (error) fail("질문 수정", error);

  const { error: faqError } = await supabase
    .from("faq_answers")
    .update({ question: trimmed })
    .eq("category", category)
    .eq("question", oldQuestion);
  if (faqError) fail("질문 수정(FAQ 답변 동기화)", faqError);

  return getCategoryQuestions(category);
}

export async function deleteCategoryQuestion(category: Category, question: string): Promise<string[]> {
  const supabase = getSupabase();
  const { error } = await supabase.from("category_questions").delete().eq("category", category).eq("question", question);
  if (error) fail("질문 삭제", error);
  await upsertFaqAnswer(category, question, "");
  return getCategoryQuestions(category);
}

// 답변이 등록돼 있는 질문만 골라준다 — 자유 질문이 이 중 하나와 비슷하면 바로 답변을 재사용하는 데 쓰인다.
export async function listAnsweredQuestions(category: Category): Promise<string[]> {
  const [registered, faqAnswers] = await Promise.all([getCategoryQuestions(category), listFaqAnswers()]);
  const registeredSet = new Set(registered);
  return faqAnswers.filter((entry) => entry.category === category && registeredSet.has(entry.question)).map((entry) => entry.question);
}

// 카테고리별로 등록해둔 담당자 안내 문구. 등록해두지 않은 카테고리는 undefined — 호출하는 쪽에서 공통 기본 문구를 쓴다.
export async function getContactMessage(category: Category): Promise<string | undefined> {
  const { data, error } = await getSupabase().from("contact_messages").select("message").eq("category", category).maybeSingle();
  if (error) fail("담당자 안내 문구 조회", error);
  return data?.message;
}

export async function listContactMessages(): Promise<Partial<Record<Category, string>>> {
  const { data, error } = await getSupabase().from("contact_messages").select("category, message");
  if (error) fail("담당자 안내 문구 목록 조회", error);
  return Object.fromEntries(data.map((row) => [row.category, row.message]));
}

// message가 빈 문자열이면 등록을 지우고(공통 기본 문구로 되돌아감), 아니면 그 카테고리 문구로 저장한다.
export async function setContactMessage(category: Category, message: string): Promise<void> {
  const supabase = getSupabase();
  const trimmed = message.trim();
  if (!trimmed) {
    const { error } = await supabase.from("contact_messages").delete().eq("category", category);
    if (error) fail("담당자 안내 문구 삭제", error);
    return;
  }
  const { error } = await supabase.from("contact_messages").upsert({ category, message: trimmed }, { onConflict: "category" });
  if (error) fail("담당자 안내 문구 저장", error);
}
