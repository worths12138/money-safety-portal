"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adminAuditLogFieldDefinitions,
  adminEntityDefinitions,
  adminQueueFieldDefinitions,
  adminRiskFilterDefinitions,
} from "@/lib/admin-definitions";
import type { OperationLog, QueueItem } from "@/lib/site-data";

type QueueStatus = "待审核" | "通过" | "驳回";

export default function AdminPage() {
  const [riskFilter, setRiskFilter] = useState<"全部" | "低" | "中" | "高">("全部");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [agentRunningId, setAgentRunningId] = useState<string | null>(null);
  const [deletingSubmissionId, setDeletingSubmissionId] = useState<string | null>(null);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);

  const loadData = useCallback(async () => {
    setError("");
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);

    try {
      const [queueRes, logsRes] = await Promise.all([
        fetch("/api/admin/queue", { signal: controller.signal }),
        fetch("/api/admin/audit-logs", { signal: controller.signal }),
      ]);

      const queuePayload = (await queueRes.json()) as { ok?: boolean; queue?: QueueItem[]; message?: string };
      const logsPayload = (await logsRes.json()) as { ok?: boolean; logs?: OperationLog[]; message?: string };

      if (!queueRes.ok || !queuePayload.ok) {
        throw new Error(queuePayload.message ?? "队列加载失败");
      }
      if (!logsRes.ok || !logsPayload.ok) {
        throw new Error(logsPayload.message ?? "审核记录加载失败");
      }

      setQueue(queuePayload.queue ?? []);
      setLogs(logsPayload.logs ?? []);
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "AbortError"
          ? "加载超时，请检查 Supabase 配置与网络。"
          : err instanceof Error
            ? err.message
            : "加载失败";
      setError(message);
    } finally {
      window.clearTimeout(timer);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredQueue = useMemo(() => {
    return queue.filter((item) => {
      if (riskFilter === "全部") return true;
      if (riskFilter === "低") return item.risk < 40;
      if (riskFilter === "中") return item.risk >= 40 && item.risk < 70;
      return item.risk >= 70;
    });
  }, [queue, riskFilter]);

  async function deleteSubmission(id: string, projectName: string) {
    if (!window.confirm(`确定删除申报「${projectName}」？关联审核记录将一并删除，且不可恢复。`)) {
      return;
    }

    setDeletingSubmissionId(id);
    setError("");

    try {
      const response = await fetch(`/api/admin/submissions/${id}`, { method: "DELETE" });
      const payload = (await response.json()) as { ok?: boolean; message?: string };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? "删除失败");
      }

      setQueue((current) => current.filter((item) => item.id !== id));
      setLogs((current) => current.filter((item) => item.submissionId !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setDeletingSubmissionId(null);
    }
  }

  async function deleteAuditLog(logId: string) {
    if (!window.confirm("确定删除这条审核记录？删除后不可恢复。")) {
      return;
    }

    setDeletingLogId(logId);
    setError("");

    try {
      const response = await fetch(`/api/admin/audit-logs/${logId}`, { method: "DELETE" });
      const payload = (await response.json()) as { ok?: boolean; message?: string };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? "删除失败");
      }

      setLogs((current) => current.filter((item) => item.id !== logId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setDeletingLogId(null);
    }
  }

  async function purgeAll() {
    if (
      !window.confirm(
        "确定一键清空全部申报与审核记录？此操作不可恢复，对应风控报告链接将失效。",
      )
    ) {
      return;
    }

    setPurging(true);
    setError("");

    try {
      const response = await fetch("/api/admin/purge", { method: "POST" });
      const payload = (await response.json()) as { ok?: boolean; message?: string };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? "清空失败");
      }

      setQueue([]);
      setLogs([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "清空失败");
    } finally {
      setPurging(false);
    }
  }

  async function runAgentReview(id: string, projectName: string) {
    if (
      !window.confirm(
        `对「${projectName}」发起 AI 风控初审？\n将调用智谱多模态识图（凭证较多时约 1～4 分钟），请保持网络畅通。`,
      )
    ) {
      return;
    }

    setAgentRunningId(id);
    setError("");

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 300_000);

    try {
      const response = await fetch("/api/agent/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: id }),
        signal: controller.signal,
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        report?: { riskScore?: number };
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? "AI 初审失败");
      }

      await loadData();
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "AbortError"
          ? "AI 初审超时。请减少凭证张数或压缩图片后，在报告页重试。"
          : err instanceof Error
            ? err.message
            : "AI 初审失败";
      setError(message);
    } finally {
      window.clearTimeout(timer);
      setAgentRunningId(null);
    }
  }

  async function updateStatus(id: string, status: QueueStatus) {
    if (status === "待审核") {
      return;
    }

    setReviewingId(id);
    setError("");

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch("/api/admin/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
        signal: controller.signal,
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        queueItem?: QueueItem;
        log?: OperationLog;
      };

      if (!response.ok || !payload.ok || !payload.queueItem || !payload.log) {
        throw new Error(payload.message ?? "审核失败");
      }

      setQueue((current) => current.map((item) => (item.id === id ? payload.queueItem! : item)));
      setLogs((current) => [payload.log!, ...current]);
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "AbortError"
          ? "审核请求超时。"
          : err instanceof Error
            ? err.message
            : "审核失败";
      setError(message);
    } finally {
      window.clearTimeout(timer);
      setReviewingId(null);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <section className="sysu-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-700">/admin</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">合规风控运营台</h2>
            <p className="mt-2 text-sm text-slate-500">
              学生端提交后在此发起 AI 风控初审，再按风险分级通过或驳回；可删除单条申报或审核记录。
            </p>
          </div>
          <Link href="/admin/rules" className="border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50">
            打开规则配置
          </Link>
        </div>

        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          {(["全部", "低", "中", "高"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setRiskFilter(item)}
              className={`rounded-md border px-4 py-2 text-sm font-medium transition ${riskFilter === item ? "border-slate-300 bg-white text-slate-900" : "border-slate-200 bg-white text-slate-600 hover:text-slate-900"}`}
            >
              {item} 风险
            </button>
          ))}
          <button
            type="button"
            disabled={purging || loading}
            onClick={() => void purgeAll()}
            className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {purging ? "清空中…" : "一键清空"}
          </button>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void loadData();
            }}
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            刷新
          </button>
        </div>

        <div className="sysu-card mt-6 overflow-hidden">
          <div className="grid grid-cols-[1.4fr_0.7fr_0.7fr_0.8fr_1fr] gap-4 border-b border-slate-200 px-5 py-4 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            <span>项目</span>
            <span>风险</span>
            <span>状态</span>
            <span>提交时间</span>
            <span>操作</span>
          </div>
          <div className="divide-y divide-slate-100 bg-white">
            {loading ? (
              <p className="px-5 py-8 text-sm text-slate-500">正在加载队列…</p>
            ) : filteredQueue.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-500">暂无申报记录。</p>
            ) : (
              filteredQueue.map((item) => (
                <div key={item.id} className="grid grid-cols-[1.4fr_0.7fr_0.7fr_0.8fr_1fr] gap-4 px-5 py-4 text-sm">
                  <div>
                    <Link
                      href={`/report/${item.id}`}
                      className="font-semibold text-slate-950 underline-offset-2 transition hover:text-[var(--accent-green)] hover:underline"
                    >
                      {item.projectName}
                    </Link>
                    <p className="mt-1 text-slate-500">{item.owner}</p>
                    <p className="mt-1 text-slate-400">{item.category || "—"}</p>
                    <Link
                      href={`/report/${item.id}`}
                      className="mt-2 inline-block text-xs font-medium text-[var(--accent-green)] transition hover:underline"
                    >
                      查看风险评估书 →
                    </Link>
                  </div>
                  <div className="flex items-start">
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      {item.risk}
                    </span>
                  </div>
                  <div className="font-medium text-slate-700">{item.status}</div>
                  <div className="text-slate-500">{item.submittedAt}</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={
                        agentRunningId === item.id ||
                        reviewingId === item.id ||
                        deletingSubmissionId === item.id
                      }
                      onClick={() => void runAgentReview(item.id, item.projectName)}
                      className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {agentRunningId === item.id ? "AI 初审中…" : "AI 初审"}
                    </button>
                    <button
                      type="button"
                      disabled={reviewingId === item.id || deletingSubmissionId === item.id || item.status !== "待审核"}
                      onClick={() => updateStatus(item.id, "通过")}
                      className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      通过
                    </button>
                    <button
                      type="button"
                      disabled={reviewingId === item.id || deletingSubmissionId === item.id || item.status !== "待审核"}
                      onClick={() => updateStatus(item.id, "驳回")}
                      className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      驳回
                    </button>
                    <button
                      type="button"
                      disabled={reviewingId === item.id || deletingSubmissionId === item.id}
                      onClick={() => void deleteSubmission(item.id, item.projectName)}
                      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingSubmissionId === item.id ? "删除中…" : "删除"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <aside className="space-y-6">
        <div className="sysu-card p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">字段定义</p>
          <details className="mt-4 group">
            <summary className="cursor-pointer text-sm font-medium text-slate-900 marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                查看申报队列字段说明
                <span className="text-slate-400 transition group-open:rotate-180">▾</span>
              </span>
            </summary>
            <dl className="mt-3 space-y-3 border-t border-slate-100 pt-3">
              {adminQueueFieldDefinitions.map((item) => (
                <div key={item.key}>
                  <dt className="text-sm font-semibold text-slate-800">{item.label}</dt>
                  <dd className="mt-1 text-sm leading-6 text-slate-500">{item.definition}</dd>
                </div>
              ))}
            </dl>
          </details>
          <details className="mt-3 group">
            <summary className="cursor-pointer text-sm font-medium text-slate-900 marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                查看风险分级说明
                <span className="text-slate-400 transition group-open:rotate-180">▾</span>
              </span>
            </summary>
            <dl className="mt-3 space-y-3 border-t border-slate-100 pt-3">
              {adminRiskFilterDefinitions.map((item) => (
                <div key={item.key}>
                  <dt className="text-sm font-semibold text-slate-800">{item.label} 风险</dt>
                  <dd className="mt-1 text-sm leading-6 text-slate-500">{item.definition}</dd>
                </div>
              ))}
            </dl>
          </details>
          <details className="mt-3 group">
            <summary className="cursor-pointer text-sm font-medium text-slate-900 marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                查看审核记录字段说明
                <span className="text-slate-400 transition group-open:rotate-180">▾</span>
              </span>
            </summary>
            <dl className="mt-3 space-y-3 border-t border-slate-100 pt-3">
              {adminAuditLogFieldDefinitions.map((item) => (
                <div key={item.key}>
                  <dt className="text-sm font-semibold text-slate-800">{item.label}</dt>
                  <dd className="mt-1 text-sm leading-6 text-slate-500">{item.definition}</dd>
                </div>
              ))}
            </dl>
          </details>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">数据实体</p>
            <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-500">
              {adminEntityDefinitions.map((item) => (
                <li key={item.name}>
                  <strong className="text-slate-700">{item.name}</strong> — {item.description}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="sysu-card p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">审核记录</p>
          <div className="mt-4 space-y-3">
            {loading ? (
              <p className="text-sm text-slate-500">加载中…</p>
            ) : logs.length === 0 ? (
              <p className="text-sm text-slate-500">暂无审核记录。</p>
            ) : (
              logs.map((item) => (
                <div key={item.id} className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                  <div className="flex items-center justify-between gap-2">
                    <strong>{item.actor}</strong>
                    <span className="text-slate-400">{item.time}</span>
                  </div>
                  <p className="mt-1">
                    {item.action} · {item.target}
                  </p>
                  <Link
                    href={`/report/${item.submissionId}`}
                    className="mt-2 inline-block text-xs font-medium text-[var(--accent-green)] transition hover:underline"
                  >
                    打开对应风险评估书 →
                  </Link>
                  <button
                    type="button"
                    disabled={deletingLogId === item.id}
                    onClick={() => void deleteAuditLog(item.id)}
                    className="mt-2 block text-xs font-semibold text-red-700 transition hover:underline disabled:opacity-50"
                  >
                    {deletingLogId === item.id ? "删除中…" : "删除此记录"}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
