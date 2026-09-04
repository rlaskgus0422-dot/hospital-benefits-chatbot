"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DocumentManager from "./_components/DocumentManager";
import QuestionManager from "./_components/QuestionManager";
import OrderManager from "./_components/OrderManager";
import ContactMessageManager from "./_components/ContactMessageManager";
import ChatLogManager from "./_components/ChatLogManager";

const TABS = [
  { key: "categories", label: "카테고리·문서" },
  { key: "questions", label: "질문·FAQ" },
  { key: "contact", label: "담당자 안내" },
  { key: "logs", label: "로그" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("categories");

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-4 bg-zinc-50 px-4 py-10 dark:bg-black">
      <div className="flex w-full max-w-2xl items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">관리자 대시보드</h1>
          <Link href="/" className="text-xs text-zinc-400 underline-offset-2 hover:text-brand hover:underline dark:text-zinc-500">
            ← 챗봇으로 돌아가기
          </Link>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus-visible:ring-offset-zinc-900"
        >
          로그아웃
        </button>
      </div>

      <div className="flex w-full max-w-2xl gap-1.5 overflow-x-auto rounded-full bg-zinc-100 p-1 dark:bg-zinc-900">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 ${
              activeTab === tab.key
                ? "bg-white text-brand shadow-sm dark:bg-zinc-800 dark:text-blue-300"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="w-full max-w-2xl space-y-4">
        {activeTab === "categories" && (
          <>
            <OrderManager />
            <DocumentManager />
          </>
        )}
        {activeTab === "questions" && <QuestionManager />}
        {activeTab === "contact" && <ContactMessageManager />}
        {activeTab === "logs" && <ChatLogManager />}
      </div>
    </div>
  );
}
