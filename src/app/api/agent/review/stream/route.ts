import { authErrorResponse } from "@/lib/auth/session";
import {
  agentReviewStreamErrorResponse,
  agentReviewStreamResponse,
  ensureAgentReviewStreamReady,
} from "@/lib/agent-review-stream-handler";
import { AGENT_REVIEW_SSE_HEADERS } from "@/lib/agent-review-sse";
import type { AgentReviewInput } from "@/lib/agent-review";
import { getClientTimeoutHeader, withTimeout } from "@/lib/server-guards";

export const maxDuration = 300;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseReportId(request: Request): string | null {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("reportId")?.trim();
  if (fromQuery) return fromQuery;
  return null;
}

/** EventSource 专用 GET，浏览器对 SSE 支持更稳定 */
export async function GET(request: Request) {
  const blocked = ensureAgentReviewStreamReady(request);
  if (blocked) return blocked;

  const reportId = parseReportId(request);
  if (!reportId) {
    return agentReviewStreamErrorResponse("缺少 reportId。");
  }

  return agentReviewStreamResponse({ reportId });
}

export async function POST(request: Request) {
  const blocked = ensureAgentReviewStreamReady(request);
  if (blocked) return blocked;

  let body: AgentReviewInput;
  try {
    body = (await withTimeout(request.json(), 30_000)) as AgentReviewInput;
    if (!body.reportId?.trim()) {
      return agentReviewStreamErrorResponse("缺少 reportId。");
    }
  } catch (error) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;

    const message = error instanceof Error ? error.message : "请求解析失败";
    return new Response(`event: fatal\ndata: ${JSON.stringify({ message })}\n\n`, {
      status: 400,
      headers: AGENT_REVIEW_SSE_HEADERS,
    });
  }

  return agentReviewStreamResponse({
    reportId: body.reportId.trim(),
    extraText: body.extraText,
    materialFiles: body.materialFiles,
    materials: body.materials,
  });
}
