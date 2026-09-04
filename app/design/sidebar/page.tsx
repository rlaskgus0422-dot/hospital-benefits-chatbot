import Image from "next/image";
import Link from "next/link";
import ChatBotSidebar from "@/app/_components/ChatBotSidebar";
import type { Category } from "@/app/_lib/categories";
import { getCategoryOrder, getCategoryQuestions } from "@/app/_lib/store";

// 관리자가 카테고리/순서를 바꾸면 바로 반영되도록 매 요청마다 새로 렌더링한다.
export const dynamic = "force-dynamic";

export default function DesignSidebarPage() {
  const categoryOrder = getCategoryOrder();
  const questionsByCategory = Object.fromEntries(
    categoryOrder.map((category) => [category, getCategoryQuestions(category)])
  ) as Record<Category, string[]>;

  return (
    <div className="flex flex-1 flex-col items-center gap-6 bg-zinc-100 px-4 py-10 dark:bg-zinc-950">
      <div className="w-full max-w-4xl text-center">
        <Image
          src="/logo.png"
          alt="한양대학교병원"
          width={280}
          height={75}
          className="mx-auto h-auto w-72 dark:brightness-0 dark:invert"
          priority
        />
        <h1 className="mt-3 text-xl font-semibold text-zinc-800 dark:text-zinc-100">인사팀/총무팀 챗봇</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">카테고리를 고르고 대화하세요.</p>
      </div>
      <ChatBotSidebar categories={categoryOrder} questionsByCategory={questionsByCategory} />
      <div className="flex items-center gap-3">
        <Link
          href="/design"
          className="text-xs text-zinc-400 underline-offset-2 hover:text-brand hover:underline dark:text-zinc-500"
        >
          ← 디자인 목록으로
        </Link>
        <span className="text-zinc-300 dark:text-zinc-700">|</span>
        <Link
          href="/admin"
          className="text-xs text-zinc-400 underline-offset-2 hover:text-brand hover:underline dark:text-zinc-500"
        >
          관리자 페이지
        </Link>
      </div>
    </div>
  );
}
