"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { Category } from "../_lib/categories";
import type { Message } from "./MessageList";

// 카테고리를 선택하지 않았을 때(자유 질문)의 탭 키.
const GENERAL_TAB = "일반";
const MAX_RECENT_CATEGORIES = 5;
type TabKey = Category | typeof GENERAL_TAB;

const INITIAL_MESSAGE: Message = {
  id: 0,
  role: "bot",
  text: "안녕하세요! 궁금한 카테고리를 눌러 질문해주세요.",
};

type Params = {
  categories: Category[];
  questionsByCategory: Record<Category, string[]>;
};

// 챗봇 화면 로직(대화 상태·카테고리 선택·전송)을 모아둔 훅.
// 화면 배치(디자인)만 다른 여러 컴포넌트가 이 훅 하나를 함께 쓴다.
export function useChatBot({ categories, questionsByCategory }: Params) {
  const [historyByTab, setHistoryByTab] = useState<Partial<Record<TabKey, Message[]>>>({
    [GENERAL_TAB]: [INITIAL_MESSAGE],
  });
  const [input, setInput] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [recentCategories, setRecentCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const nextIdRef = useRef(1);

  const activeTab: TabKey = selectedCategory ?? GENERAL_TAB;
  const messages = historyByTab[activeTab] ?? [];

  function appendToTab(tab: TabKey, message: Message) {
    setHistoryByTab((prev) => ({ ...prev, [tab]: [...(prev[tab] ?? []), message] }));
  }

  // 직전 대화 몇 턴을 함께 보내 "그럼 언제 받아요?" 같은 이어지는 질문도 맥락을 잡을 수 있게 한다.
  const MAX_HISTORY_TURNS = 3;

  function recentHistory(tab: TabKey) {
    return (historyByTab[tab] ?? [])
      .filter((message): message is Extract<Message, { role: "user" | "bot" }> => message.role === "user" || message.role === "bot")
      .slice(-MAX_HISTORY_TURNS * 2)
      .map((message) => ({ role: message.role, text: message.text }));
  }

  async function submitQuestion(question: string) {
    if (!question || isLoading) return;

    const askedTab = activeTab;
    const category = selectedCategory;
    const history = recentHistory(askedTab);
    const userMessageId = nextIdRef.current++;

    appendToTab(askedTab, { id: userMessageId, role: "user", text: question });
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, category, history }),
      });
      const data = await response.json();
      const answer = response.ok ? data.answer : "일시적인 오류입니다. 총무팀(02-2290-9024)으로 문의해주세요.";

      // 서버가 실제 주제를 다른 카테고리로 판단했으면(예: "증명서" 탭에서 화환 질문), 대화를 그 탭으로 옮긴다 —
      // 답만 맞고 화면은 엉뚱한 탭에 그대로 있으면 사용자가 왜 이 답이 나왔는지 헷갈릴 수 있다.
      const matchedCategory: string | null = response.ok && typeof data.matchedCategory === "string" ? data.matchedCategory : null;
      const isRealCategory = (value: string): value is Category => (categories as string[]).includes(value);
      const targetTab: TabKey =
        matchedCategory && isRealCategory(matchedCategory) && matchedCategory !== askedTab ? matchedCategory : askedTab;

      if (targetTab !== askedTab) {
        // 방금 올린 질문을 원래 탭에서 지우고 새 탭으로 옮겨서, 그 탭만 봐도 질문-답변이 자연스럽게 이어지게 한다.
        setHistoryByTab((prev) => ({ ...prev, [askedTab]: (prev[askedTab] ?? []).filter((m) => m.id !== userMessageId) }));
        appendToTab(targetTab, { id: userMessageId, role: "user", text: question });
        setSelectedCategory(targetTab as Category);
        setRecentCategories((prev) => [targetTab as Category, ...prev.filter((c) => c !== targetTab)].slice(0, MAX_RECENT_CATEGORIES));
      }

      appendToTab(targetTab, {
        id: nextIdRef.current++,
        role: "bot",
        text: answer,
        logId: response.ok ? data.logId : undefined,
        feedback: null,
      });
    } catch {
      appendToTab(askedTab, {
        id: nextIdRef.current++,
        role: "bot",
        text: "일시적인 오류입니다. 총무팀(02-2290-9024)으로 문의해주세요.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleFeedback(messageId: number, logId: string, feedback: "helpful" | "unhelpful") {
    const tab = activeTab;
    // 먼저 화면에 반영해서 바로 눌린 걸 보여주고, 저장에 실패해도 사용자 경험상 되돌리지 않는다(재전송 유도 방지).
    setHistoryByTab((prev) => ({
      ...prev,
      [tab]: (prev[tab] ?? []).map((message) =>
        message.id === messageId && message.role === "bot" ? { ...message, feedback } : message
      ),
    }));

    await fetch("/api/chat/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logId, feedback }),
    }).catch(() => {});
  }

  function handleCategorySelect(category: Category) {
    setSelectedCategory(category);
    // 최근 선택한 카테고리 목록 맨 앞에 올리고, 중복은 제거하고 최대 개수만 남긴다.
    setRecentCategories((prev) => [category, ...prev.filter((c) => c !== category)].slice(0, MAX_RECENT_CATEGORIES));

    // 처음 방문하는 탭이면 자주 묻는 질문을 버튼 형태로 보여준다. 이미 방문한 탭이면 기존 내용을 그대로 둔다.
    setHistoryByTab((prev) => {
      if (prev[category]) return prev;
      return {
        ...prev,
        [category]: [{ id: nextIdRef.current++, role: "suggestions", questions: questionsByCategory[category] ?? [] }],
      };
    });
  }

  function handleCategoryClear() {
    setSelectedCategory(null);
    setInput("");
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    setInput(event.target.value);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitQuestion(input.trim());
  }

  return {
    categories,
    messages,
    input,
    selectedCategory,
    recentCategories,
    isLoading,
    submitQuestion,
    handleFeedback,
    handleCategorySelect,
    handleCategoryClear,
    handleInputChange,
    handleSubmit,
  };
}
