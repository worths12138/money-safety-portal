"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { StudentPageShell } from "@/components/student/StudentPageShell";

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
        message?: string;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? "加载失败");
      }
      setItems(payload.items ?? []);
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
    <StudentPageShell
      breadcrumb="进度查询"
      title="进度查询"
      description="输入报销编号，可查看您的 AI 初审、教师审批及反馈状态。"
    >
      <form onSubmit={handleSubmit} className="student-search-form">
        <div className="student-search-input-wrap">
          <SearchIcon />
          <input
            className="student-search-input"
            placeholder="输入报销编号，如 2026-123456"
            value={reportId}
            onChange={(e) => setReportId(e.target.value)}
          />
        </div>
        <button type="submit" className="student-btn-primary" style={{ maxWidth: "none", borderRadius: "9999px", padding: "0.65rem 1.5rem" }}>
          查看报告
        </button>
      </form>

      {error ? <p className="student-warn-text">{error}</p> : null}

      <div className="student-section-head">
        <h2>
          <DocIcon />
          我的申报
        </h2>
        <button type="button" onClick={() => void loadList()}>
          <RefreshIcon />
          刷新
        </button>
      </div>

      <div className="student-list-panel">
        {loading ? (
          <div className="student-empty-state">
            <p className="text-sm text-slate-500">加载中…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="student-empty-state">
            <EmptyIllustration />
            <h3>暂无申报记录</h3>
            <p>您还没有申报记录，提交申报后可在此查看进度与反馈。</p>
            <Link href="/student/preaudit" className="student-btn-outline">
              去提交申报 →
            </Link>
          </div>
        ) : (
          <ul className="student-submission-list">
            {items.map((item) => (
              <li key={item.id}>
                <div>
                  <p className="font-semibold text-slate-900">{item.projectName}</p>
                  <p className="mt-0.5 text-slate-500">
                    {item.id} · {item.amount} · 风险分 {item.riskScore}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">{item.submittedAt}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600">
                    {item.status}
                  </span>
                  <Link href={`/student/report/${item.id}`} className="text-xs font-semibold text-[var(--accent-green)] hover:underline">
                    查看 →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </StudentPageShell>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.5">
      <circle cx="9" cy="9" r="5.5" />
      <path d="M14 14 17 17" strokeLinecap="round" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-[var(--accent-green)]" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 3h7l3 3v11H6V3Z" strokeLinejoin="round" />
      <path d="M9 10h5M9 13h4" strokeLinecap="round" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.5">
      <path d="M13 8a5 5 0 1 1-1.5-3.6" strokeLinecap="round" />
      <path d="M13 3v3.5H9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EmptyIllustration() {
  return (
    <svg className="student-empty-illus" viewBox="0 0 160 112" fill="none" aria-hidden>
      <rect x="48" y="24" width="64" height="72" rx="6" fill="rgba(0,94,39,0.12)" stroke="currentColor" strokeWidth="1.5" />
      <path d="M58 44h44M58 54h36M58 64h28" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
      <circle cx="80" cy="78" r="10" fill="rgba(0,94,39,0.2)" stroke="currentColor" strokeWidth="1.2" />
      <path d="M76 78l3 3 6-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx="40" cy="88" rx="18" ry="8" fill="rgba(0,94,39,0.08)" />
      <ellipse cx="120" cy="88" rx="18" ry="8" fill="rgba(0,94,39,0.08)" />
      <path d="M28 52c4-8 12-14 20-14M132 52c-4-8-12-14-20-14" stroke="currentColor" strokeWidth="1" opacity="0.35" strokeLinecap="round" />
    </svg>
  );
}
