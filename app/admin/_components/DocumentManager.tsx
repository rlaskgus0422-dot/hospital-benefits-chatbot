"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CATEGORIES, type Category } from "@/app/_lib/categories";

type StoredDocument = {
  category: Category;
  fileName: string;
  createdAt: string;
};

export default function DocumentManager() {
  const [categories, setCategories] = useState<Category[]>([...CATEGORIES]);
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [category, setCategory] = useState<Category>(CATEGORIES[0]);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadDocuments() {
    const response = await fetch("/api/admin/documents");
    if (response.ok) {
      const data = await response.json();
      setDocuments(data.documents);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/documents")
      .then((response) => (response.ok ? response.json() : { documents: [] }))
      .then((data: { documents: StoredDocument[] }) => {
        if (!cancelled) setDocuments(data.documents);
      });
    // 관리자가 추가한 카테고리도 업로드 목록에 나오도록 최신 카테고리 순서를 불러온다.
    fetch("/api/admin/order")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { categoryOrder: Category[] } | null) => {
        if (cancelled || !data) return;
        setCategories(data.categoryOrder);
        setCategory(data.categoryOrder[0]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setError("");
    setIsSubmitting(true);

    const formData = new FormData();
    formData.set("category", category);
    formData.set("file", file);

    const response = await fetch("/api/admin/documents", { method: "POST", body: formData });
    const data = await response.json().catch(() => ({}));
    setIsSubmitting(false);

    if (!response.ok) {
      setError(data.error ?? "업로드에 실패했어요.");
      return;
    }

    setFile(null);
    await loadDocuments();
  }

  async function handleDelete(target: Category) {
    await fetch(`/api/admin/documents/${encodeURIComponent(target)}`, { method: "DELETE" });
    await loadDocuments();
  }

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">규정 문서 관리</h2>

      <form onSubmit={handleUpload} className="mt-4 flex flex-wrap items-center gap-2">
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as Category)}
          className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="file"
          accept="application/pdf"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <button
          type="submit"
          disabled={!file || isSubmitting}
          className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white transition hover:bg-brand-dark active:scale-95 disabled:opacity-40 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
        >
          등록
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <ul className="mt-4 space-y-2">
        {documents.length === 0 && <li className="text-sm text-zinc-400">등록된 문서가 없습니다.</li>}
        {documents.map((doc) => (
          <li
            key={doc.category}
            className="flex items-center justify-between rounded-2xl border border-zinc-100 px-4 py-2 text-sm dark:border-zinc-800"
          >
            <span>
              {doc.category} - {doc.fileName}
            </span>
            <button
              type="button"
              onClick={() => handleDelete(doc.category)}
              className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 transition hover:bg-zinc-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus-visible:ring-offset-zinc-900"
            >
              삭제
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
