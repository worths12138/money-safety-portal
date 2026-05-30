"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  GENERATING_STEPS,
  stepIndex,
  type AgentReviewStreamProgress,
} from "@/lib/agent-review-client";
import type { AgentReviewProgressStep } from "@/lib/agent-review";
import { STREAM_UI_VERSION } from "@/lib/stream-ui-version";

type Props = {
  projectName: string;
  progress: AgentReviewStreamProgress | null;
  streamMarkdown: string;
  error?: string;
};

function StreamMarkdownPreview({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  if (!text) return null;

  return (
    <div className="mt-6 rounded-md border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-700"
      >
        <span>查看 AI 生成过程（流式预览）</span>
        <span className="text-xs text-slate-500">{open ? "收起" : "展开"}</span>
      </button>
      {open ? (
        <pre className="max-h-72 overflow-auto border-t border-slate-200 px-4 py-3 text-xs leading-6 text-slate-700 whitespace-pre-wrap">
          {text}
        </pre>
      ) : null}
    </div>
  );
}

function StepIndicator({
  activeStep,
  activeLabel,
}: {
  activeStep: AgentReviewProgressStep;
  activeLabel: string;
}) {
  const activeIndex = stepIndex(activeStep);

  return (
    <ol className="mt-8 space-y-3">
      {GENERATING_STEPS.map((item, index) => {
        const done = index < activeIndex;
        const active = index === activeIndex;
        return (
          <li
            key={item.step}
            className={`flex items-start gap-3 rounded-md border px-4 py-3 text-sm ${
              active
                ? "border-blue-200 bg-blue-50 text-blue-950"
                : done
                  ? "border-emerald-200 bg-emerald-50/80 text-emerald-900"
                  : "border-slate-200 bg-white text-slate-500"
            }`}
          >
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                active
                  ? "bg-blue-600 text-white"
                  : done
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-200 text-slate-600"
              }`}
            >
              {done ? "✓" : index + 1}
            </span>
            <div>
              <p className="font-semibold">{item.title}</p>
              {active && activeLabel ? (
                <p className="mt-1 text-xs leading-6 opacity-90">{activeLabel}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ReportSkeleton() {
  const blocks = ["总体结论", "风险评分", "金额分布", "风险明细表"];
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      {blocks.map((label) => (
        <div
          key={label}
          className="rounded-md border border-slate-200 bg-white p-5 animate-pulse"
          aria-hidden
        >
          <div className="h-3 w-24 rounded bg-slate-200" />
          <div className="mt-4 h-16 rounded bg-slate-100" />
          <p className="mt-3 text-xs text-slate-400">{label}（生成完成后展示）</p>
        </div>
      ))}
    </div>
  );
}

function staleHint(step: AgentReviewProgressStep, staleSec: number): string | null {
  if (staleSec < 12) return null;
  if (step === "load" || step === "pdf_extract") {
    return "仍在处理凭证与规则（Supabase / PDF 解析可能较慢），请稍候…";
  }
  if (step === "image_ocr") {
    return "正在逐张识别凭证金额（每张约 3～10 秒），请稍候…";
  }
  if (step === "generating") {
    return "智谱模型正在生成报告（通常 30～90 秒），可展开下方预览查看输出…";
  }
  if (step === "parsing") {
    return "正在解析并写入报告…";
  }
  return "处理耗时较长，请保持页面打开…";
}

export function ReportGeneratingPanel({ projectName, progress, streamMarkdown, error }: Props) {
  const activeStep = progress?.step ?? "load";
  const activeLabel = progress?.label ?? "正在启动 AI 风控…";
  const [elapsedSec, setElapsedSec] = useState(0);
  const lastProgressAt = useRef(Date.now());

  useEffect(() => {
    lastProgressAt.current = Date.now();
  }, [progress?.step, progress?.label]);

  useEffect(() => {
    if (error) return;
    const timer = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - lastProgressAt.current) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [error, progress?.step, progress?.label]);

  const headline = useMemo(() => {
    if (error) return "生成失败";
    if (activeStep === "done") return "报告即将呈现…";
    return "正在生成风控报告";
  }, [activeStep, error]);

  const hint = staleHint(activeStep, elapsedSec);

  return (
    <section className="sysu-card px-7 py-9">
      <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-700">AI 风控初审</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{headline}</h2>
      <p className="mt-2 text-sm text-slate-600">
        项目：<span className="font-medium text-slate-900">{projectName || "—"}</span>
      </p>
      <p className="mt-1 text-xs text-slate-500">
        正式报告（风险分、饼图、明细表）将在生成完成后一次性展示，版式与 PDF 导出保持一致。
        <br />
        客户端版本：{STREAM_UI_VERSION}（若界面仍显示「正在初始化」说明服务器未部署最新代码）
      </p>

      {error ? (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
            <span>{activeLabel}</span>
            {elapsedSec >= 5 ? (
              <span className="text-xs text-slate-400">当前步骤已进行约 {elapsedSec} 秒</span>
            ) : null}
          </div>
          {hint ? (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-900">
              {hint}
            </p>
          ) : null}
          <StepIndicator activeStep={activeStep} activeLabel={activeLabel} />
          <StreamMarkdownPreview text={streamMarkdown} />
          <ReportSkeleton />
        </>
      )}
    </section>
  );
}
