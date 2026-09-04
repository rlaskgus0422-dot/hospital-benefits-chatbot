import Image from "next/image";
import Link from "next/link";
import ChatBotSidebar from "./_components/ChatBotSidebar";
import type { Category } from "./_lib/categories";
import { getCategoryOrder, getCategoryQuestions } from "./_lib/store";

// 관리자가 순서를 바꾸면 재배포 없이 바로 반영되도록 매 요청마다 새로 렌더링한다.
export const dynamic = "force-dynamic";

// 기본 화면을 사이드바형으로 채택 (PC/모바일 둘 다에서 카드형·기존형보다 쓰기 편하다고 판단해 결정).
export default async function Home() {
  const categoryOrder = await getCategoryOrder();
  // 관리자가 새로 추가한 카테고리도 빠짐없이 포함되도록 정적 CATEGORIES가 아닌 동적 목록을 기준으로 순회한다.
  const questionsByCategory = Object.fromEntries(
    await Promise.all(categoryOrder.map(async (category) => [category, await getCategoryQuestions(category)] as const))
  ) as Record<Category, string[]>;

  return (
    <div className="flex flex-1 flex-col items-center gap-6 bg-gradient-to-b from-brand-light via-zinc-50 to-zinc-50 px-4 py-10 dark:from-zinc-950 dark:via-black dark:to-black">
      <div className="w-full max-w-4xl text-center">
        <Image src="/logo.png" alt="한양대학교병원" width={280} height={75} className="mx-auto h-auto w-72 dark:brightness-0 dark:invert" priority />
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-brand dark:text-blue-300">인사팀/총무팀 챗봇</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">궁금한 카테고리를 눌러 질문해보세요.</p>
      </div>
      <ChatBotSidebar categories={categoryOrder} questionsByCategory={questionsByCategory} />
      <Link href="/admin" className="text-xs text-zinc-400 underline-offset-2 hover:text-brand hover:underline dark:text-zinc-500">
        관리자 페이지
      </Link>
    </div>
  );
}
