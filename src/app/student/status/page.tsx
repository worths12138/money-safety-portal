"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useState } from "react";

type SubmissionItem = {
  id: string;
  projectName: string;
  amount: string;
  riskScore: number;
  status: string;
  submittedAt: string;
};

export default function StudentStatusPage() {
  const router = useRouter();
  const [reportId, setReportId] = useState("");
  const [items, setItems] = useState<SubmissionItem[]>([]);
  const [loginName, setLoginName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/student/submissions");
      const payload = (await response.json()) as {
        ok?: boolean;
        items?: SubmissionItem[];
        loginName?: string;
        message?: string;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? "加载失败");
      }
      setItems(payload.items ?? []);
      setLoginName(payload.loginName ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = reportId.trim();
    if (!id) return;
    router.push(`/student/report/${id}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="sysu-card bg-white/95 p-8">
        <h1 className="text-2xl font-semibold text-slate-950">进度查询</h1>
        <p className="mt-2 text-sm text-slate-600">
          {loginName ? `当前账号：${loginName} · ` : ""}
          仅显示本人最近 10 条申报；教师 AI 初审与批复后在此查看风险分与状态。
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-wrap gap-2">
          <input
            className="min-w-[200px] flex-1 border border-slate-200 px-3 py-2 text-sm"
            placeholder="输入报告编号，如 2026-123456"
            value={reportId}
            onChange={(e) => setReportId(e.target.value)}
          />
          <button
            type="submit"
            className="border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            查看报告
          </button>
        </form>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">我的申报</h2>
            <button
              type="button"
              onClick={() => void loadList()}
              className="text-xs text-slate-500 underline"
            >
              刷新
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">加载中…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-slate-500">暂无申报记录。</p>
          ) : (
            <ul className="divide-y divide-slate-100 border border-slate-200">
              {items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-slate-900">{item.projectName}</p>
                    <p className="text-slate-500">
                      {item.id} · {item.amount} · 风险分 {item.riskScore}
                    </p>
                    <p className="text-xs text-slate-400">{item.submittedAt}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs">{item.status}</span>
                    <Link
                      href={`/student/report/${item.id}`}
                      className="text-xs font-semibold text-[var(--accent-green)] hover:underline"
                    >
                      查看 →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-6 text-xs text-slate-500">
          <Link href="/student/preaudit" className="underline">
            提交新申报
          </Link>
        </p>
      </div>
    </div>
  );
}
