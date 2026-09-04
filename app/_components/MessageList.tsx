"use client";

import { useEffect, useRef } from "react";

export type Message =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "bot"; text: string; logId?: string; feedback?: "helpful" | "unhelpful" | null }
  | { id: number; role: "suggestions"; questions: string[] };

type Props = {
  messages: Message[];
  isLoading: boolean;
  onSuggestionClick: (question: string) => void;
  onFeedback: (messageId: number, logId: string, feedback: "helpful" | "unhelpful") => void;
};

export default function MessageList({ messages, isLoading, onSuggestionClick, onFeedback }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 space-y-3 overflow-y-auto bg-zinc-50/60 p-4 dark:bg-zinc-950/40">
      {messages.map((message) => {
        if (message.role === "suggestions") {
          return (
            <div key={message.id} className="flex flex-col items-start gap-1.5">
              {message.questions.map((question) => (
                <button
                  key={question}
                  type="button"
                  disabled={isLoading}
                  onClick={() => onSuggestionClick(question)}
                  className="max-w-[80%] rounded-2xl border border-brand/20 bg-brand-light px-4 py-2 text-left text-sm text-brand shadow-sm transition hover:bg-brand/20 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:border-brand/30 dark:bg-brand/10 dark:text-blue-300 dark:hover:bg-brand/20 dark:focus-visible:ring-offset-zinc-900"
                >
                  {question}
                </button>
              ))}
            </div>
          );
        }

        return (
          <div key={message.id} className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}>
            <p
              className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-sm ${
                message.role === "user"
                  ? "bg-brand text-white"
                  : "border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              }`}
            >
              {message.text}
            </p>
            {message.role === "bot" && message.logId && (
              <div className="mt-1 flex items-center gap-1 pl-1">
                {message.feedback ? (
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {message.feedback === "helpful" ? "피드백 감사합니다 👍" : "피드백 감사합니다. 더 나아지도록 반영할게요 🙏"}
                  </span>
                ) : (
                  <>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">도움이 됐나요?</span>
                    <button
                      type="button"
                      onClick={() => onFeedback(message.id, message.logId!, "helpful")}
                      aria-label="도움이 됐어요"
                      className="rounded-full p-1 text-sm transition hover:bg-zinc-200 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand dark:hover:bg-zinc-700"
                    >
                      👍
                    </button>
                    <button
                      type="button"
                      onClick={() => onFeedback(message.id, message.logId!, "unhelpful")}
                      aria-label="도움이 안됐어요"
                      className="rounded-full p-1 text-sm transition hover:bg-zinc-200 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand dark:hover:bg-zinc-700"
                    >
                      👎
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
      {isLoading && (
        <div className="flex justify-start">
          <p className="max-w-[80%] rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-400 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
            답변 작성 중...
          </p>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
