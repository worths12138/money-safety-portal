/** 单次申报最多凭证数（primary 识图文件） */
export const MAX_MATERIAL_FILES = 15;

/** 单文件大小上限（MB） */
export const MAX_MATERIAL_MB = 20;

/** 超过此识图凭证数时提示可能接近超时 */
export const MATERIAL_COUNT_WARN_THRESHOLD = 8;

export function materialCountWarnMessage(visionCount: number): string | null {
  if (visionCount < MATERIAL_COUNT_WARN_THRESHOLD) return null;
  return `已选 ${visionCount} 份识图凭证：文件较多时金额识图与 Agent 评估可能接近 240 秒超时，建议单张压缩至 1–3MB，或拆成多次申报。`;
}
