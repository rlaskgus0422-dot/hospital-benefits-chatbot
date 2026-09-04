import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { createHash } from "crypto";
import path from "path";
import { CATEGORIES, type Category } from "./categories";
import { CATEGORY_FAQS } from "./faq";

// Supabase 연동 전까지 로컬 파일로 데이터를 저장하는 임시 저장소.
// documents/chat-logs/faq-answers 세 가지를 다루며, 나중에 Supabase 클라이언트로 교체될 부분이다.

const DATA_DIR = path.join(process.cwd(), "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const DOCUMENTS_PATH = path.join(DATA_DIR, "documents.json");
const CHAT_LOGS_PATH = path.join(DATA_DIR, "chat-logs.json");
const FAQ_ANSWERS_PATH = path.join(DATA_DIR, "faq-answers.json");
const ORDER_PATH = path.join(DATA_DIR, "order.json");
const QUESTIONS_PATH = path.join(DATA_DIR, "questions.json");
const CATEGORIES_PATH = path.join(DATA_DIR, "categories.json");
const CONTACT_MESSAGES_PATH = path.join(DATA_DIR, "contact-messages.json");

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

function ensureUploadsDir() {
  if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });
}

// 매 요청마다 같은 파일을 여러 번 읽는 걸 막기 위한 메모리 캐시. 쓰기 시 함께 갱신되므로 항상 최신 상태를 유지한다.
const jsonCache = new Map<string, unknown>();

function readJson<T>(filePath: string, fallback: T): T {
  if (jsonCache.has(filePath)) return jsonCache.get(filePath) as T;
  const data = existsSync(filePath) ? JSON.parse(readFileSync(filePath, "utf-8")) : fallback;
  jsonCache.set(filePath, data);
  return data;
}

// Vercel 같은 서버리스 환경은 배포된 파일시스템이 읽기 전용이라 실제 저장이 실패할 수 있다.
// 여기서 실패를 삼키면 관리자 화면에는 "저장 성공"으로 보이는데 실제로는 아무것도 저장되지 않는
// 조용한 데이터 유실이 생기므로, 그대로 던져서 호출한 라우트가 에러 응답을 내도록 한다.
// (반대로 챗봇 응답용 로그 저장처럼 실패해도 괜찮은 곳은 호출하는 쪽에서 개별적으로 try/catch한다.)
function writeJson(filePath: string, data: unknown) {
  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  jsonCache.set(filePath, data);
}

export function listDocuments(): StoredDocument[] {
  return readJson<StoredDocument[]>(DOCUMENTS_PATH, []);
}

export function getDocument(category: Category): StoredDocument | undefined {
  return listDocuments().find((doc) => doc.category === category);
}

// 카테고리 이름을 파일명에 그대로 쓰면 "/"가 섞인 이름(예: "보육료/학자금")이 하위 디렉터리로
// 해석돼 없는 폴더에 쓰다가 실패하고, 경로 조작 방어도 매번 따로 신경 써야 한다.
// 카테고리 이름을 해시로 바꿔 고정 길이 안전한 파일명으로 만들면 두 문제가 한 번에 해결된다.
function documentFileName(category: Category): string {
  return `${createHash("sha256").update(category).digest("hex").slice(0, 16)}.pdf`;
}

export function saveDocument(category: Category, fileName: string, contentText: string, fileBuffer: Buffer): StoredDocument {
  ensureUploadsDir();
  const storagePath = path.join(UPLOADS_DIR, documentFileName(category));
  writeFileSync(storagePath, fileBuffer);

  const document: StoredDocument = {
    category,
    fileName,
    contentText,
    storagePath,
    createdAt: new Date().toISOString(),
  };

  const documents = listDocuments().filter((doc) => doc.category !== category);
  documents.push(document);
  writeJson(DOCUMENTS_PATH, documents);
  return document;
}

export function deleteDocument(category: Category) {
  const documents = listDocuments();
  const target = documents.find((doc) => doc.category === category);
  if (target && existsSync(target.storagePath)) unlinkSync(target.storagePath);
  writeJson(DOCUMENTS_PATH, documents.filter((doc) => doc.category !== category));
}

const CHAT_LOG_RETENTION_DAYS = 90;

function isWithinRetention(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() <= CHAT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
}

export function appendChatLog(log: Omit<ChatLog, "id" | "createdAt" | "feedback">): ChatLog {
  const logs = readJson<ChatLog[]>(CHAT_LOGS_PATH, []);
  const entry: ChatLog = { ...log, id: crypto.randomUUID(), feedback: null, createdAt: new Date().toISOString() };

  // 새 질문이 들어올 때마다 90일 지난 로그를 함께 정리해서, 별도 배치 작업 없이도 파일이 무한정 커지지 않게 한다.
  // (캐시된 배열을 직접 건드리지 않도록 push 대신 새 배열을 만든다.)
  writeJson(CHAT_LOGS_PATH, [...logs, entry].filter((item) => isWithinRetention(item.createdAt)));
  return entry;
}

// 트래픽이 뜸해 정리가 안 된 경우에도 화면에는 90일 지난 로그가 보이지 않도록, 조회 시에도 한 번 더 걸러낸다.
// 관리자 화면에 최근 것부터 보여주기 위해 역순으로 반환한다.
export function listChatLogs(): ChatLog[] {
  return readJson<ChatLog[]>(CHAT_LOGS_PATH, [])
    .filter((log) => isWithinRetention(log.createdAt))
    .reverse();
}

// logId가 존재하지 않으면(오래된 로그가 삭제되었거나 잘못된 값) false를 반환한다.
export function setChatLogFeedback(id: string, feedback: "helpful" | "unhelpful"): boolean {
  const logs = readJson<ChatLog[]>(CHAT_LOGS_PATH, []);
  const target = logs.find((log) => log.id === id);
  if (!target) return false;
  target.feedback = feedback;
  writeJson(CHAT_LOGS_PATH, logs);
  return true;
}

export function listFaqAnswers(): FaqAnswer[] {
  return readJson<FaqAnswer[]>(FAQ_ANSWERS_PATH, []);
}

export function getFaqAnswer(category: Category, question: string): string | undefined {
  return listFaqAnswers().find((entry) => entry.category === category && entry.question === question)?.answer;
}

// answer가 빈 문자열이면 기존 항목을 지운다.
export function upsertFaqAnswer(category: Category, question: string, answer: string) {
  const entries = listFaqAnswers().filter((entry) => !(entry.category === category && entry.question === question));
  if (answer.trim()) entries.push({ category, question, answer: answer.trim() });
  writeJson(FAQ_ANSWERS_PATH, entries);
}

export type BulkFaqRow = { category: string; question: string; answer: string };
export type BulkFaqResult = { added: number; skipped: { row: number; reason: string }[] };

// 엑셀 일괄 업로드로 받은 행들을 검증한 뒤 질문 등록 + 답변 저장을 한 번에 처리한다.
export function bulkUpsertFaqAnswers(rows: BulkFaqRow[]): BulkFaqResult {
  const validCategories = new Set(getAllCategories());
  let added = 0;
  const skipped: { row: number; reason: string }[] = [];

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
    addCategoryQuestion(entry.category, entry.question);
    upsertFaqAnswer(entry.category, entry.question, entry.answer);
    added += 1;
  });

  return { added, skipped };
}

type CategoriesData = {
  added: string[]; // 관리자가 새로 추가한 카테고리
  removedDefaults: string[]; // 기본 카테고리 중 이름이 바뀌었거나 삭제되어 더 이상 기본 목록에 안 보여야 하는 것들
};

function readCategoriesData(): CategoriesData {
  return readJson<CategoriesData>(CATEGORIES_PATH, { added: [], removedDefaults: [] });
}

function writeCategoriesData(data: CategoriesData) {
  writeJson(CATEGORIES_PATH, data);
}

// 지금 유효한 전체 카테고리 목록 — (기본 카테고리 - 이름변경/삭제된 것) + 관리자가 추가한 카테고리.
// 카테고리 관련 유효성 검사는 전부 이 함수를 기준으로 한다 (categories.ts의 CATEGORIES는 기본값일 뿐).
export function getAllCategories(): string[] {
  const { added, removedDefaults } = readCategoriesData();
  const defaults = (CATEGORIES as readonly string[]).filter((name) => !removedDefaults.includes(name));
  const extra = added.filter((name) => !defaults.includes(name));
  return [...defaults, ...extra];
}

// 클라이언트가 보낸 카테고리 값이 실제로 유효한지 검사한다. 여러 라우트에서 각자 정의하던 걸 하나로 모았다.
export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && getAllCategories().includes(value);
}

const CATEGORY_NAME_PATTERN = /^[가-힣a-zA-Z0-9()·./\-\s]{1,30}$/;

// "toString"·"constructor" 같은 이름을 허용하면, 이후 이 이름을 객체 키로 쓰는
// questions.json/contact-messages.json 조회에서 문자열 대신 상속된 프로토타입 멤버(함수)가
// 튀어나와 그 카테고리의 응답이 깨질 수 있다. 글자 자체는 허용 문자셋 검사만으로 못 걸러내므로
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

export function addCategory(name: string): string[] {
  const trimmed = name.trim();
  const current = getAllCategories();
  if (!trimmed || !isSafeCategoryName(trimmed) || current.includes(trimmed)) return current;
  const data = readCategoriesData();
  writeCategoriesData({ ...data, added: [...data.added, trimmed] });
  return [...current, trimmed];
}

// 카테고리 이름 변경. 이 카테고리를 참조하던 순서·질문·문서·FAQ 답변을 새 이름으로 함께 옮긴다.
export function renameCategory(oldName: string, newName: string): string[] {
  const trimmed = newName.trim();
  const current = getAllCategories();
  if (!trimmed || !isSafeCategoryName(trimmed) || !current.includes(oldName) || current.includes(trimmed)) return current;

  const data = readCategoriesData();
  if ((CATEGORIES as readonly string[]).includes(oldName)) {
    writeCategoriesData({ added: [...data.added, trimmed], removedDefaults: [...data.removedDefaults, oldName] });
  } else {
    writeCategoriesData({ ...data, added: data.added.map((name) => (name === oldName ? trimmed : name)) });
  }

  const order = readOrderData();
  if (order.categoryOrder) {
    writeJson(ORDER_PATH, { ...order, categoryOrder: order.categoryOrder.map((c) => (c === oldName ? trimmed : c)) });
  }

  const questions = readQuestionsData();
  if (questions[oldName]) {
    const { [oldName]: moved, ...rest } = questions;
    writeJson(QUESTIONS_PATH, { ...rest, [trimmed]: moved });
  }

  writeJson(
    DOCUMENTS_PATH,
    listDocuments().map((doc) => (doc.category === oldName ? { ...doc, category: trimmed } : doc))
  );
  writeJson(
    FAQ_ANSWERS_PATH,
    listFaqAnswers().map((entry) => (entry.category === oldName ? { ...entry, category: trimmed } : entry))
  );

  const contactMessages = readContactMessages();
  if (contactMessages[oldName] !== undefined) {
    const rest = { ...contactMessages };
    delete rest[oldName];
    writeJson(CONTACT_MESSAGES_PATH, { ...rest, [trimmed]: contactMessages[oldName] });
  }

  writeJson(
    CHAT_LOGS_PATH,
    readJson<ChatLog[]>(CHAT_LOGS_PATH, []).map((log) =>
      log.matchedCategory === oldName ? { ...log, matchedCategory: trimmed } : log
    )
  );

  return getAllCategories();
}

// 카테고리 삭제. 그 카테고리에 딸린 순서·질문·문서(파일 포함)·FAQ 답변도 함께 지운다.
export function deleteCategory(name: string): string[] {
  const data = readCategoriesData();
  if ((CATEGORIES as readonly string[]).includes(name)) {
    writeCategoriesData({ ...data, removedDefaults: [...data.removedDefaults, name] });
  } else {
    writeCategoriesData({ ...data, added: data.added.filter((c) => c !== name) });
  }

  const order = readOrderData();
  if (order.categoryOrder) {
    writeJson(ORDER_PATH, { ...order, categoryOrder: order.categoryOrder.filter((c) => c !== name) });
  }

  const questions = readQuestionsData();
  if (questions[name]) {
    const rest = { ...questions };
    delete rest[name];
    writeJson(QUESTIONS_PATH, rest);
  }

  deleteDocument(name);
  writeJson(
    FAQ_ANSWERS_PATH,
    listFaqAnswers().filter((entry) => entry.category !== name)
  );

  const contactMessages = readContactMessages();
  if (contactMessages[name] !== undefined) {
    const rest = { ...contactMessages };
    delete rest[name];
    writeJson(CONTACT_MESSAGES_PATH, rest);
  }

  writeJson(
    CHAT_LOGS_PATH,
    readJson<ChatLog[]>(CHAT_LOGS_PATH, []).map((log) =>
      log.matchedCategory === name ? { ...log, matchedCategory: null } : log
    )
  );

  return getAllCategories();
}

type OrderData = {
  categoryOrder?: Category[];
};

function readOrderData(): OrderData {
  return readJson<OrderData>(ORDER_PATH, {});
}

// 저장된 순서 중 지금도 유효한 항목만 남기고, 새로 추가돼 저장 이력에 없는 항목은 기본 순서 그대로 뒤에 붙인다.
function mergeOrder<T extends string>(saved: T[] | undefined, defaults: readonly T[]): T[] {
  const validSaved = (saved ?? []).filter((item) => (defaults as readonly string[]).includes(item));
  const missing = defaults.filter((item) => !validSaved.includes(item));
  return [...validSaved, ...missing];
}

export function getCategoryOrder(): Category[] {
  return mergeOrder(readOrderData().categoryOrder, getAllCategories());
}

export function setCategoryOrder(order: Category[]) {
  const data = readOrderData();
  writeJson(ORDER_PATH, { ...data, categoryOrder: mergeOrder(order, getAllCategories()) });
}

type QuestionsData = Partial<Record<Category, string[]>>;

function readQuestionsData(): QuestionsData {
  return readJson<QuestionsData>(QUESTIONS_PATH, {});
}

// 관리자가 한 번도 손대지 않은 카테고리는 기본 질문 목록을 그대로 쓰고, 손댄 뒤로는 저장된 목록이 그대로 정답이 된다
// (추가·순서변경 모두 이 목록 하나에 반영된다). 새로 추가된 카테고리는 기본 질문이 없으니 빈 목록에서 시작한다.
export function getCategoryQuestions(category: Category): string[] {
  return readQuestionsData()[category] ?? [...(CATEGORY_FAQS[category] ?? [])];
}

export function setCategoryQuestions(category: Category, questions: string[]) {
  const data = readQuestionsData();
  writeJson(QUESTIONS_PATH, { ...data, [category]: questions });
}

export function addCategoryQuestion(category: Category, question: string): string[] {
  const trimmed = question.trim();
  const current = getCategoryQuestions(category);
  const next = trimmed && !current.includes(trimmed) ? [...current, trimmed] : current;
  setCategoryQuestions(category, next);
  return next;
}

// 질문 내용 수정. 이미 등록된 답변이 있으면 새 질문 텍스트로 함께 옮긴다.
export function renameCategoryQuestion(category: Category, oldQuestion: string, newQuestion: string): string[] {
  const trimmed = newQuestion.trim();
  if (!trimmed) return getCategoryQuestions(category);

  const next = getCategoryQuestions(category).map((q) => (q === oldQuestion ? trimmed : q));
  setCategoryQuestions(category, next);

  const answer = getFaqAnswer(category, oldQuestion);
  if (answer !== undefined) {
    upsertFaqAnswer(category, oldQuestion, "");
    upsertFaqAnswer(category, trimmed, answer);
  }
  return next;
}

export function deleteCategoryQuestion(category: Category, question: string): string[] {
  const next = getCategoryQuestions(category).filter((q) => q !== question);
  setCategoryQuestions(category, next);
  upsertFaqAnswer(category, question, "");
  return next;
}

// 답변이 등록돼 있는 질문만 골라준다 — 자유 질문이 이 중 하나와 비슷하면 바로 답변을 재사용하는 데 쓰인다.
// 지금 그 카테고리에 실제로 등록된 질문 목록에 있는 것만 후보로 준다 — 질문을 수정·삭제하는 과정에서
// 예전 질문 이름으로 남아있는 답변(더 이상 화면에 안 보이는)이 자유 입력 매칭에 섞여 나오는 걸 막기 위함.
export function listAnsweredQuestions(category: Category): string[] {
  const registered = new Set(getCategoryQuestions(category));
  return listFaqAnswers()
    .filter((entry) => entry.category === category && registered.has(entry.question))
    .map((entry) => entry.question);
}

type ContactMessagesData = Partial<Record<Category, string>>;

function readContactMessages(): ContactMessagesData {
  return readJson<ContactMessagesData>(CONTACT_MESSAGES_PATH, {});
}

// 카테고리별로 등록해둔 담당자 안내 문구. 등록해두지 않은 카테고리는 undefined — 호출하는 쪽에서 공통 기본 문구를 쓴다.
export function getContactMessage(category: Category): string | undefined {
  return readContactMessages()[category];
}

export function listContactMessages(): Partial<Record<Category, string>> {
  return readContactMessages();
}

// message가 빈 문자열이면 등록을 지우고(공통 기본 문구로 되돌아감), 아니면 그 카테고리 문구로 저장한다.
export function setContactMessage(category: Category, message: string) {
  const data = readContactMessages();
  const trimmed = message.trim();
  if (!trimmed) {
    const rest = { ...data };
    delete rest[category];
    writeJson(CONTACT_MESSAGES_PATH, rest);
    return;
  }
  writeJson(CONTACT_MESSAGES_PATH, { ...data, [category]: trimmed });
}
