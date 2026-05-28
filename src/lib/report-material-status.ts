/** 是否曾做过多模态识图审核（来自 ai_notes 模式说明） */
export function reportHadVisionAudit(aiNotes: string[]): boolean {
  return aiNotes.some((n) => /多模态识图|份凭证进行多模态/.test(n));
}

/** 是否尚未完成 AI 初审（运营台待触发） */
export function reportPendingAgentReview(report: {
  riskScore: number;
  conclusion?: string;
  aiNotes?: string[];
}): boolean {
  if (reportHadVisionAudit(report.aiNotes ?? [])) return false;
  const conclusion = report.conclusion?.trim() ?? "";
  if (conclusion === "待 AI 风控初审") return true;
  return report.riskScore === 0 && (report.aiNotes ?? []).some((n) => /待运营台|待 AI/.test(n));
}

export const MATERIAL_CACHE_TTL_SEC = 240;

export type MaterialCacheInfo = {
  available: boolean;
  count: number;
  ttlSecondsLeft: number;
  fileNames: string[];
};
