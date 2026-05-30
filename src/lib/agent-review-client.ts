import type { AgentReviewProgressStep } from "@/lib/agent-review";
import type { MaterialCacheInfo } from "@/lib/report-material-status";
import type { ReportData } from "@/lib/site-data";

export type AgentReviewStreamProgress = {
  step: AgentReviewProgressStep;
  label: string;
};

export type AgentReviewStreamDone = {
  ok: true;
  message: string;
  reportId: string;
  riskScore: number;
  annotations: string[];
  report?: ReportData;
  materialCache?: MaterialCacheInfo;
};

export type AgentReviewStreamCallbacks = {
  onProgress?: (progress: AgentReviewStreamProgress) => void;
  onDelta?: (markdown: string) => void;
  onDone?: (payload: AgentReviewStreamDone) => void;
  onError?: (message: string) => void;
};

function parseSseBlock(block: string): { event: string; data: string } | null {
  const lines = block.split("\n");
  let event = "message";
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("event: ")) {
      event = line.slice(7).trim();
    } else if (line.startsWith("data: ")) {
      dataLines.push(line.slice(6));
    }
  }
  if (!dataLines.length) return null;
  return { event, data: dataLines.join("\n") };
}

/** 调用流式 Agent 初审，通过 SSE 接收进度与 Markdown 预览 */
export async function streamAgentReview(
  reportId: string,
  callbacks: AgentReviewStreamCallbacks,
  signal?: AbortSignal,
) {
  const response = await fetch("/api/agent/review/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reportId }),
    signal,
  });

  if (!response.ok && !response.body) {
    const text = await response.text().catch(() => "");
    try {
      const parsed = JSON.parse(text) as { message?: string };
      throw new Error(parsed.message ?? `请求失败 ${response.status}`);
    } catch (error) {
      if (error instanceof Error && error.message !== text) throw error;
      throw new Error(text || `请求失败 ${response.status}`);
    }
  }

  if (!response.body) {
    throw new Error("响应体为空");
  }

  const reader = response.body.getReader();
  const dec = new TextDecoder();
  let buffer = "";
  let donePayload: AgentReviewStreamDone | null = null;
  let errorMessage: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += dec.decode(value, { stream: true });

    let splitAt = buffer.indexOf("\n\n");
    while (splitAt >= 0) {
      const block = buffer.slice(0, splitAt);
      buffer = buffer.slice(splitAt + 2);
      const parsed = parseSseBlock(block);
      if (parsed) {
        try {
          const payload = JSON.parse(parsed.data) as Record<string, unknown>;
          if (parsed.event === "progress") {
            callbacks.onProgress?.({
              step: payload.step as AgentReviewProgressStep,
              label: String(payload.label ?? ""),
            });
          } else if (parsed.event === "delta") {
            callbacks.onDelta?.(String(payload.markdown ?? ""));
          } else if (parsed.event === "done") {
            donePayload = payload as unknown as AgentReviewStreamDone;
            callbacks.onDone?.(donePayload);
          } else if (parsed.event === "error") {
            errorMessage = String(payload.message ?? "Agent 评估失败");
            callbacks.onError?.(errorMessage);
          }
        } catch {
          /* ignore malformed SSE payload */
        }
      }
      splitAt = buffer.indexOf("\n\n");
    }
  }

  if (errorMessage) {
    throw new Error(errorMessage);
  }
  if (!donePayload) {
    throw new Error("连接意外中断，请稍后重试。");
  }

  return donePayload;
}

export const GENERATING_STEPS: Array<{
  step: AgentReviewProgressStep;
  title: string;
}> = [
  { step: "load", title: "准备审核" },
  { step: "pdf_extract", title: "提取凭证" },
  { step: "image_ocr", title: "识别金额" },
  { step: "generating", title: "生成报告" },
  { step: "parsing", title: "写入报告" },
];

export function stepIndex(step: AgentReviewProgressStep): number {
  const idx = GENERATING_STEPS.findIndex((item) => item.step === step);
  return idx >= 0 ? idx : 0;
}
