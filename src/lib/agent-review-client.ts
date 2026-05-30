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

function dispatchSseEvent(
  event: string,
  rawData: string,
  callbacks: AgentReviewStreamCallbacks,
  state: { done?: AgentReviewStreamDone; error?: string },
) {
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(rawData) as Record<string, unknown>;
  } catch {
    return;
  }

  if (event === "progress") {
    callbacks.onProgress?.({
      step: payload.step as AgentReviewProgressStep,
      label: String(payload.label ?? ""),
    });
    return;
  }
  if (event === "delta") {
    callbacks.onDelta?.(String(payload.markdown ?? ""));
    return;
  }
  if (event === "done") {
    state.done = payload as unknown as AgentReviewStreamDone;
    callbacks.onDone?.(state.done);
    return;
  }
  if (event === "fatal") {
    state.error = String(payload.message ?? "Agent 评估失败");
    callbacks.onError?.(state.error);
  }
}

function streamViaEventSource(
  reportId: string,
  callbacks: AgentReviewStreamCallbacks,
  signal?: AbortSignal,
): Promise<AgentReviewStreamDone> {
  return new Promise((resolve, reject) => {
    const state: { done?: AgentReviewStreamDone; error?: string } = {};
    const url = `/api/agent/review/stream?reportId=${encodeURIComponent(reportId)}`;
    const es = new EventSource(url);

    const finish = (error?: Error) => {
      es.close();
      if (error) {
        reject(error);
        return;
      }
      if (state.error) {
        reject(new Error(state.error));
        return;
      }
      if (state.done) {
        resolve(state.done);
        return;
      }
      reject(new Error("连接意外中断，请稍后重试。"));
    };

    const onAbort = () => finish(new DOMException("Aborted", "AbortError"));

    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });

    const bind = (event: string) => {
      es.addEventListener(event, (ev) => {
        const message = ev as MessageEvent<string>;
        dispatchSseEvent(event, message.data, callbacks, state);
        if (event === "done" || event === "fatal") {
          signal?.removeEventListener("abort", onAbort);
          finish(event === "fatal" ? new Error(state.error ?? "Agent 评估失败") : undefined);
        }
      });
    };

    bind("progress");
    bind("delta");
    bind("done");
    bind("fatal");

    es.onerror = () => {
      if (state.done || state.error) return;
      signal?.removeEventListener("abort", onAbort);
      es.close();
      reject(new Error("SSE 连接中断，请检查网络或 Nginx 是否关闭 proxy_buffering。"));
    };
  });
}

async function streamViaFetchPost(
  reportId: string,
  callbacks: AgentReviewStreamCallbacks,
  signal?: AbortSignal,
): Promise<AgentReviewStreamDone> {
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
  const state: { done?: AgentReviewStreamDone; error?: string } = {};

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
        dispatchSseEvent(parsed.event, parsed.data, callbacks, state);
      }
      splitAt = buffer.indexOf("\n\n");
    }
  }

  if (state.error) {
    throw new Error(state.error);
  }
  if (!state.done) {
    throw new Error("连接意外中断，请稍后重试。");
  }
  return state.done;
}

/** 调用流式 Agent 初审；优先 EventSource(GET)，失败时回退 fetch(POST) */
export async function streamAgentReview(
  reportId: string,
  callbacks: AgentReviewStreamCallbacks,
  signal?: AbortSignal,
) {
  callbacks.onProgress?.({ step: "load", label: "正在建立流式连接…" });

  if (typeof EventSource !== "undefined") {
    try {
      return await streamViaEventSource(reportId, callbacks, signal);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      callbacks.onProgress?.({ step: "load", label: "SSE 连接异常，正在改用备用通道…" });
    }
  }

  return streamViaFetchPost(reportId, callbacks, signal);
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
