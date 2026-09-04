"use client";

import { useEffect, useRef, type ChangeEvent, type FormEvent } from "react";

type Props = {
  value: string;
  isLoading: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export default function ChatInput({ value, isLoading, onChange, onSubmit }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  // 답변이 끝나면 바로 이어서 입력할 수 있도록 입력창에 자동으로 초점을 되돌려준다.
  useEffect(() => {
    if (!isLoading) inputRef.current?.focus();
  }, [isLoading]);

  return (
    <form onSubmit={onSubmit} className="flex gap-2 border-t border-zinc-100 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <input
        ref={inputRef}
        value={value}
        onChange={onChange}
        disabled={isLoading}
        autoFocus
        placeholder="내용을 입력해주세요."
        className="flex-1 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm outline-none transition placeholder:text-zinc-400 focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:placeholder:text-zinc-500 dark:focus:bg-zinc-800"
      />
      <button
        type="submit"
        disabled={isLoading || !value.trim()}
        className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-dark active:scale-95 disabled:opacity-40 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
      >
        전송
      </button>
    </form>
  );
}
