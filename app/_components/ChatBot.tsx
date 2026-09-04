"use client";

import CategoryPicker from "./CategoryPicker";
import ChatInput from "./ChatInput";
import MessageList from "./MessageList";
import { useChatBot } from "./useChatBot";
import type { Category } from "../_lib/categories";

type Props = {
  categories: Category[];
  questionsByCategory: Record<Category, string[]>;
};

export default function ChatBot({ categories, questionsByCategory }: Props) {
  const chat = useChatBot({ categories, questionsByCategory });

  return (
    <div className="flex w-full max-w-2xl flex-1 flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl shadow-zinc-200/50 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
      <CategoryPicker
        categories={chat.categories}
        selected={chat.selectedCategory}
        recent={chat.recentCategories}
        onSelect={chat.handleCategorySelect}
        onClear={chat.handleCategoryClear}
      />
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
