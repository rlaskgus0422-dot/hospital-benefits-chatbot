"use client";

import { getCategoryEmoji, type Category } from "../_lib/categories";

type Props = {
  categories: Category[];
  selected: Category | null;
  recent: Category[];
  onSelect: (category: Category) => void;
  onClear: () => void;
};

export default function CategoryPicker({ categories, selected, recent, onSelect, onClear }: Props) {
  function handleClick(category: Category) {
    // 이미 선택된 카테고리를 다시 누르면 선택을 해제한다.
    if (selected === category) onClear();
    else onSelect(category);
  }

  return (
    <div className="border-b border-zinc-100 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => handleClick(category)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              selected === category
                ? "bg-brand text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-brand-light hover:text-brand dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            <span aria-hidden="true">{getCategoryEmoji(category)}</span> {category}
          </button>
        ))}
      </div>

      {recent.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-zinc-400 dark:text-zinc-500">최근:</span>
          {recent.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => onSelect(category)}
              className="rounded-full bg-brand-light px-2.5 py-1 text-xs font-medium text-brand transition-colors hover:bg-brand/20 dark:bg-brand/10 dark:text-blue-300 dark:hover:bg-brand/20"
            >
              <span aria-hidden="true">{getCategoryEmoji(category)}</span> {category}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
