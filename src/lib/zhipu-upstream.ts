const ZHIPU_CHAT_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatZhipuHttpError(status: number, body: string): string {
  if (status === 429 || body.includes("1302") || body.includes("速率限制")) {
    return "智谱账户触发速率限制（1302），请等待 1～2 分钟后再试；多个 PDF 会逐份调用接口，建议先减少文件或改用图片上传。";
  }
  if (status === 401 || body.includes("1002")) {
    return "智谱鉴权失败，请检查 .env.local 中的 ZHIPU_API_KEY 与 ZHIPU_AUTH（推荐 bearer）。";
  }
  if (status === 401 || body.includes("1113") || body.includes("余额")) {
    return "智谱账户余额不足或不可用，请在开放平台充值后重试。";
  }
  return `智谱API错误 ${status}: ${body}`;
}

type ZhipuFetchOptions = {
  authorization: string;
  body: Record<string, unknown>;
  maxAttempts?: number;
};

/** 调用智谱 Chat Completions，429 时指数退避重试 */
export async function fetchZhipuChatCompletions({
  authorization,
  body,
  maxAttempts = 4,
}: ZhipuFetchOptions) {
  let lastBody = "";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const upstream = await fetch(ZHIPU_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization,
      },
      body: JSON.stringify(body),
    });

    if (upstream.ok) {
      return upstream;
    }

    lastBody = await upstream.text();

    if (upstream.status === 429 && attempt < maxAttempts - 1) {
      await sleep(3000 * 2 ** attempt);
      continue;
    }

    throw new Error(formatZhipuHttpError(upstream.status, lastBody));
  }

  throw new Error(formatZhipuHttpError(429, lastBody));
}
