import { authErrorResponse } from "@/lib/auth/session";
import { getTeacherIfAuth } from "@/lib/auth/api-guard";
import { checkTeacherAgentQuota } from "@/lib/auth/teacher-agent-limit";
import { runAgentReviewStream, type AgentReviewInput } from "@/lib/agent-review";
import { ensureSupabaseConfigured } from "@/lib/api-config";
import { agentReviewTimeoutMs } from "@/lib/material-limits";
import { getMaterialCacheStatus } from "@/lib/report-material-cache-server";
import { getReportById } from "@/lib/submissions-db";
import { rateLimit, getClientTimeoutHeader, withTimeout } from "@/lib/server-guards";

export const maxDuration = 300;

type AgentReviewBody = AgentReviewInput;

function sseEncode(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  const configError = ensureSupabaseConfigured();
  if (configError) {
    return configError;
  }

  const limited = rateLimit(request, "agent-review-stream", 6, 60_000);
  if (!limited.allowed) {
    return new Response(
      sseEncode("error", { message: "Agent 风控请求过于频繁。" }),
      {
        status: 429,
        headers: {
          "Content-Type": "text/event-stream",
          ...getClientTimeoutHeader(limited.resetAt),
        },
      },
    );
  }

  let body: AgentReviewBody;
  try {
    const teacher = await getTeacherIfAuth();
    if (teacher) {
      const quota = checkTeacherAgentQuota(teacher.id);
      if (!quota.allowed) {
        return new Response(sseEncode("error", { message: quota.message }), {
          status: 429,
          headers: { "Content-Type": "text/event-stream" },
        });
      }
    }

    body = (await withTimeout(request.json(), 30_000)) as AgentReviewBody;
    if (!body.reportId?.trim()) {
      return new Response(sseEncode("error", { message: "缺少 reportId。" }), {
        status: 400,
        headers: { "Content-Type": "text/event-stream" },
      });
    }
  } catch (error) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;

    const message = error instanceof Error ? error.message : "请求解析失败";
    return new Response(sseEncode("error", { message }), {
      status: 400,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const reportId = body.reportId.trim();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseEncode(event, data)));
      };

      send("progress", { step: "load", label: "服务端已连接，正在准备审核…" });

      try {
        const result = await withTimeout(
          runAgentReviewStream(
            {
              reportId,
              extraText: body.extraText,
              materialFiles: body.materialFiles,
              materials: body.materials,
            },
            {
              onProgress: (step, label) => send("progress", { step, label }),
              onDelta: (markdown) => send("delta", { markdown }),
            },
          ),
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
      } catch (error) {
        const authRes = authErrorResponse(error);
        if (authRes) {
          const payload = (await authRes.json()) as { message?: string };
          send("error", { message: payload.message ?? "未授权" });
        } else {
          const message =
            error instanceof Error
              ? error.message.includes("ZHIPU") || error.message.includes("智谱")
                ? "未配置或无法使用智谱 API，请在 .env.local 设置 ZHIPU_API_KEY。"
                : error.message
              : "Agent 风控评估失败。";
          send("error", { message });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
