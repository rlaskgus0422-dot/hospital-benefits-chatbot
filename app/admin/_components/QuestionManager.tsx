"use client";

import { useEffect, useState } from "react";
import { CATEGORIES, getCategoryEmoji, type Category } from "@/app/_lib/categories";
import { CATEGORY_FAQS } from "@/app/_lib/faq";

type FaqAnswer = { category: Category; question: string; answer: string };

function keyOf(category: Category, question: string) {
  return `${category}|||${question}`;
}

export default function QuestionManager() {
  const [categories, setCategories] = useState<Category[]>([...CATEGORIES]);
  const [activeCategory, setActiveCategory] = useState<Category>(CATEGORIES[0]);
  const [questionsByCategory, setQuestionsByCategory] = useState<Record<Category, string[]>>(CATEGORY_FAQS);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  const [editQuestionValue, setEditQuestionValue] = useState("");
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<{ added: number; skipped: { row: number; reason: string }[] } | null>(
    null
  );
  // 서버 저장이 실패했는데도(예: Vercel의 읽기 전용 파일시스템) 화면에는 성공한 것처럼 보이는 걸 막기 위한 에러 배너.
  const [actionError, setActionError] = useState<string | null>(null);

  function loadQuestionsAndAnswers() {
    fetch("/api/admin/questions")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { questionsByCategory: Record<Category, string[]> } | null) => {
        if (data) setQuestionsByCategory(data.questionsByCategory);
      });

    fetch("/api/admin/faq-answers")
      .then((response) => (response.ok ? response.json() : { faqAnswers: [] }))
      .then((data: { faqAnswers: FaqAnswer[] }) => {
        const nextDrafts: Record<string, string> = {};
        const nextSaved = new Set<string>();
        data.faqAnswers.forEach((entry) => {
          const key = keyOf(entry.category, entry.question);
          nextDrafts[key] = entry.answer;
          nextSaved.add(key);
        });
        setDrafts(nextDrafts);
        setSavedKeys(nextSaved);
      });
  }

  useEffect(() => {
    // 관리자가 추가한 카테고리도 탭에 나오도록 최신 카테고리 순서를 불러온다.
    fetch("/api/admin/order")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { categoryOrder: Category[] } | null) => {
        if (data) setCategories(data.categoryOrder);
      });

    loadQuestionsAndAnswers();
  }, []);

  async function handleBulkUpload() {
    if (!bulkFile) return;
    setBulkUploading(true);
    setBulkError(null);
    setBulkResult(null);

    const formData = new FormData();
    formData.append("file", bulkFile);

    const response = await fetch("/api/admin/faq-answers/bulk", { method: "POST", body: formData });
    const data = await response.json().catch(() => null);
    setBulkUploading(false);
    setBulkFile(null);

    if (!response.ok) {
      setBulkError(data?.error ?? "업로드에 실패했어요.");
      return;
    }

    setBulkResult(data);
    loadQuestionsAndAnswers();
  }

  const activeQuestions = questionsByCategory[activeCategory] ?? [];

  async function saveQuestions(category: Category, questions: string[]) {
    const response = await fetch("/api/admin/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, questions }),
    });
    if (!response.ok) {
      setActionError("순서 저장에 실패했습니다. 새로고침 후 다시 시도해주세요.");
      loadQuestionsAndAnswers();
    }
  }

  function handleDrop(dropIndex: number) {
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      return;
    }
    const next = [...activeQuestions];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, moved);
    setQuestionsByCategory((prev) => ({ ...prev, [activeCategory]: next }));
    saveQuestions(activeCategory, next);
    setDragIndex(null);
  }

  async function handleAddQuestion() {
    const question = newQuestion.trim();
    if (!question) return;
    setNewQuestion("");

    const response = await fetch("/api/admin/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: activeCategory, addQuestion: question }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setActionError("질문 추가에 실패했습니다. 다시 시도해주세요.");
      return;
    }
    if (data?.questions) {
      setQuestionsByCategory((prev) => ({ ...prev, [activeCategory]: data.questions }));
    }
  }

  function startEditQuestion(question: string) {
    setEditingQuestion(question);
    setEditQuestionValue(question);
  }

  async function handleRenameQuestion(oldQuestion: string) {
    const newQuestion = editQuestionValue.trim();
    if (!newQuestion || newQuestion === oldQuestion) {
      setEditingQuestion(null);
      return;
    }

    const response = await fetch("/api/admin/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: activeCategory, renameQuestion: { oldQuestion, newQuestion } }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setActionError("질문 수정에 실패했습니다. 다시 시도해주세요.");
      setEditingQuestion(null);
      return;
    }
    if (data?.questions) {
      setQuestionsByCategory((prev) => ({ ...prev, [activeCategory]: data.questions }));

      const oldKey = keyOf(activeCategory, oldQuestion);
      const newKey = keyOf(activeCategory, newQuestion);
      setDrafts((prev) => {
        if (!(oldKey in prev)) return prev;
        const { [oldKey]: moved, ...rest } = prev;
        return { ...rest, [newKey]: moved };
      });
      setSavedKeys((prev) => {
        if (!prev.has(oldKey)) return prev;
        const next = new Set(prev);
        next.delete(oldKey);
        next.add(newKey);
        return next;
      });
    }
    setEditingQuestion(null);
  }

  async function handleDeleteQuestion(question: string) {
    const confirmed = window.confirm(`"${question}" 질문을 삭제할까요? 등록된 답변도 함께 삭제됩니다.`);
    if (!confirmed) return;

    const response = await fetch("/api/admin/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: activeCategory, deleteQuestion: question }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setActionError("질문 삭제에 실패했습니다. 다시 시도해주세요.");
      return;
    }
    if (data?.questions) {
      setQuestionsByCategory((prev) => ({ ...prev, [activeCategory]: data.questions }));
      const key = keyOf(activeCategory, question);
      setDrafts((prev) => {
        const rest = { ...prev };
        delete rest[key];
        return rest;
      });
      setSavedKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function handleSaveAnswer(question: string) {
    const key = keyOf(activeCategory, question);
    const answer = drafts[key] ?? "";
    setSavingKey(key);
    setActionError(null);

    const response = await fetch("/api/admin/faq-answers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: activeCategory, question, answer }),
    });

    setSavingKey(null);

    if (!response.ok) {
      setActionError("답변 저장에 실패했습니다. 새로고침 후 다시 시도해주세요.");
      return;
    }

    setSavedKeys((prev) => {
      const next = new Set(prev);
      if (answer.trim()) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">질문 관리</h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        카테고리를 고른 뒤 질문을 드래그로 재정렬하거나 새로 추가하세요. 답변을 입력해두면 이 질문을 클릭했을 때 규정
        문서 대신 이 답변이 바로 나가고, 비워두면 규정 문서를 근거로 답합니다.
      </p>

      {actionError && (
        <p className="mt-3 rounded-2xl bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {actionError}
        </p>
      )}

      <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">엑셀로 한 번에 업로드</p>
          <a
            href="/api/admin/faq-answers/template"
            className="shrink-0 rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus-visible:ring-offset-zinc-900"
          >
            양식 다운로드
          </a>
        </div>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          양식을 받으면 카테고리 열은 이미 채워져 있고, 빈 행도 카테고리를 드롭다운에서만 고를 수 있게 되어 있어요.
          질문과 답변 칸만 채워서 .xlsx 파일 그대로 올리세요. 필요 없는 행은 비워두면 자동으로 건너뛰고, 목록에 없는
          카테고리 이름이 적혀 있으면 그 행만 제외됩니다. (카테고리를 추가·수정하면 양식을 다시 받아야 반영돼요.)
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept=".xlsx"
            onChange={(event) => setBulkFile(event.target.files?.[0] ?? null)}
            className="flex-1 text-xs text-zinc-600 file:mr-2 file:rounded-full file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-zinc-700 dark:text-zinc-300 dark:file:bg-zinc-800 dark:file:text-zinc-200"
          />
          <button
            type="button"
            onClick={handleBulkUpload}
            disabled={!bulkFile || bulkUploading}
            className="rounded-full bg-brand px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-brand-dark active:scale-95 disabled:opacity-40 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
          >
            {bulkUploading ? "업로드 중..." : "업로드"}
          </button>
        </div>
        {bulkError && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{bulkError}</p>}
        {bulkResult && (
          <div className="mt-2 text-xs">
            <p className="text-emerald-700 dark:text-emerald-300">{bulkResult.added}건 등록되었습니다.</p>
            {bulkResult.skipped.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-zinc-500 dark:text-zinc-400">
                {bulkResult.skipped.map((entry) => (
                  <li key={entry.row}>
                    {entry.row}행 건너뜀 — {entry.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setActiveCategory(category)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 ${
              activeCategory === category
                ? "bg-brand text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-brand-light hover:text-brand dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            <span aria-hidden="true">{getCategoryEmoji(category)}</span> {category}
          </button>
        ))}
      </div>

      <ul className="mt-4 space-y-3">
        {activeQuestions.map((question, index) => {
          const key = keyOf(activeCategory, question);
          return (
            <li
              key={question}
              draggable={editingQuestion !== question}
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleDrop(index)}
              onDragEnd={() => setDragIndex(null)}
              className={`cursor-grab rounded-2xl border border-zinc-100 p-3 active:cursor-grabbing dark:border-zinc-800 ${
                dragIndex === index ? "opacity-40" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-600">
                  ⠿
                </span>
                {editingQuestion === question ? (
                  <div className="flex flex-1 items-center gap-1.5">
                    <input
                      value={editQuestionValue}
                      onChange={(event) => setEditQuestionValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleRenameQuestion(question);
                        }
                      }}
                      autoFocus
                      className="flex-1 rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm outline-none focus:border-brand dark:border-zinc-700 dark:bg-zinc-800"
                    />
                    <button
                      type="button"
                      onClick={() => handleRenameQuestion(question)}
                      className="rounded-full bg-brand px-3 py-1 text-xs font-medium text-white transition hover:bg-brand-dark active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                    >
                      저장
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingQuestion(null)}
                      className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 transition hover:bg-zinc-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus-visible:ring-offset-zinc-900"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="flex-1 text-sm text-zinc-800 dark:text-zinc-200">{question}</p>
                    {savedKeys.has(key) && (
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                        답변 등록됨
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => startEditQuestion(question)}
                      className="shrink-0 rounded-full border border-zinc-200 px-2 py-0.5 text-xs text-zinc-600 transition hover:bg-zinc-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus-visible:ring-offset-zinc-900"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteQuestion(question)}
                      className="shrink-0 rounded-full border border-zinc-200 px-2 py-0.5 text-xs text-red-600 transition hover:bg-red-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:border-zinc-700 dark:text-red-400 dark:hover:bg-red-500/10 dark:focus-visible:ring-offset-zinc-900"
                    >
                      삭제
                    </button>
                  </>
                )}
              </div>
              <textarea
                value={drafts[key] ?? ""}
                onChange={(event) => setDrafts((prev) => ({ ...prev, [key]: event.target.value }))}
                placeholder="답변을 입력해두면 이 질문 클릭 시 바로 노출됩니다."
                rows={2}
                className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-2 text-sm outline-none focus:border-brand focus:bg-white dark:border-zinc-700 dark:bg-zinc-800"
              />
              <button
                type="button"
                onClick={() => handleSaveAnswer(question)}
                disabled={savingKey === key}
                className="mt-2 rounded-full bg-brand px-3 py-1 text-xs font-medium text-white transition hover:bg-brand-dark active:scale-95 disabled:opacity-40 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
              >
                저장
              </button>
            </li>
          );
        })}
        {activeQuestions.length === 0 && <li className="text-sm text-zinc-400">등록된 질문이 없습니다.</li>}
      </ul>

      <div className="mt-4 flex gap-2">
        <input
          value={newQuestion}
          onChange={(event) => setNewQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleAddQuestion();
            }
          }}
          placeholder="새 질문을 입력하세요"
          className="flex-1 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-1.5 text-sm outline-none focus:border-brand focus:bg-white dark:border-zinc-700 dark:bg-zinc-800"
        />
        <button
          type="button"
          onClick={handleAddQuestion}
          disabled={!newQuestion.trim()}
          className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white transition hover:bg-brand-dark active:scale-95 disabled:opacity-40 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
        >
          + 추가
        </button>
      </div>
    </section>
  );
}
