import { getTeacherIfAuth } from "@/lib/auth/api-guard";
import { checkTeacherAgentQuota } from "@/lib/auth/teacher-agent-limit";
import { runAgentReviewStream, type AgentReviewInput } from "@/lib/agent-review";
import {
  AGENT_REVIEW_SSE_HEADERS,
  createAgentReviewSseStream,
} from "@/lib/agent-review-sse";
import { ensureSupabaseConfigured } from "@/lib/api-config";
import { agentReviewTimeoutMs } from "@/lib/material-limits";
import { getMaterialCacheStatus } from "@/lib/report-material-cache-server";
import { getReportById } from "@/lib/submissions-db";
import { rateLimit, getClientTimeoutHeader, withTimeout } from "@/lib/server-guards";

export function agentReviewStreamRateLimited(request: Request) {
  return rateLimit(request, "agent-review-stream", 6, 60_000);
}

export function agentReviewStreamResponse(input: AgentReviewInput) {
  const stream = createAgentReviewSseStream(async (send) => {
    send("progress", { step: "load", label: "服务端已连接，正在验证权限…" });

    const teacher = await getTeacherIfAuth();
    if (teacher) {
      const quota = checkTeacherAgentQuota(teacher.id);
      if (!quota.allowed) {
        send("fatal", { message: quota.message });
        return;
      }
    }

    send("progress", { step: "load", label: "权限验证通过，开始加载申报…" });

    const result = await withTimeout(
      runAgentReviewStream(input, {
        onProgress: (step, label) => send("progress", { step, label }),
        onDelta: (markdown) => send("delta", { markdown }),
      }),
      agentReviewTimeoutMs(),
      "Agent 识图评估超时，请稍后在报告页重试；凭证较多时可减少文件数或稍后重试。",
    );

    const report = await getReportById(result.reportId);
    send("done", {
      ok: true,
      message: "Agent 已完成风控评估并回写报告。",
      reportId: result.reportId,
      riskScore: result.riskScore,
      annotations: result.annotations,
      report,
      materialCache: getMaterialCacheStatus(result.reportId),
    });
  });

  return new Response(stream, { headers: AGENT_REVIEW_SSE_HEADERS });
}

export function agentReviewStreamErrorResponse(message: string, status = 400) {
  return new Response(`event: fatal\ndata: ${JSON.stringify({ message })}\n\n`, {
    status,
    headers: AGENT_REVIEW_SSE_HEADERS,
  });
}

export function ensureAgentReviewStreamReady(request: Request) {
  const configError = ensureSupabaseConfigured();
  if (configError) {
    return configError;
  }

  const limited = agentReviewStreamRateLimited(request);
  if (!limited.allowed) {
    return agentReviewStreamErrorResponse("Agent 风控请求过于频繁。", 429);
  }

  return null;
}
