"use client";

import { useChatBot } from "./useChatBot";
import { getCategoryEmoji, type Category } from "../_lib/categories";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";

type Props = {
  categories: Category[];
  questionsByCategory: Record<Category, string[]>;
};

// 사이드바형 — 데스크톱에서는 카테고리를 왼쪽 목록으로, 대화창을 오른쪽에 넓게 쓴다.
// 화면이 좁으면(휴대폰) 사이드바가 위쪽 가로 스크롤 바로 바뀐다.
export default function ChatBotSidebar({ categories, questionsByCategory }: Props) {
  const chat = useChatBot({ categories, questionsByCategory });

  function handleNavClick(category: Category) {
    if (chat.selectedCategory === category) chat.handleCategoryClear();
    else chat.handleCategorySelect(category);
  }

  return (
    <div className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl shadow-zinc-200/50 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none md:h-[640px] md:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-zinc-100 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-950/40 md:w-60 md:border-b-0 md:border-r">
        <div className="px-4 pb-1.5 pt-3 md:pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">카테고리</p>
        </div>
        <nav className="flex gap-1.5 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:gap-0.5 md:space-y-0.5 md:overflow-x-hidden md:overflow-y-auto md:px-2 md:pb-2">
          {categories.map((category) => {
            const active = chat.selectedCategory === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => handleNavClick(category)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 md:w-full ${
                  active
                    ? "bg-brand text-white shadow-sm"
                    : "bg-white text-zinc-600 hover:bg-white hover:text-brand dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 md:bg-transparent dark:md:bg-transparent"
                }`}
              >
                <span aria-hidden="true">{getCategoryEmoji(category)}</span>
                <span className="whitespace-nowrap md:truncate">{category}</span>
              </button>
            );
          })}
        </nav>
        {chat.recentCategories.length > 0 && (
          <div className="hidden border-t border-zinc-100 px-4 py-3 dark:border-zinc-800 md:block">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">최근</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {chat.recentCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => chat.handleCategorySelect(category)}
                  aria-label={category}
                  className="rounded-full bg-white px-2 py-1 text-xs shadow-sm transition active:scale-[0.97] hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:bg-zinc-800 dark:text-zinc-300 dark:focus-visible:ring-offset-zinc-900"
                >
                  {getCategoryEmoji(category)}
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {chat.selectedCategory ? `${getCategoryEmoji(chat.selectedCategory)} ${chat.selectedCategory}` : "전체 문의"}
          </p>
          {chat.selectedCategory && (
            <button
              type="button"
              onClick={chat.handleCategoryClear}
              className="text-xs text-zinc-400 hover:text-brand dark:text-zinc-500"
            >
              선택 해제
            </button>
          )}
        </header>
        <MessageList
          messages={chat.messages}
          isLoading={chat.isLoading}
          onSuggestionClick={chat.submitQuestion}
          onFeedback={chat.handleFeedback}
        />
        <ChatInput value={chat.input} isLoading={chat.isLoading} onChange={chat.handleInputChange} onSubmit={chat.handleSubmit} />
      </div>
    </div>
  );
}
