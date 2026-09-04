import Link from "next/link";

const VARIANTS = [
  { href: "/design/sidebar", title: "사이드바형", description: "왼쪽에 카테고리 목록, 오른쪽에 넓은 대화창." },
  { href: "/design/cards", title: "카드형", description: "카테고리를 큼직한 카드로 먼저 보여주고 고르면 대화 시작." },
];

export default function DesignIndexPage() {
  return (
    <div className="flex flex-1 flex-col items-center gap-6 bg-zinc-50 px-4 py-10 dark:bg-black">
      <div className="w-full max-w-md text-center">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">디자인 시안 모음</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          기존 화면은 그대로 두고, 새로 만든 화면들을 여기서 둘러볼 수 있어요.
        </p>
      </div>

      <div className="w-full max-w-md space-y-3">
        {VARIANTS.map((variant) => (
          <Link
            key={variant.href}
            href={variant.href}
            className="block rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm transition-colors hover:border-brand hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{variant.title}</p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{variant.description}</p>
          </Link>
        ))}
      </div>

      <Link href="/" className="text-xs text-zinc-400 underline-offset-2 hover:text-brand hover:underline dark:text-zinc-500">
        ← 기존 화면으로
      </Link>
    </div>
  );
}
