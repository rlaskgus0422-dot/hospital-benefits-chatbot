"use client";

import { useChatBot } from "./useChatBot";
import { getCategoryEmoji, type Category } from "../_lib/categories";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";

type Props = {
  categories: Category[];
  questionsByCategory: Record<Category, string[]>;
};

// 카드형 — 카테고리를 큼직한 카드 그리드로 먼저 보여주고, 고르면 대화 화면으로 전환하는 구성.
export default function ChatBotCards({ categories, questionsByCategory }: Props) {
  const chat = useChatBot({ categories, questionsByCategory });

  if (!chat.selectedCategory) {
    return (
      <div className="grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => chat.handleCategorySelect(category)}
            className="flex flex-col items-center gap-2 rounded-3xl border border-zinc-200 bg-white p-5 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-light text-2xl dark:bg-brand/10">
              {getCategoryEmoji(category)}
            </span>
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{category}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl shadow-zinc-200/50 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 p-4 dark:border-zinc-800">
        <button
          type="button"
          onClick={chat.handleCategoryClear}
          className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          ← 전체 카테고리
        </button>
        <span className="rounded-full bg-brand px-3.5 py-1.5 text-sm font-medium text-white">
          {getCategoryEmoji(chat.selectedCategory)} {chat.selectedCategory}
        </span>
        {chat.recentCategories
          .filter((category) => category !== chat.selectedCategory)
          .map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => chat.handleCategorySelect(category)}
              className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs text-zinc-600 transition-colors hover:bg-brand-light hover:text-brand dark:bg-zinc-800 dark:text-zinc-300"
            >
              {getCategoryEmoji(category)} {category}
            </button>
          ))}
      </div>
      <MessageList
        messages={chat.messages}
        isLoading={chat.isLoading}
        onSuggestionClick={chat.submitQuestion}
        onFeedback={chat.handleFeedback}
      />
      <ChatInput value={chat.input} isLoading={chat.isLoading} onChange={chat.handleInputChange} onSubmit={chat.handleSubmit} />
    </div>
  );
}
