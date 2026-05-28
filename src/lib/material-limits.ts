function readEnvInt(name: string, fallback: number, min: number, max: number): number {
  const raw = Number.parseInt(process.env[name] ?? "", 10);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, raw));
}

/** 单次申报最多凭证数（识图文件），默认 10，可用 MAX_MATERIAL_FILES 覆盖 */
export const MAX_MATERIAL_FILES = readEnvInt("MAX_MATERIAL_FILES", 10, 1, 20);

/** 单次多模态主审最多附图（智能挑选最关键凭证） */
export const MAX_MULTIMODAL_IMAGES_PER_CALL = readEnvInt("MAX_MULTIMODAL_IMAGES_PER_CALL", 3, 1, 5);

/** 超出主审附图时，并行 OCR 的并发数 */
export const IMAGE_EXTRACT_CONCURRENCY = readEnvInt("IMAGE_EXTRACT_CONCURRENCY", 3, 1, 5);

/** 单文件大小上限（MB） */
export const MAX_MATERIAL_MB = 20;

/** 超过此识图凭证数时提示可能接近超时 */
export const MATERIAL_COUNT_WARN_THRESHOLD = Math.min(
  MAX_MATERIAL_FILES,
  readEnvInt("MATERIAL_COUNT_WARN_THRESHOLD", 7, 3, 20),
);

export function materialCountWarnMessage(visionCount: number): string | null {
  if (visionCount < MATERIAL_COUNT_WARN_THRESHOLD) return null;
  return `已选 ${visionCount} 份识图凭证：接近上限 ${MAX_MATERIAL_FILES} 份。系统会自动压缩图片；主审智能附最关键的 ${MAX_MULTIMODAL_IMAGES_PER_CALL} 张（发票/支付/清单优先），其余并行识图后以摘要注入。请在教师端发起 AI 初审。`;
}

/** Agent 初审总超时（毫秒），默认 5 分钟 */
export function agentReviewTimeoutMs(): number {
  return readEnvInt("AGENT_REVIEW_TIMEOUT_MS", 300_000, 60_000, 600_000);
}
