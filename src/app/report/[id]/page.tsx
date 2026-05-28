"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { RiskAmountPieChart } from "@/components/RiskAmountPieChart";
import { exportReportPdf } from "@/lib/export-report-pdf";
import { formatConclusionForDisplay, formatSummaryForDisplay } from "@/lib/parse-audit-report";
import {
  adjustRiskScoreForAmountMismatch,
  parseAmountReconFromAiNotes,
} from "@/lib/amount-reconciliation";
import {
  adjustRiskScoreForDeclaredAmount,
  detectAmountAnomaly,
  parseAmountLimitYuan,
  parseDeclaredAmountYuan,
  RISK_SCORE_DEFINITION,
  riskLevelFromScore,
  riskScoreRingColor,
} from "@/lib/risk-score";
import { defaultRules } from "@/lib/site-data";
import { defaultRiskRows, type ReportData, reportMaterialTypes } from "@/lib/site-data";
import { normalizeRiskRowsForAmount, riskRowsForTableDisplay } from "@/lib/risk-amount-breakdown";
import { ReportMaterialsPanel } from "@/components/ReportMaterialsPanel";
import {
  type MaterialCacheInfo,
  MATERIAL_CACHE_TTL_SEC,
  reportHadVisionAudit,
  reportPendingAgentReview,
} from "@/lib/report-material-status";
import type { UserRole } from "@/lib/auth/types";
import { resolvePortalRole } from "@/lib/portal-nav";

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
  const pathname = usePathname();
  const [authPortalRole, setAuthPortalRole] = useState<UserRole | null>(null);
  const pathStudent = pathname?.startsWith("/student") ?? false;
  const pathTeacher = pathname?.startsWith("/teacher") ?? false;
  const isStudentPortal = pathStudent || authPortalRole === "student";
  const isTeacherPortal = pathTeacher || authPortalRole === "teacher";
  const backHref = isStudentPortal
    ? "/student/status"
    : isTeacherPortal
      ? "/teacher/queue"
      : "/admin";
  const backLabel = isStudentPortal
    ? "返回进度查询"
    : isTeacherPortal
      ? "返回复核队列"
      : "返回后台";
  const preauditHref = isStudentPortal ? "/student/preaudit" : "/preaudit";
  const teacherQueueHref = "/teacher/queue";
  const [report, setReport] = useState<ReportData>(() => loadingReport(id));
  const [message, setMessage] = useState("正在拉取风控报告...");
  const [isPrinting, setIsPrinting] = useState(false);
  const [exportedAt, setExportedAt] = useState("");
  const [rerunningAgent, setRerunningAgent] = useState(false);
  const [materialCache, setMaterialCache] = useState<MaterialCacheInfo>({
    available: false,
    count: 0,
    ttlSecondsLeft: 0,
    fileNames: [],
  });

  const hadVisionAudit = useMemo(() => reportHadVisionAudit(report.aiNotes ?? []), [report.aiNotes]);
  const pendingAgent = useMemo(() => reportPendingAgentReview(report), [report]);
  const canRerunVision = materialCache.available && materialCache.ttlSecondsLeft > 0;
  const cacheExpired = hadVisionAudit && !canRerunVision;

  useEffect(() => {
    setExportedAt(new Date().toLocaleString("zh-CN"));
  }, []);

  useEffect(() => {
    if (pathStudent || pathTeacher) return;
    if (!pathname?.startsWith("/report")) return;
    if (resolvePortalRole(pathname) !== "legacy") return;
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data: { profile?: { role?: UserRole } | null }) => {
        if (cancelled) return;
        const role = data.profile?.role;
        if (role === "student" || role === "teacher") setAuthPortalRole(role);
      })
      .catch(() => {
        if (!cancelled) setAuthPortalRole(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pathStudent, pathTeacher, pathname]);

  const handleExportPdf = useCallback(() => {
    setExportedAt(new Date().toLocaleString("zh-CN"));
    exportReportPdf({
      reportId: id,
      projectName: report.projectName,
      onPrepare: () => setIsPrinting(true),
      onFinish: () => setIsPrinting(false),
    });
  }, [id, report.projectName]);

  const loadReport = useCallback(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12_000);

    return fetch(`/api/reports/${id}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { message?: string };
          throw new Error(payload.message ?? "风控报告加载失败");
        }
        return response.json();
      })
      .then((payload: { report: ReportData; materialCache?: MaterialCacheInfo }) => {
        setReport(payload.report);
        if (payload.materialCache) {
          setMaterialCache(payload.materialCache);
        }
        setMessage("风控报告已加载完成。");
      })
      .catch((error: unknown) => {
        setMessage(
          error instanceof DOMException && error.name === "AbortError"
            ? "风控报告请求超时。"
            : error instanceof Error
              ? error.message
              : "风控报告加载失败。",
        );
      })
      .finally(() => window.clearTimeout(timer));
  }, [id]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useEffect(() => {
    if (!materialCache.available) return;
    const timer = window.setInterval(() => {
      setMaterialCache((prev) => {
        if (!prev.available) return prev;
        const next = prev.ttlSecondsLeft - 1;
        if (next <= 0) {
          return { ...prev, available: false, ttlSecondsLeft: 0 };
        }
        return { ...prev, ttlSecondsLeft: next };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [materialCache.available]);

  const handleRerunAgent = useCallback(async () => {
    if (cacheExpired) {
      setMessage(`凭证暂存已过期（${MATERIAL_CACHE_TTL_SEC} 秒），请返回预审核页重新上传后再评估。`);
      return;
    }
    setRerunningAgent(true);
    setMessage(
      canRerunVision
        ? `正在使用服务端暂存的 ${materialCache.count} 份凭证重新识图评估（约 30–120 秒）…`
        : "正在调用 GLM-5V-Turbo 重新评估（约 30–60 秒）…",
    );
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), MATERIAL_CACHE_TTL_SEC * 1000);
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
        report?: ReportData;
        materialCache?: MaterialCacheInfo;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? "Agent 评估失败");
      }
      if (payload.report) {
        setReport(payload.report);
      } else {
        await loadReport();
      }
      if (payload.materialCache) {
        setMaterialCache(payload.materialCache);
      }
      setMessage(payload.message ?? "Agent 评估已完成。");
    } catch (error) {
      setMessage(
        error instanceof DOMException && error.name === "AbortError"
          ? "Agent 评估超时，请稍后重试。"
          : error instanceof Error
            ? error.message
            : "Agent 评估失败。",
      );
    } finally {
      window.clearTimeout(timer);
      setRerunningAgent(false);
    }
  }, [cacheExpired, canRerunVision, id, loadReport, materialCache.count]);

  const rawRiskRows = useMemo(
    () => (report.riskRows?.length ? report.riskRows : defaultRiskRows),
    [report.riskRows],
  );
  const riskRowsForTable = useMemo(
    () => riskRowsForTableDisplay(rawRiskRows, report.amount || ""),
    [rawRiskRows, report.amount],
  );
  const riskRowsForChart = useMemo(
    () => normalizeRiskRowsForAmount(rawRiskRows, report.amount || ""),
    [rawRiskRows, report.amount],
  );
  const auditMarkdown =
    report.aiNotes?.find((note) => note.includes("##") || note.length > 400) ?? report.aiNotes?.join("\n");
  const amountRecon = parseAmountReconFromAiNotes(report.aiNotes ?? []);
  let effectiveRiskScore = adjustRiskScoreForDeclaredAmount(report.amount || "", report.riskScore, {
    amountLimitYuan: parseAmountLimitYuan(defaultRules.amountLimit),
  });
  effectiveRiskScore = adjustRiskScoreForAmountMismatch(effectiveRiskScore, amountRecon);
  const amountAnomaly = detectAmountAnomaly(parseDeclaredAmountYuan(report.amount || ""));
  const displayConclusion = formatConclusionForDisplay(report.conclusion || "", effectiveRiskScore);
  const displaySummary = formatSummaryForDisplay(report.summary || "");

  return (
    <div className="report-print-root mx-auto flex w-full max-w-6xl flex-col gap-8 print:max-w-none">
      <section className="report-print-section sysu-card px-7 py-9 print:shadow-none">
        <div className="hidden print:block report-print-block border-0 px-0 py-0 mb-6">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">中山大学软件工程学院 · 大创报销经费合规风控</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">大创报销经费合规风控报告</h1>
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
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">大创报销经费合规风控报告</h2>
            <p className="mt-2 text-sm text-slate-500">{message}</p>
            {pendingAgent ? (
              <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                本条尚未完成 AI 初审。请由教师在{" "}
                <Link href={teacherQueueHref} className="font-semibold underline">
                  教师复核队列
                </Link>{" "}
                点击「AI 初审」，或在本页下方使用「重新识图评估」（凭证暂存有效期内）。
              </p>
            ) : null}
            {canRerunVision ? (
              <p className="mt-1 text-xs text-emerald-700">
                凭证暂存可用：{materialCache.count} 份，剩余 {materialCache.ttlSecondsLeft} 秒后可重新识图评估
              </p>
            ) : cacheExpired ? (
              <p className="mt-1 text-xs text-amber-800">
                凭证暂存已过期（提交后 {MATERIAL_CACHE_TTL_SEC} 秒内可重评）。请{" "}
                <Link href={preauditHref} className="font-semibold underline">
                  {isStudentPortal ? "返回提交申报" : "返回预审核"}
                </Link>{" "}
                重新上传凭证。
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            {isTeacherPortal || (!isStudentPortal && !isTeacherPortal) ? (
              <button
                type="button"
                onClick={handleRerunAgent}
                disabled={rerunningAgent || cacheExpired}
                className="border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {rerunningAgent
                  ? "Agent 评估中…"
                  : canRerunVision
                    ? "重新识图评估"
                    : cacheExpired
                      ? "暂存已过期"
                      : "重新 Agent 评估"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleExportPdf}
              className="border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            >
              导出 PDF
            </button>
            <Link
              href={backHref}
              className="border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            >
              {backLabel}
            </Link>
            {isStudentPortal ? (
              <Link
                href="/student"
                className="border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                学生首页
              </Link>
            ) : null}
            {isTeacherPortal ? (
              <Link
                href="/teacher/dashboard"
                className="border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                数据看板
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-5 print:mt-0">
          <div className="report-print-block sysu-card min-h-[200px] px-7 py-8 print:min-h-0">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-slate-500">总体结论</p>
            <p className="mt-3 text-base font-semibold leading-relaxed text-slate-950 sm:text-lg print:text-base">
              {displayConclusion || "风控评估生成中"}
            </p>
            <p className="mt-4 text-[13px] leading-7 text-slate-600 print:text-sm print:leading-6">{displaySummary}</p>
          </div>
          {amountAnomaly ? (
            <div className="report-print-block rounded-md border border-red-200 bg-red-50 px-5 py-4 text-sm leading-7 text-red-900">
              <p className="font-semibold">金额异常告警</p>
              <p className="mt-1">{amountAnomaly.message}</p>
              {report.riskScore < effectiveRiskScore ? (
                <p className="mt-2 text-xs text-red-800/90">
                  系统已根据申报金额将风险分由 {report.riskScore} 上调至 {effectiveRiskScore}（Agent 原始分偏低时已自动校正）。
                </p>
              ) : null}
            </div>
          ) : null}
          {amountRecon && amountRecon.severity !== "ok" ? (
            <div
              className={`report-print-block rounded-md border px-5 py-4 text-sm leading-7 ${
                amountRecon.severity === "critical"
                  ? "border-amber-300 bg-amber-50 text-amber-950"
                  : "border-amber-200 bg-amber-50/80 text-amber-900"
              }`}
            >
              <p className="font-semibold">申报总金额与凭据金额不一致</p>
              <p className="mt-1">{amountRecon.message}</p>
              {amountRecon.voucherYuan > 0 ? (
                <p className="mt-2 text-xs opacity-90">
                  凭据识别合计约 ¥{amountRecon.voucherYuan.toLocaleString("zh-CN")}（置信度：
                  {amountRecon.voucherSummary.confidence}），申报总金额 {report.amount || "—"}。
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
            <ScoreCard
              label="合规风控风险分"
              value={`${effectiveRiskScore}`}
              score={effectiveRiskScore}
              riskLevel={riskLevelFromScore(effectiveRiskScore)}
            />
            <ScoreCard label="项目总金额" value={report.amount || "—"} />
          </div>
          <RiskAmountPieChart
            declaredAmount={report.amount || ""}
            riskRows={riskRowsForChart}
            riskScore={effectiveRiskScore}
            markdown={auditMarkdown}
          />
          <RiskBar score={effectiveRiskScore} className="hidden print:block" />
        </div>

        <ReportMaterialsPanel reportId={id} initialCache={materialCache} />

        <RiskTableSection
          rows={riskRowsForTable}
          printMode={isPrinting}
          pendingAgent={pendingAgent}
        />
      </section>

      <aside className="no-print flex flex-col gap-5">
        <div className="sysu-card px-7 py-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">接口说明</p>
          <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
            <p>风控报告经 /api/reports/:id 加载；可由 /api/agent/review（GLM-5V-Turbo）生成并回写风险分与表格。</p>
            <p>导出 PDF 使用浏览器「另存为 PDF」，版式按当前风险项自适应排版。</p>
            <p>缺失凭证在报告中保持留白，不生成虚假占位内容。</p>
          </div>
        </div>

        <RiskBar score={effectiveRiskScore} />
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
        合规风控风险分 {Math.round(width)} / 100（越高风险越大），{riskLevelFromScore(width)}风险，越需优先复核。
      </p>
    </div>
  );
}

function RiskTableSection({
  rows,
  printMode,
  pendingAgent,
}: {
  rows: ReportData["riskRows"];
  printMode?: boolean;
  pendingAgent?: boolean;
}) {
  const tags = [...new Set(rows.map((row) => row.tag).filter(Boolean))];
  const [selectedTags, setSelectedTags] = useState<string[]>(tags);

  useEffect(() => {
    setSelectedTags([...new Set(rows.map((row) => row.tag).filter(Boolean))]);
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
        <table className="report-risk-table report-print-table w-full min-w-[960px] border-collapse text-sm print:min-w-0">
          <colgroup>
            <col className="w-14" />
            <col className="w-[14%]" />
            <col className="w-24" />
            <col className="w-[11%]" />
            <col />
            <col className="w-[28%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
              <th className="px-4 py-3 font-semibold whitespace-nowrap">序号</th>
              <th className="px-4 py-3 font-semibold whitespace-nowrap">物品/服务</th>
              <th className="px-4 py-3 font-semibold whitespace-nowrap">金额(元)</th>
              <th className="px-4 py-3 font-semibold whitespace-nowrap">问题标签</th>
              <th className="px-4 py-3 font-semibold min-w-[10rem]">风险说明</th>
              <th className="px-4 py-3 font-semibold min-w-[12rem]">处理建议</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  {rows.length === 0
                    ? pendingAgent
                      ? "尚未完成 AI 初审：请教师在复核队列点击「AI 初审」，或确认申报后暂存未过期。"
                      : "暂无风险表数据。若已完成初审仍为空，请重新发起 AI 初审。"
                    : "请选择至少一个问题标签以查看对应风险项（可点「全选」）"}
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
                  <td className="px-4 py-4 leading-7 text-slate-600">{row.riskDesc}</td>
                  <td className="px-4 py-4 leading-relaxed text-slate-700">{row.suggestion}</td>
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

function ScoreCard({
  label,
  value,
  score,
  riskLevel,
}: {
  label: string;
  value: string;
  score?: number;
  riskLevel?: "低" | "中" | "高";
}) {
  const normalizedScore = typeof score === "number" ? Math.min(Math.max(score, 0), 100) : null;
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = normalizedScore === null ? circumference : circumference * (1 - normalizedScore / 100);
  const ringColor = normalizedScore === null ? "#94a3b8" : riskScoreRingColor(normalizedScore);
  const levelBadge =
    riskLevel === "高"
      ? "border-red-200 bg-red-50 text-red-800"
      : riskLevel === "中"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return (
    <div className="report-print-block min-h-[132px] rounded-md border border-slate-200 bg-white p-5 print:min-h-0">
      <p className="text-sm font-medium text-slate-800">{label}</p>
      {normalizedScore !== null ? (
        <p className="mt-1 text-[11px] leading-5 text-slate-500">{RISK_SCORE_DEFINITION}</p>
      ) : null}
      {normalizedScore === null ? (
        <p className="mt-2 text-xl font-semibold tracking-tight text-slate-900">{value}</p>
      ) : (
        <div className="mt-3 flex items-center gap-4">
          <div className="relative h-16 w-16 shrink-0">
            <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="6" />
              <circle
                cx="32"
                cy="32"
                r={radius}
                fill="none"
                stroke={ringColor}
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
          <div className="min-w-0 space-y-1.5">
            {riskLevel ? (
              <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${levelBadge}`}>
                {riskLevel}风险
              </span>
            ) : null}
            <p className="text-xs text-slate-500">满分 100 · 越高越危险</p>
          </div>
        </div>
      )}
    </div>
  );
}
