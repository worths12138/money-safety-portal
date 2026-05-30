import { AGENT_REVIEW_SSE_HEADERS, createAgentReviewSseStream } from "@/lib/agent-review-sse";

export const dynamic = "force-dynamic";

/** 无需 reportId，用于 curl / 浏览器验证 SSE 是否通畅 */
export async function GET() {
  const stream = createAgentReviewSseStream(async (send) => {
    send("progress", { step: "load", label: "SSE 测试：通道正常" });
    await new Promise((r) => setTimeout(r, 500));
    send("done", {
      ok: true,
      message: "SSE 测试成功",
      reportId: "test",
      riskScore: 0,
      annotations: [],
    });
  });

  return new Response(stream, { headers: AGENT_REVIEW_SSE_HEADERS });
}
