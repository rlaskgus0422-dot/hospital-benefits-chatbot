"use client";

import { useEffect, useState } from "react";
import { CATEGORIES, getCategoryEmoji, type Category } from "@/app/_lib/categories";

export default function OrderManager() {
  const [categoryOrder, setCategoryOrder] = useState<Category[]>([...CATEGORIES]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState("");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editValue, setEditValue] = useState("");

  function loadOrder() {
    fetch("/api/admin/order")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { categoryOrder: Category[] } | null) => {
        if (data) setCategoryOrder(data.categoryOrder);
      });
  }

  useEffect(loadOrder, []);

  function saveCategoryOrder(order: Category[]) {
    fetch("/api/admin/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryOrder: order }),
    });
  }

  function handleDrop(dropIndex: number) {
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      return;
    }
    const next = [...categoryOrder];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, moved);
    setCategoryOrder(next);
    saveCategoryOrder(next);
    setDragIndex(null);
  }

  async function handleAddCategory() {
    const name = newCategory.trim();
    if (!name) return;
    setError("");

    const response = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data.error ?? "카테고리 추가에 실패했어요.");
      return;
    }

    setNewCategory("");
    loadOrder(); // 새 카테고리가 순서 맨 뒤에 붙은 최신 목록을 다시 불러온다.
  }

  function startEdit(category: Category) {
    setEditingCategory(category);
    setEditValue(category);
    setError("");
  }

  async function handleRename(category: Category) {
    const name = editValue.trim();
    if (!name || name === category) {
      setEditingCategory(null);
      return;
    }

    const response = await fetch(`/api/admin/categories/${encodeURIComponent(category)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data.error ?? "이름 변경에 실패했어요.");
      return;
    }

    setEditingCategory(null);
    loadOrder();
  }

  async function handleDeleteCategory(category: Category) {
    const confirmed = window.confirm(
      `"${category}" 카테고리를 삭제할까요? 등록된 규정 문서·질문·답변이 모두 함께 삭제됩니다.`
    );
    if (!confirmed) return;

    await fetch(`/api/admin/categories/${encodeURIComponent(category)}`, { method: "DELETE" });
    loadOrder();
  }

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">카테고리 순서 관리</h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        드래그로 순서를 바꾸면 이용자 화면의 카테고리 버튼 순서에 바로 반영됩니다.
      </p>

      <ul className="mt-4 space-y-1.5">
        {categoryOrder.map((category, index) => (
          <li
            key={category}
            draggable={editingCategory !== category}
            onDragStart={() => setDragIndex(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => handleDrop(index)}
            onDragEnd={() => setDragIndex(null)}
            className={`flex cursor-grab items-center gap-2 rounded-2xl border border-zinc-100 px-3 py-1.5 text-sm active:cursor-grabbing dark:border-zinc-800 ${
              dragIndex === index ? "opacity-40" : ""
            }`}
          >
            <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-600">
              ⠿
            </span>

            {editingCategory === category ? (
              <div className="flex flex-1 items-center gap-1.5">
                <input
                  value={editValue}
                  onChange={(event) => setEditValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleRename(category);
                    }
                  }}
                  autoFocus
                  className="flex-1 rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm outline-none focus:border-brand dark:border-zinc-700 dark:bg-zinc-800"
                />
                <button
                  type="button"
                  onClick={() => handleRename(category)}
                  className="rounded-full bg-brand px-3 py-1 text-xs font-medium text-white transition hover:bg-brand-dark active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                >
                  저장
                </button>
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 transition hover:bg-zinc-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus-visible:ring-offset-zinc-900"
                >
                  취소
                </button>
              </div>
            ) : (
              <>
                <span className="flex-1">
                  {getCategoryEmoji(category)} {category}
                </span>
                <button
                  type="button"
                  onClick={() => startEdit(category)}
                  className="rounded-full border border-zinc-200 px-2 py-0.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  이름변경
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(category)}
                  className="rounded-full border border-zinc-200 px-2 py-0.5 text-xs text-red-600 transition hover:bg-red-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:border-zinc-700 dark:text-red-400 dark:hover:bg-red-500/10 dark:focus-visible:ring-offset-zinc-900"
                >
                  삭제
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex gap-2">
        <input
          value={newCategory}
          onChange={(event) => setNewCategory(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleAddCategory();
            }
          }}
          placeholder="새 카테고리 이름을 입력하세요"
          className="flex-1 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-1.5 text-sm outline-none focus:border-brand focus:bg-white dark:border-zinc-700 dark:bg-zinc-800"
        />
        <button
          type="button"
          onClick={handleAddCategory}
          disabled={!newCategory.trim()}
          className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white transition hover:bg-brand-dark active:scale-95 disabled:opacity-40 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
        >
          + 추가
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </section>
  );
}
