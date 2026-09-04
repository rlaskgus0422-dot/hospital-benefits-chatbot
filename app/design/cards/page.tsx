import Image from "next/image";
import Link from "next/link";
import ChatBotCards from "@/app/_components/ChatBotCards";
import type { Category } from "@/app/_lib/categories";
import { getCategoryOrder, getCategoryQuestions } from "@/app/_lib/store";

// 관리자가 카테고리/순서를 바꾸면 바로 반영되도록 매 요청마다 새로 렌더링한다.
export const dynamic = "force-dynamic";

export default async function DesignCardsPage() {
  const categoryOrder = await getCategoryOrder();
  const questionsByCategory = Object.fromEntries(
    await Promise.all(categoryOrder.map(async (category) => [category, await getCategoryQuestions(category)] as const))
  ) as Record<Category, string[]>;

  return (
    <div className="flex flex-1 flex-col items-center gap-6 bg-gradient-to-b from-amber-50 via-rose-50 to-white px-4 py-10 dark:from-zinc-950 dark:via-black dark:to-black">
      <div className="w-full max-w-3xl text-center">
        <Image
          src="/logo.png"
          alt="한양대학교병원"
          width={280}
          height={75}
          className="mx-auto h-auto w-72 dark:brightness-0 dark:invert"
          priority
        />
        <h1 className="mt-3 text-2xl font-semibold text-brand dark:text-blue-300">궁금한 게 뭔가요?</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">카드를 눌러 카테고리를 고르면 바로 대화가 시작돼요.</p>
      </div>
      <ChatBotCards categories={categoryOrder} questionsByCategory={questionsByCategory} />
      <Link
        href="/design"
        className="text-xs text-zinc-400 underline-offset-2 hover:text-brand hover:underline dark:text-zinc-500"
      >
        ← 디자인 목록으로
      </Link>
    </div>
  );
}
