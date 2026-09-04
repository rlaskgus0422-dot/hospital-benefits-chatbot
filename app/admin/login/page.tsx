"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      setError("비밀번호가 올바르지 않습니다.");
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-b from-brand-light via-zinc-50 to-zinc-50 px-4 dark:from-zinc-950 dark:via-black dark:to-black">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xs rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none"
      >
        <Image src="/logo.png" alt="한양대학교병원" width={192} height={52} className="mx-auto mb-4 h-auto w-48 dark:brightness-0 dark:invert" />
        <h1 className="text-center text-lg font-semibold text-zinc-900 dark:text-zinc-50">관리자 로그인</h1>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="비밀번호"
          autoFocus
          className="mt-4 w-full rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15 dark:border-zinc-700 dark:bg-zinc-800"
        />
        {error && <p className="mt-2 text-center text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting || !password}
          className="mt-4 w-full rounded-full bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
        >
          로그인
        </button>
        <Link
          href="/"
          className="mt-3 block text-center text-xs text-zinc-400 underline-offset-2 hover:text-brand hover:underline dark:text-zinc-500"
        >
          ← 챗봇으로 돌아가기
        </Link>
      </form>
    </div>
  );
}
