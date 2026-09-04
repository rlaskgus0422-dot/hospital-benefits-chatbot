"use client";

import { useEffect, useState } from "react";
import { CATEGORIES, getCategoryEmoji, type Category } from "@/app/_lib/categories";

const DEFAULT_MESSAGE = "답을 찾지 못했어요. 총무팀(02-2290-9024)으로 문의해주세요.";

export default function ContactMessageManager() {
  const [categories, setCategories] = useState<Category[]>([...CATEGORIES]);
  const [activeCategory, setActiveCategory] = useState<Category>(CATEGORIES[0]);
  const [messages, setMessages] = useState<Partial<Record<Category, string>>>({});
  const [drafts, setDrafts] = useState<Partial<Record<Category, string>>>({});
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    fetch("/api/admin/order")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { categoryOrder: Category[] } | null) => {
        if (data) setCategories(data.categoryOrder);
      });

    fetch("/api/admin/contact-messages")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { contactMessages: Partial<Record<Category, string>> } | null) => {
        if (data) setMessages(data.contactMessages);
      });
  }, []);

  const draft = drafts[activeCategory] ?? messages[activeCategory] ?? "";

  async function handleSave() {
    setSaving(true);
    await fetch("/api/admin/contact-messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: activeCategory, message: draft }),
    });
    setSaving(false);

    setMessages((prev) => {
      const next = { ...prev };
      if (draft.trim()) next[activeCategory] = draft.trim();
      else delete next[activeCategory];
      return next;
    });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">카테고리별 담당자 안내 문구</h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        답을 찾지 못했을 때 나갈 안내 문구를 카테고리마다 다르게 등록할 수 있어요. 비워두면 공통 기본 문구(&quot;
        {DEFAULT_MESSAGE}&quot;)가 나갑니다. 점(•)이 붙은 카테고리는 이미 문구가 등록돼 있어요.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setActiveCategory(category)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 ${
              activeCategory === category
                ? "bg-brand text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-brand-light hover:text-brand dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            <span aria-hidden="true">{getCategoryEmoji(category)}</span> {category}
            {messages[category] && <span aria-hidden="true"> •</span>}
          </button>
        ))}
      </div>

      <textarea
        value={draft}
        onChange={(event) => setDrafts((prev) => ({ ...prev, [activeCategory]: event.target.value }))}
        placeholder={DEFAULT_MESSAGE}
        rows={3}
        className="mt-3 w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-sm outline-none focus:border-brand focus:bg-white dark:border-zinc-700 dark:bg-zinc-800"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-brand px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-brand-dark active:scale-95 disabled:opacity-40 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
        {savedFlash && <span className="text-xs text-emerald-600 dark:text-emerald-400">저장됐어요</span>}
      </div>
    </section>
  );
}
