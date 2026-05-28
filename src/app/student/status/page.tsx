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
    <div className="student-page-shell">
      <section className="student-glass-panel student-status-panel">
        <div className="student-breadcrumb">
          <HomeMiniIcon />
          <span>学生端</span>
          <em>/</em>
          <span>进度查询</span>
        </div>
        <div className="student-page-heading student-page-heading--left">
          <h1>进度查询</h1>
          <span className="student-heading-rule" />
          <strong>
            {loginName ? `当前账号：${loginName} · ` : ""}
            输入报销编号，可查看您的 AI 初审、教师审批及反馈状态。
          </strong>
        </div>

        <form onSubmit={handleSubmit} className="student-status-search">
          <div>
            <SearchIcon />
            <input
              placeholder="输入报销编号，如 2026-123456"
              value={reportId}
              onChange={(e) => setReportId(e.target.value)}
            />
          </div>
          <button type="submit" className="student-primary-btn">
            查看报告
          </button>
        </form>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <div className="student-status-card">
          <div className="student-status-card-head">
            <h2><ClipboardListIcon />我的申报</h2>
            <button
              type="button"
              onClick={() => void loadList()}
            >
              <RefreshIcon />
              刷新
            </button>
          </div>

          {loading ? (
            <p className="student-status-loading">加载中…</p>
          ) : items.length === 0 ? (
            <div className="student-empty-state">
              <EmptyClipboardIcon />
              <h3>暂无申报记录</h3>
              <p>您还没有申报记录，提交申报后可在此查看进度与反馈。</p>
              <Link href="/student/preaudit" className="student-outline-btn">
                去提交申报 <span aria-hidden>›</span>
              </Link>
            </div>
          ) : (
            <ul className="student-submission-list">
              {items.map((item) => (
                <li key={item.id}>
                  <div>
                    <p>{item.projectName}</p>
                    <span>
                      {item.id} · {item.amount} · 风险分 {item.riskScore}
                    </span>
                    <small>{item.submittedAt}</small>
                  </div>
                  <span className="student-status-tag">{item.status}</span>
                  <Link href={`/student/report/${item.id}`}>查看 →</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function HomeMiniIcon() {
  return <svg viewBox="0 0 24 24"><path d="m4 11 8-7 8 7" /><path d="M6.5 10.5V20h4.2v-5h2.6v5h4.2v-9.5" /></svg>;
}
function SearchIcon() {
  return <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></svg>;
}
function ClipboardListIcon() {
  return <svg viewBox="0 0 24 24"><path d="M8 5h8M9 4h6v3H9V4Z" /><path d="M6 6h12v14H6V6Z" /><path d="M9 12h6M9 16h4" /></svg>;
}
function RefreshIcon() {
  return <svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 0 1-14 5M4 12a8 8 0 0 1 14-5" /><path d="M18 3v4h-4M6 21v-4h4" /></svg>;
}
function EmptyClipboardIcon() {
  return <svg viewBox="0 0 180 120"><path d="M38 86c14 8 88 8 104 0" /><circle cx="63" cy="70" r="12" /><circle cx="130" cy="70" r="12" /><rect x="70" y="22" width="50" height="68" rx="8" /><rect x="83" y="15" width="24" height="12" rx="4" /><path d="M84 44h22M84 58h18M84 72h14" /><circle cx="119" cy="70" r="12" /><path d="m113 69 4 4 8-9" /><path d="M132 34h.01M48 42h.01M150 58h.01" /></svg>;
}
