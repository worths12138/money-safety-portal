/** SSE 响应头：禁用 Nginx 等反向代理缓冲，便于进度实时到达浏览器 */
export const AGENT_REVIEW_SSE_HEADERS: Record<string, string> = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

/** 部分 Nginx 需靠 padding 才肯立刻把首包推给浏览器 */
const SSE_FLUSH_PAD = `: ${" ".repeat(2048)}\n\n`;

export function sseEncode(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n${SSE_FLUSH_PAD}`;
}

export function sseComment(text: string): string {
  return `: ${text}\n\n${SSE_FLUSH_PAD}`;
}

export function createAgentReviewSseStream(
  run: (send: (event: string, data: unknown) => void) => Promise<void>,
) {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseEncode(event, data)));
      };

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(sseComment("keepalive")));
        } catch {
          clearInterval(heartbeat);
        }
      }, 2000);

      send("progress", { step: "load", label: "流式通道已建立…" });

      try {
        await run(send);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message.includes("ZHIPU") || error.message.includes("智谱")
              ? "未配置或无法使用智谱 API，请在 .env.local 设置 ZHIPU_API_KEY。"
              : error.message
            : "Agent 风控评估失败。";
        send("fatal", { message });
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });
}
