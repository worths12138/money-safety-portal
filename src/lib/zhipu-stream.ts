/** 读取智谱 Chat Completions SSE 响应体，累积全文并回调增量 */
export async function readZhipuStreamBody(
  body: ReadableStream<Uint8Array>,
  onDelta?: (delta: string, full: string) => void,
): Promise<string> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let full = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += dec.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") continue;
      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = parsed.choices?.[0]?.delta?.content ?? "";
        if (delta) {
          full += delta;
          onDelta?.(delta, full);
        }
      } catch {
        /* ignore malformed SSE chunks */
      }
    }
  }

  return full;
}
