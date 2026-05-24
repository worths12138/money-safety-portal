/** 是否曾做过多模态识图审核（来自 ai_notes 模式说明） */
export function reportHadVisionAudit(aiNotes: string[]): boolean {
  return aiNotes.some((n) => /多模态识图|份凭证进行多模态/.test(n));
}

export const MATERIAL_CACHE_TTL_SEC = 240;

export type MaterialCacheInfo = {
  available: boolean;
  count: number;
  ttlSecondsLeft: number;
  fileNames: string[];
};
