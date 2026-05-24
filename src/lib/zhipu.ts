/** 智谱开放平台模型 ID，见 https://docs.bigmodel.cn/cn/guide/models/vlm/glm-5v-turbo */
export const ZHIPU_MODEL_ID = "glm-5v-turbo";

/** 界面与文档中的展示名称 */
export const ZHIPU_MODEL_LABEL = "GLM-5V-Turbo";

export function getZhipuModelId() {
  return process.env.ZHIPU_MODEL?.trim() || ZHIPU_MODEL_ID;
}

export type ZhipuMessage = {
  role: string;
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
};

function base64url(str: string) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function generateZhipuToken(apiKey: string) {
  const [id, secret] = apiKey.split(".");
  if (!id || !secret) {
    throw new Error("ZHIPU_API_KEY 格式错误，应为 {id}.{secret}");
  }

  const now = Date.now();
  const header = base64url(JSON.stringify({ alg: "HS256", sign_type: "SIGN" }));
  const payload = base64url(
    JSON.stringify({ api_key: id, exp: now + 3600 * 1000, timestamp: now }),
  );
  const sigInput = `${header}.${payload}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(sigInput));
  const sigB64 = base64url(Buffer.from(sig).toString("base64"));

  return `${sigInput}.${sigB64}`;
}

export function getZhipuApiKey() {
  const apiKey = process.env.ZHIPU_API_KEY?.trim().replace(/^["']|["']$/g, "");
  if (!apiKey) {
    throw new Error("未配置 ZHIPU_API_KEY");
  }
  return apiKey;
}

/**
 * 智谱要求：Authorization: Bearer <API_KEY 或 JWT>
 * @see https://docs.bigmodel.cn/cn/guide/develop/http/introduction
 */
export async function resolveZhipuAuthorization() {
  const apiKey = getZhipuApiKey();
  const mode = (process.env.ZHIPU_AUTH ?? "bearer").toLowerCase();

  if (mode === "jwt") {
    if (!apiKey.includes(".")) {
      throw new Error("JWT 模式需要 ZHIPU_API_KEY 为 id.secret 格式");
    }
    return `Bearer ${await generateZhipuToken(apiKey)}`;
  }

  return `Bearer ${apiKey}`;
}

/** 非流式调用，供 Agent 风控回写数据库 */
export async function zhipuChatCompletion({
  messages,
  system,
  model = getZhipuModelId(),
  maxTokens = 4096,
}: {
  messages: ZhipuMessage[];
  system?: string;
  model?: string;
  maxTokens?: number;
}) {
  const { fetchZhipuChatCompletions } = await import("@/lib/zhipu-upstream");
  const authorization = await resolveZhipuAuthorization();
  const glmMessages = system ? [{ role: "system", content: system }, ...messages] : messages;

  const upstream = await fetchZhipuChatCompletions({
    authorization,
    body: {
      model: model || getZhipuModelId(),
      messages: glmMessages,
      stream: false,
      max_tokens: maxTokens,
      temperature: 0.3,
    },
  });

  const data = (await upstream.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("智谱 API 返回内容为空");
  }
  return content;
}
