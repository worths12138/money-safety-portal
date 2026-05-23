"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { exportReportPdf } from "@/lib/export-report-pdf";
import { defaultRiskRows, type ReportData, reportMaterialTypes } from "@/lib/site-data";

function loadingReport(id: string): ReportData {
  return {
    id,
    projectName: "加载中...",
    projectPeriod: "",
    fundCategory: "",
    amount: "",
    conclusion: "",
    riskScore: 0,
    summary: "正在加载风控报告...",
    materials: reportMaterialTypes.slice(0, 3).map((label) => ({ label, value: "", status: "blank" })),
    riskRows: defaultRiskRows,
    findings: [],
    recommendations: [],
    aiNotes: [],
  };
}

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [report, setReport] = useState<ReportData>(() => loadingReport(id));
  const [message, setMessage] = useState("正在拉取风控报告...");
  const [isPrinting, setIsPrinting] = useState(false);
  const [exportedAt, setExportedAt] = useState("");

  useEffect(() => {
    setExportedAt(new Date().toLocaleString("zh-CN"));
  }, []);

  const handleExportPdf = useCallback(() => {
    setExportedAt(new Date().toLocaleString("zh-CN"));
    exportReportPdf({
      reportId: id,
      projectName: report.projectName,
      onPrepare: () => setIsPrinting(true),
      onFinish: () => setIsPrinting(false),
    });
  }, [id, report.projectName]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);

    fetch(`/api/reports/${id}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { message?: string };
          throw new Error(payload.message ?? "风控报告加载失败");
        }
        return response.json();
      })
      .then((payload: { report: ReportData }) => {
        setReport(payload.report);
        setMessage("风控报告已加载完成。");
      })
      .catch((error: unknown) => {
        setMessage(error instanceof DOMException && error.name === "AbortError" ? "风控报告请求超时。" : error instanceof Error ? error.message : "风控报告加载失败。");
      })
      .finally(() => window.clearTimeout(timer));

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [id]);

  const riskRows = report.riskRows?.length ? report.riskRows : defaultRiskRows;

  return (
    <div className="report-print-root mx-auto flex w-full max-w-3xl flex-col gap-8 print:max-w-none">
      <section className="report-print-section sysu-card px-7 py-9 print:shadow-none">
        <div className="hidden print:block report-print-block border-0 px-0 py-0 mb-6">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">中山大学软件工程学院 · 经费合规风控</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">经费合规风控报告</h1>
          <dl className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">报告编号</dt>
              <dd className="font-medium">{id}</dd>
            </div>
            <div>
              <dt className="text-slate-500">项目名称</dt>
              <dd className="font-medium">{report.projectName || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">项目周期</dt>
              <dd className="font-medium">{report.projectPeriod || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">生成时间</dt>
              <dd className="font-medium" suppressHydrationWarning>
                {exportedAt || "—"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between no-print">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-700">/report/{id}</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">经费合规风控报告</h2>
            <p className="mt-2 text-sm text-slate-500">{message}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <button
              type="button"
              onClick={handleExportPdf}
              className="border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            >
              导出 PDF
            </button>
            <Link href="/admin" className="border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50">
              返回后台
            </Link>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-5 print:mt-0">
          <div className="report-print-block sysu-card min-h-[200px] px-7 py-8 print:min-h-0">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">总体结论</p>
            <p className="mt-4 text-2xl font-semibold leading-snug text-slate-950 print:text-lg">{report.conclusion || "风控评估生成中"}</p>
            <p className="mt-5 text-sm leading-8 text-slate-500 print:leading-6">{report.summary}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
            <ScoreCard label="合规风险分" value={`${report.riskScore}`} tone={report.riskScore >= 60 ? "high" : "low"} score={report.riskScore} />
            <ScoreCard label="项目金额" value={report.amount || ""} tone="neutral" />
          </div>
          <RiskBar score={report.riskScore} className="hidden print:block" />
        </div>

        <RiskTableSection rows={riskRows} printMode={isPrinting} />
      </section>

      <aside className="no-print flex flex-col gap-5">
        <div className="sysu-card px-7 py-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">接口说明</p>
          <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
            <p>风控报告经 /api/reports/:id 加载，与合规申报数据同源存储。</p>
            <p>导出 PDF 使用浏览器「另存为 PDF」，版式按当前风险项自适应排版。</p>
            <p>缺失凭证在报告中保持留白，不生成虚假占位内容。</p>
          </div>
        </div>

        <RiskBar score={report.riskScore} />
      </aside>
    </div>
  );
}

function RiskBar({ score, className = "" }: { score: number; className?: string }) {
  const width = Math.min(score, 100);
  return (
    <div className={`sysu-card px-7 py-8 ${className}`}>
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">风险条</p>
      <div className="mt-6 h-3 rounded-md border border-slate-200 bg-white">
        <div className="h-3 rounded-md bg-[#E34234]" style={{ width: `${width}%` }} />
      </div>
      <p className="mt-5 text-sm leading-7 text-slate-500 print:text-xs print:leading-5">
        合规风险分 {Math.round(width)} / 100，分值越高越需优先复核。
      </p>
    </div>
  );
}

function RiskTableSection({ rows, printMode }: { rows: ReportData["riskRows"]; printMode?: boolean }) {
  const tags = [...new Set(rows.map((row) => row.tag))];
  const [selectedTags, setSelectedTags] = useState<string[]>(tags);

  useEffect(() => {
    setSelectedTags([...new Set(rows.map((row) => row.tag))]);
  }, [rows]);

  useEffect(() => {
    const onBeforePrint = () => setSelectedTags([...new Set(rows.map((row) => row.tag))]);
    window.addEventListener("beforeprint", onBeforePrint);
    return () => window.removeEventListener("beforeprint", onBeforePrint);
  }, [rows]);

  const exportAllRows = printMode === true;
  const allSelected = selectedTags.length === tags.length;
  const filteredRows = exportAllRows || allSelected ? rows : rows.filter((row) => selectedTags.includes(row.tag));

  function toggleTag(tag: string) {
    setSelectedTags((current) => {
      if (current.includes(tag)) {
        return current.filter((item) => item !== tag);
      }
      return [...current, tag];
    });
  }

  function selectAllTags() {
    setSelectedTags(tags);
  }

  return (
    <div className="report-print-block sysu-card mt-8 px-7 py-8 print:mt-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-slate-950 print:text-base">风险表格提醒</h3>
        <p className="text-sm text-slate-500 no-print">按问题标签筛选查看</p>
      </div>

      <div className="report-print-table-wrap mt-6 -mx-1 overflow-x-auto print:mx-0">
        <table className="report-print-table w-full min-w-[640px] border-collapse text-sm print:min-w-0">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
              <th className="px-4 py-3 font-semibold whitespace-nowrap w-[72px]">序号</th>
              <th className="px-4 py-3 font-semibold whitespace-nowrap min-w-[120px]">物品/服务</th>
              <th className="px-4 py-3 font-semibold whitespace-nowrap w-[96px]">金额(元)</th>
              <th className="px-4 py-3 font-semibold whitespace-nowrap w-[120px]">问题标签</th>
              <th className="px-3 py-3 font-semibold">风险说明</th>
              <th className="px-3 py-3 font-semibold w-[108px]">处理建议</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  请选择至少一个问题标签以查看对应风险项
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={`${row.seq}-${row.item}`} className="border-b border-slate-100 align-top">
                  <td className="px-4 py-4 font-medium text-slate-900">{row.seq}</td>
                  <td className="px-4 py-4 text-slate-800">{row.item}</td>
                  <td className="px-4 py-4 text-slate-700">{row.amount}</td>
                  <td className="px-4 py-4">
                    <span className="inline-block rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                      {row.tag}
                    </span>
                  </td>
                  <td className="px-3 py-4 leading-7 text-slate-600">{row.riskDesc}</td>
                  <td className="px-3 py-4 leading-7 text-slate-700">{row.suggestion}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="no-print mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-5">
        <span className="text-sm font-medium text-slate-600">问题标签：</span>
        <button
          type="button"
          onClick={selectAllTags}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
            allSelected
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          全选
        </button>
        {tags.map((tag) => {
          const active = selectedTags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "border-[#E34234] bg-[#E34234]/10 text-[#c7352a]"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScoreCard({ label, value, tone, score }: { label: string; value: string; tone: "high" | "low" | "neutral"; score?: number; }) {
  const toneClass = tone === "high" ? "bg-white text-slate-900 border-slate-200" : tone === "low" ? "bg-white text-slate-900 border-slate-200" : "bg-white text-slate-700 border-slate-200";
  const normalizedScore = typeof score === "number" ? Math.min(Math.max(score, 0), 100) : null;
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = normalizedScore === null ? circumference : circumference * (1 - normalizedScore / 100);
  return (
    <div className={`report-print-block min-h-[132px] rounded-md border p-5 print:min-h-0 ${toneClass}`}>
      <p className="text-sm font-medium">{label}</p>
      {normalizedScore === null ? (
        <p className="mt-2 text-xl font-semibold tracking-tight">{value}</p>
      ) : (
        <div className="mt-3 flex items-center gap-4">
          <div className="relative h-16 w-16">
            <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="6" />
              <circle
                cx="32"
                cy="32"
                r={radius}
                fill="none"
                stroke="#f97316"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
              />
            </svg>
            <span className="absolute inset-0 grid place-items-center text-lg font-semibold text-slate-900">
              {Math.round(normalizedScore)}
            </span>
          </div>
          <div className="text-xs text-slate-500">满分 100</div>
        </div>
      )}
    </div>
  );
}
