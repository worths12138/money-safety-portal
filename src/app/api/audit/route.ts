import { getFullAuditRulesPrompt } from "@/lib/compliance-rules";
import { rateLimit, getClientTimeoutHeader } from "@/lib/server-guards";
import { fetchZhipuChatCompletions } from "@/lib/zhipu-upstream";
import { getZhipuModelId, resolveZhipuAuthorization, type ZhipuMessage } from "@/lib/zhipu";

export const maxDuration = 60;

export async function POST(request: Request) {
  const limited = rateLimit(request, "audit-post", 8, 60_000);
  if (!limited.allowed) {
    return new Response(JSON.stringify({ error: "审核请求过于频繁，请稍后重试。" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        ...getClientTimeoutHeader(limited.resetAt),
      },
    });
  }

  let body: { messages?: ZhipuMessage[]; system?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "请求体解析失败" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages, system } = body;
  if (!messages?.length) {
    return new Response(JSON.stringify({ error: "缺少 messages" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let fullRulesPrompt = "";
  try {
    fullRulesPrompt = await getFullAuditRulesPrompt();
  } catch {
    /* 规则读取失败时仍继续审核，仅使用请求内规则 */
  }

  const mergedSystem = [system, fullRulesPrompt].filter(Boolean).join("\n\n");
  const glmMessages = mergedSystem
    ? [{ role: "system", content: mergedSystem }, ...messages]
    : messages;

  let authorization: string;
  try {
    authorization = await resolveZhipuAuthorization();
  } catch (e) {
    const message = e instanceof Error ? e.message : "鉴权失败";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let upstream: Response;
  try {
    upstream = await fetchZhipuChatCompletions({
      authorization,
      body: {
        model: getZhipuModelId(),
        messages: glmMessages,
        stream: true,
        max_tokens: 4096,
        temperature: 0.3,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "智谱 API 调用失败";
    const status = message.includes("速率限制") ? 429 : 502;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
