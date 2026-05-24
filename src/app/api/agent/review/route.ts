import { NextResponse } from "next/server";
import { runAgentReview, type AgentReviewInput } from "@/lib/agent-review";
import { ensureSupabaseConfigured } from "@/lib/api-config";
import { getMaterialCacheStatus } from "@/lib/report-material-cache-server";
import { getReportById } from "@/lib/submissions-db";
import { rateLimit, getClientTimeoutHeader, timeoutResponse, withTimeout } from "@/lib/server-guards";

export const maxDuration = 300;

type AgentReviewBody = AgentReviewInput;

export async function POST(request: Request) {
  const configError = ensureSupabaseConfigured();
  if (configError) {
    return configError;
  }

  const limited = rateLimit(request, "agent-review", 6, 60_000);
  if (!limited.allowed) {
    return NextResponse.json(
      { ok: false, message: "Agent 风控请求过于频繁。" },
      { status: 429, headers: getClientTimeoutHeader(limited.resetAt) },
    );
  }

  try {
    const body = (await withTimeout(request.json(), 30_000)) as AgentReviewBody;
    if (!body.reportId?.trim()) {
      return NextResponse.json({ ok: false, message: "缺少 reportId。" }, { status: 400 });
    }

    const result = await withTimeout(
      runAgentReview({
        reportId: body.reportId.trim(),
        extraText: body.extraText,
        materialFiles: body.materialFiles,
        materials: body.materials,
      }),
      240_000,
      "Agent 识图评估超时，请稍后在报告页重试。",
    );

    const report = await getReportById(result.reportId);

    return NextResponse.json({
      ok: true,
      message: "Agent 已完成风控评估并回写报告。",
      reportId: result.reportId,
      riskScore: result.riskScore,
      annotations: result.annotations,
      report,
      materialCache: getMaterialCacheStatus(result.reportId),
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("超时")) {
      return timeoutResponse(error.message, 504);
    }

    const message =
      error instanceof Error
        ? error.message.includes("ZHIPU")
          ? "未配置或无法使用智谱 API，请在 .env.local 设置 ZHIPU_API_KEY。"
          : error.message
        : "Agent 风控评估失败。";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
