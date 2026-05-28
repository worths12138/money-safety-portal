"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { TeacherDashboardQueueItem } from "@/lib/teacher-dashboard-types";
import { filterQueueByRiskTier, type TeacherStatCard } from "@/lib/teacher-dashboard-metrics";
import type { OperationLog, QueueItem } from "@/lib/site-data";
import type { SessionProfile } from "@/lib/auth/types";

type RiskFilter = "全部" | "低" | "中" | "高";

type DashboardPayload = {
  profile: SessionProfile | null;
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
        <path d="M12 3v4M12 17v4M5 12H3M21 12h-2M7.05 7.05 5.64 5.64M18.36 18.36l-1.41-1.41M16.95 7.05l1.41-1.41M5.64 18.36l1.41-1.41" strokeLinecap="round" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </span>
  );
}

function QueueRowIcon({ category }: { category: string }) {
  const c = category.toLowerCase();
  const isCode = /api|云|code|模型|软件/.test(c + category);
  const isBook = /书|图书|资料/.test(c + category);
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
  const router = useRouter();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("全部");
  const [clock, setClock] = useState("");
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

  useEffect(() => {
    function tick() {
      setClock(
        new Date().toLocaleString("zh-CN", {
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "long",
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    }
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const filteredQueue = useMemo(() => {
    if (!data) return [];
    return filterQueueByRiskTier(data.queue, riskFilter).slice(0, 8);
  }, [data, riskFilter]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/teacher/login");
    router.refresh();
  }

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
              ? {
                  ...item,
                  status: payload.queueItem!.status,
                  risk: payload.queueItem!.risk,
                }
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

  const profile = data?.profile;

  return (
    <div className="teacher-dash space-y-5">
      <section className="teacher-dash-welcome sysu-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="teacher-dash-avatar" aria-hidden>
              {profile?.displayName?.slice(0, 1) ?? "师"}
            </span>
            <div>
              <p className="text-lg font-semibold text-slate-900">
                您好，{profile?.displayName ?? "指导老师"}
                {profile?.loginName ? (
                  <span className="ml-2 text-sm font-normal text-slate-500">({profile.loginName})</span>
                ) : null}
                <span className="teacher-dash-role-badge">教师</span>
              </p>
              <p className="mt-1 text-sm text-slate-500">欢迎使用大创报销合规风控平台，今日也要认真复核哦。</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
            <p className="text-sm text-slate-500" suppressHydrationWarning>
              {clock || "—"}
            </p>
            <button type="button" onClick={() => void logout()} className="teacher-dash-logout">
              退出
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={`sk-${i}`} className="teacher-dash-stat sysu-card">
                <p className="text-sm text-slate-400">加载中…</p>
              </div>
            ))
          : (data?.stats ?? []).map((stat) => (
              <div key={stat.key} className="teacher-dash-stat sysu-card">
                <StatIcon tone={stat.tone} />
                <p className="teacher-dash-stat-label">{stat.label}</p>
                <p className="teacher-dash-stat-value">{stat.value}</p>
                <p className="teacher-dash-stat-hint">{stat.hint}</p>
              </div>
            ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="teacher-dash-queue sysu-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">风险复核队列</h2>
            <div className="flex flex-wrap gap-2">
              {(["全部", "低", "中", "高"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setRiskFilter(f)}
                  className={`teacher-dash-filter ${riskFilter === f ? "is-active" : ""}`}
                >
                  {f === "全部" ? "全部" : `${f}风险`}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {loading ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">正在加载队列…</p>
            ) : filteredQueue.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">暂无符合条件的申报。</p>
            ) : (
              filteredQueue.map((item) => (
                <article
                  key={item.id}
                  className={`teacher-dash-queue-row px-5 py-4 ${item.riskTier === "高" ? "is-high" : ""}`}
                >
                  <div className="flex gap-4">
                    <QueueRowIcon category={item.category} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-slate-900">{item.projectName}</h3>
                          <p className="mt-0.5 text-sm text-slate-500">{item.owner}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className={riskTagClass(item.riskTier)}>{item.riskTierLabel}</span>
                          <span className="text-sm font-semibold text-slate-700">{item.risk}分</span>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-slate-400">提交于 {item.submittedAt}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.summary}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link href={`/report/${item.id}`} className="teacher-dash-btn teacher-dash-btn--ghost">
                          查看报告
                        </Link>
                        <button
                          type="button"
                          disabled={reviewingId === item.id || item.status !== "待审核"}
                          onClick={() => void updateStatus(item.id, "通过")}
                          className="teacher-dash-btn teacher-dash-btn--pass"
                        >
                          通过
                        </button>
                        <button
                          type="button"
                          disabled={reviewingId === item.id || item.status !== "待审核"}
                          onClick={() => void updateStatus(item.id, "驳回")}
                          className="teacher-dash-btn teacher-dash-btn--reject"
                        >
                          驳回
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>

          <div className="border-t border-slate-100 px-5 py-3 text-center">
            <Link href="/teacher/queue" className="text-sm font-medium text-[var(--accent-green)] hover:underline">
              查看全部 →
            </Link>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="teacher-dash-tips sysu-card p-5">
            <h2 className="text-base font-semibold text-slate-900">风控提示</h2>
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

          <div className="teacher-dash-logs sysu-card p-5">
            <h2 className="text-base font-semibold text-slate-900">最近审核记录</h2>
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
    </div>
  );
}
