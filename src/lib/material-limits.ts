/** 单次申报最多凭证数（primary 识图文件） */
export const MAX_MATERIAL_FILES = 5;

/** 单次多模态请求最多附图张数（其余凭据用识图摘要文本注入，避免 5 图塞满导致读不出） */
export const MAX_MULTIMODAL_IMAGES_PER_CALL = 3;

/** 单文件大小上限（MB） */
export const MAX_MATERIAL_MB = 20;

/** 超过此识图凭证数时提示可能接近超时 */
export const MATERIAL_COUNT_WARN_THRESHOLD = 4;

export function materialCountWarnMessage(visionCount: number): string | null {
  if (visionCount < MATERIAL_COUNT_WARN_THRESHOLD) return null;
  return `已选 ${visionCount} 份识图凭证：接近上限 ${MAX_MATERIAL_FILES} 份。系统会自动压缩图片；超过 ${MAX_MULTIMODAL_IMAGES_PER_CALL} 张时主审仅附图前 ${MAX_MULTIMODAL_IMAGES_PER_CALL} 张，其余用金额识图摘要。完整 AI 初审请在运营台发起。`;
}
