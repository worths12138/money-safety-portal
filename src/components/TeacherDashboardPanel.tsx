"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TeacherWelcomeBar } from "@/components/teacher/TeacherWelcomeBar";
import type { TeacherDashboardQueueItem } from "@/lib/teacher-dashboard-types";
import { filterQueueByRiskTier, type TeacherStatCard } from "@/lib/teacher-dashboard-metrics";
import type { OperationLog, QueueItem } from "@/lib/site-data";

type RiskFilter = "全部" | "低" | "中" | "高";

type DashboardPayload = {
  profile: { displayName?: string; loginName?: string } | null;
  stats: TeacherStatCard[];
  queue: TeacherDashboardQueueItem[];
  tips: string[];
  logs: OperationLog[];
};

function StatIcon({ tone }: { tone: TeacherStatCard["tone"] }) {
  const className = `teacher-dash-stat-icon teacher-dash-stat-icon--${tone}`;
  if (tone === "blue") {
    return (
      <span className={className} aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.6">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="M9 12h6M9 16h4" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  if (tone === "red") {
    return (
      <span className={className} aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (tone === "green") {
    return (
      <span className={className} aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.6">
          <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  return (
    <span className={className} aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.6">
        <path d="M12 3v4M12 17v4M5 12H3M21 12h-2" strokeLinecap="round" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </span>
  );
}

function QueueRowIcon({ category }: { category: string }) {
  const isCode = /api|云|code|模型|软件/i.test(category);
  const isBook = /书|图书|资料/.test(category);
  return (
    <span className="teacher-dash-queue-icon" aria-hidden>
      {isCode ? "</>" : isBook ? "📚" : "📁"}
    </span>
  );
}

function riskTagClass(tier: string) {
  if (tier === "高") return "teacher-dash-tag teacher-dash-tag--high";
  if (tier === "中") return "teacher-dash-tag teacher-dash-tag--mid";
  return "teacher-dash-tag teacher-dash-tag--low";
}

export function TeacherDashboardPanel() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("全部");
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/teacher/dashboard");
      const payload = (await res.json()) as DashboardPayload & { ok?: boolean; message?: string };
      if (!res.ok || !payload.ok) {
        throw new Error(payload.message ?? "加载失败");
      }
      setData({
        profile: payload.profile ?? null,
        stats: payload.stats ?? [],
        queue: payload.queue ?? [],
        tips: payload.tips ?? [],
        logs: payload.logs ?? [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredQueue = useMemo(() => {
    if (!data) return [];
    return filterQueueByRiskTier(data.queue, riskFilter).slice(0, 8);
  }, [data, riskFilter]);

  async function updateStatus(id: string, status: "通过" | "驳回") {
    setReviewingId(id);
    setError("");
    try {
      const res = await fetch("/api/admin/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const payload = (await res.json()) as {
        ok?: boolean;
        message?: string;
        queueItem?: QueueItem;
        log?: OperationLog;
      };
      if (!res.ok || !payload.ok || !payload.queueItem) {
        throw new Error(payload.message ?? "操作失败");
      }
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          queue: prev.queue.map((item) =>
            item.id === id
              ? { ...item, status: payload.queueItem!.status, risk: payload.queueItem!.risk }
              : item,
          ),
          logs: payload.log ? [payload.log, ...prev.logs] : prev.logs,
        };
      });
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setReviewingId(null);
    }
  }

  return (
    <div className="teacher-page-shell">
      <TeacherWelcomeBar hint="欢迎使用中山大学合规风控平台，今日也要认真复核哦。" />

      <section className="teacher-glass-panel teacher-dash-panel">
        <header className="teacher-page-hero">
          <h1>教师合规风控工作台</h1>
          <p>数据驱动风险识别，智能辅助合规决策</p>
        </header>

        {error ? <p className="teacher-alert teacher-alert--error">{error}</p> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={`sk-${i}`} className="teacher-dash-stat teacher-inner-card">
                  <p className="text-sm text-slate-400">加载中…</p>
                </div>
              ))
            : (data?.stats ?? []).map((stat) => (
                <div key={stat.key} className="teacher-dash-stat teacher-inner-card">
                  <StatIcon tone={stat.tone} />
                  <p className="teacher-dash-stat-label">{stat.label}</p>
                  <p className="teacher-dash-stat-value">{stat.value}</p>
                  <p className="teacher-dash-stat-hint">{stat.hint}</p>
                </div>
              ))}
        </section>

        <section className="mt-6 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="teacher-dash-queue teacher-inner-card p-4 sm:p-5">
            <div className="teacher-section-head">
              <h2 className="teacher-section-title">风险复核队列</h2>
              <div className="flex flex-wrap gap-2">
                {(["全部", "低", "中", "高"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setRiskFilter(f)}
                    className={`teacher-filter-btn ${riskFilter === f ? "is-active" : ""}`}
                  >
                    {f === "全部" ? "全部" : `${f}风险`}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-2">
              {loading ? (
                <p className="py-10 text-center text-sm text-slate-500">正在加载队列…</p>
              ) : filteredQueue.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">暂无符合条件的申报。</p>
              ) : (
                filteredQueue.map((item) => (
                  <article
                    key={item.id}
                    className={`teacher-queue-task ${item.riskTier === "高" ? "is-high" : ""}`}
                  >
                    <QueueRowIcon category={item.category} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-slate-900">{item.projectName}</h3>
                          <p className="mt-0.5 text-sm text-slate-500">{item.owner}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className={riskTagClass(item.riskTier)}>{item.riskTierLabel}</span>
                          <span className="teacher-risk-badge">{item.risk}</span>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-slate-400">提交于 {item.submittedAt}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.summary}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link href={`/report/${item.id}`} className="teacher-ghost-btn">
                          查看报告
                        </Link>
                        <button
                          type="button"
                          disabled={reviewingId === item.id || item.status !== "待审核"}
                          onClick={() => void updateStatus(item.id, "通过")}
                          className="teacher-primary-btn"
                        >
                          通过
                        </button>
                        <button
                          type="button"
                          disabled={reviewingId === item.id || item.status !== "待审核"}
                          onClick={() => void updateStatus(item.id, "驳回")}
                          className="teacher-outline-btn"
                          style={{ borderColor: "#fecaca", color: "#b91c1c" }}
                        >
                          驳回
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>

            <div className="mt-3 border-t border-slate-100 pt-3 text-center">
              <Link href="/teacher/queue" className="text-sm font-semibold text-[var(--accent-green)] hover:underline">
                查看全部 →
              </Link>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="teacher-side-card teacher-inner-card">
              <h3 className="teacher-section-title">风控提示</h3>
              <ul className="mt-4 space-y-3">
                {(data?.tips ?? []).map((tip) => (
                  <li key={tip} className="flex gap-2 text-sm leading-6 text-slate-600">
                    <span className="teacher-dash-tip-dot" aria-hidden>
                      ✓
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            <div className="teacher-side-card teacher-inner-card">
              <h3 className="teacher-section-title">最近审核记录</h3>
              <ul className="mt-4 space-y-4">
                {loading ? (
                  <li className="text-sm text-slate-500">加载中…</li>
                ) : (data?.logs ?? []).length === 0 ? (
                  <li className="text-sm text-slate-500">暂无审核记录。</li>
                ) : (
                  (data?.logs ?? []).slice(0, 6).map((log) => {
                    const passed = log.action.includes("通过");
                    return (
                      <li key={log.id} className="flex gap-3 text-sm">
                        <span
                          className={`teacher-dash-log-dot ${passed ? "is-pass" : "is-reject"}`}
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800">
                            {log.action} · {log.actor}
                          </p>
                          <p className="mt-0.5 text-slate-600">{log.target}</p>
                          <p className="mt-1 text-xs text-slate-400">{log.time}</p>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          </aside>
        </section>
      </section>
    </div>
  );
}
