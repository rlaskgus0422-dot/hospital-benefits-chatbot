"use client";

import { useEffect, useMemo, useState } from "react";
import { getCategoryEmoji, type Category } from "@/app/_lib/categories";

type AnswerType = "answered" | "no_answer" | "hr_referral" | "error";

type ChatLog = {
  id: string;
  question: string;
  answer: string;
  matchedCategory: Category | null;
  answerType: AnswerType;
  feedback: "helpful" | "unhelpful" | null;
  createdAt: string;
};

type Filter = "all" | AnswerType | "unhelpful";
type Counts = Record<AnswerType, number> & { all: number; unhelpful: number };

const ANSWER_TYPE_LABEL: Record<AnswerType, string> = {
  answered: "답변완료",
  no_answer: "미해결(총무팀 안내)",
  hr_referral: "인사팀 안내",
  error: "오류",
};

const ANSWER_TYPE_STYLE: Record<AnswerType, string> = {
  answered: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  no_answer: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  hr_referral: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  error: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
};

const FILTER_TABS: { key: Filter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "no_answer", label: "미해결" },
  { key: "unhelpful", label: "안좋은 피드백" },
  { key: "error", label: "오류" },
  { key: "answered", label: "답변완료" },
];

const PAGE_SIZE = 30;

type ViewMode = "list" | "stats";

// 같은 카테고리에서 정확히 같은 답변이 나갔다면(표현만 다른 질문이어도) 같은 주제로 본다 —
// FAQ로 등록된 질문이 아니어도, 실제로 어떤 답이 반복해서 나가는지로 묶을 수 있다.
type StatGroup = {
  key: string;
  matchedCategory: Category | null;
  answer: string;
  answerType: AnswerType;
  count: number;
  helpful: number;
  unhelpful: number;
  questions: string[];
};

function buildStatGroups(logs: ChatLog[]): StatGroup[] {
  const groups = new Map<string, StatGroup>();

  logs.forEach((log) => {
    const key = `${log.matchedCategory ?? "미분류"}|||${log.answer}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      if (log.feedback === "helpful") existing.helpful += 1;
      if (log.feedback === "unhelpful") existing.unhelpful += 1;
      if (!existing.questions.includes(log.question)) existing.questions.push(log.question);
    } else {
      groups.set(key, {
        key,
        matchedCategory: log.matchedCategory,
        answer: log.answer,
        answerType: log.answerType,
        count: 1,
        helpful: log.feedback === "helpful" ? 1 : 0,
        unhelpful: log.feedback === "unhelpful" ? 1 : 0,
        questions: [log.question],
      });
    }
  });

  return [...groups.values()].sort((a, b) => b.count - a.count);
}

// 막대 길이로 건수를 한눈에 비교하게 하고, 값은 막대 밖 고정폭 자리에 둬서 짧은 막대에서도 안 잘리게 한다.
function StatChart({ groups }: { groups: StatGroup[] }) {
  if (groups.length === 0) {
    return <p className="mt-4 text-sm text-zinc-400">해당하는 로그가 없습니다.</p>;
  }

  const maxCount = Math.max(...groups.map((group) => group.count));

  return (
    <ul className="mt-4 space-y-3">
      {groups.map((group) => {
        const widthPercent = Math.max((group.count / maxCount) * 100, 4);
        const representative = group.questions[0];
        const extraCount = group.questions.length - 1;

        return (
          <li key={group.key}>
            <div className="flex items-center gap-3">
              <div
                className="w-40 shrink-0 truncate text-xs font-medium text-zinc-700 sm:w-56 dark:text-zinc-300"
                title={group.questions.join(" / ")}
              >
                {representative}
                {extraCount > 0 && <span className="text-zinc-400 dark:text-zinc-500"> 외 {extraCount}</span>}
              </div>
              <div className="h-5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div className="h-5 rounded-full bg-brand dark:bg-blue-500" style={{ width: `${widthPercent}%` }} />
              </div>
              <div className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-zinc-800 dark:text-zinc-100">
                {group.count}건
              </div>
            </div>
            {/* 카테고리는 AI가 나중에 다시 추정한 값이라 100% 정확하지 않을 수 있어 목록에선 뺐다 —
                필요하면 질문에 마우스를 올렸을 때(title) 참고용으로만 보이게 한다. */}
            <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-1 text-xs text-zinc-400 dark:text-zinc-500">
              <span className={`rounded-full px-1.5 py-0.5 ${ANSWER_TYPE_STYLE[group.answerType]}`}>
                {ANSWER_TYPE_LABEL[group.answerType]}
              </span>
              {(group.helpful > 0 || group.unhelpful > 0) && (
                <span>
                  👍 {group.helpful} · 👎 {group.unhelpful}
                </span>
              )}
              <span className="truncate">— {group.answer.replace(/\n/g, " ")}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function ChatLogManager() {
  const [logs, setLogs] = useState<ChatLog[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    fetch("/api/admin/chat-logs")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { logs: ChatLog[] } | null) => {
        if (data) setLogs(data.logs);
      });
  }, []);

  const counts = useMemo(() => {
    const base: Counts = { all: logs.length, answered: 0, no_answer: 0, hr_referral: 0, error: 0, unhelpful: 0 };
    logs.forEach((log) => {
      base[log.answerType] += 1;
      if (log.feedback === "unhelpful") base.unhelpful += 1;
    });
    return base;
  }, [logs]);

  const filtered = useMemo(() => {
    if (filter === "all") return logs;
    if (filter === "unhelpful") return logs.filter((log) => log.feedback === "unhelpful");
    return logs.filter((log) => log.answerType === filter);
  }, [logs, filter]);

  const visible = filtered.slice(0, visibleCount);
  const statGroups = useMemo(() => buildStatGroups(filtered), [filtered]);

  function handleFilterChange(next: Filter) {
    setFilter(next);
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">질문·답변 로그</h2>
        <div className="flex gap-1 rounded-full bg-zinc-100 p-1 text-xs font-medium dark:bg-zinc-800">
          {([
            ["list", "목록"],
            ["stats", "통계"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setViewMode(key)}
              className={`rounded-full px-3 py-1 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 ${
                viewMode === key ? "bg-white text-brand shadow-sm dark:bg-zinc-700 dark:text-blue-300" : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        챗봇이 실제로 받은 질문과 답변이에요. 개인 식별 정보는 저장하지 않고, 90일이 지난 로그는 자동으로 삭제됩니다.
        &quot;미해결&quot;과 &quot;안좋은 피드백&quot;을 자주 확인하면 어떤 답변을 보강해야 할지 알 수 있어요.
        {viewMode === "stats" && " 통계는 같은 카테고리에서 똑같은 답변이 나간 것끼리(표현이 달라도) 묶어서 보여줘요."}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTER_TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => handleFilterChange(key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 ${
              filter === key
                ? "bg-brand text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-brand-light hover:text-brand dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            {label} {counts[key]}
          </button>
        ))}
      </div>

      {viewMode === "stats" ? (
        <StatChart groups={statGroups} />
      ) : (
        <>
          <ul className="mt-4 space-y-2">
            {visible.map((log) => (
              <li key={log.id} className="rounded-2xl border border-zinc-100 p-3 dark:border-zinc-800">
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
                  <span>{new Date(log.createdAt).toLocaleString("ko-KR")}</span>
                  {log.matchedCategory && (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {getCategoryEmoji(log.matchedCategory)} {log.matchedCategory}
                    </span>
                  )}
                  <span className={`rounded-full px-2 py-0.5 ${ANSWER_TYPE_STYLE[log.answerType]}`}>
                    {ANSWER_TYPE_LABEL[log.answerType]}
                  </span>
                  {log.feedback && <span>{log.feedback === "helpful" ? "👍" : "👎"}</span>}
                </div>
                <p className="mt-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-200">Q. {log.question}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">A. {log.answer}</p>
              </li>
            ))}
            {visible.length === 0 && <li className="text-sm text-zinc-400">해당하는 로그가 없습니다.</li>}
          </ul>

          {filtered.length > visible.length && (
            <button
              type="button"
              onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
              className="mt-4 w-full rounded-full border border-zinc-200 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus-visible:ring-offset-zinc-900"
            >
              더 보기 ({filtered.length - visible.length}건 남음)
            </button>
          )}
        </>
      )}
    </section>
  );
}
