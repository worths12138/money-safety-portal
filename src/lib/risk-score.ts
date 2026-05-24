/**
 * 合规风控风险分：0 = 风险极低，100 = 风险极高（分数越高越需优先复核）
 */
export const RISK_SCORE_MAX = 100;

export const RISK_THRESHOLDS = {
  lowMax: 39,
  midMax: 69,
} as const;

/** 大创项目常见总经费量级（元），用于识别录入错误 */
export const DACHUANG_AMOUNT_BOUNDS = {
  /** 上学期经费参考（规则内） */
  semesterReference: 3_000,
  /** 常见项目总经费上限参考 */
  typicalProjectMax: 50_000,
  /** 超过此值视为明显异常 */
  warningYuan: 50_000,
  /** 超过此值视为极高概率录入错误（如多输零） */
  criticalYuan: 100_000,
} as const;

export type RiskLevel = "低" | "中" | "高";

export type AmountAnomaly = {
  level: "critical" | "warning";
  parsedYuan: number;
  message: string;
};

export function parseDeclaredAmountYuan(raw: string): number {
  if (!raw?.trim() || /待确认|未知|—|--/i.test(raw)) return 0;

  let cleaned = raw.replace(/[,，\s]/g, "").replace(/[¥￥元人民币]/g, "");

  const wanMatch = cleaned.match(/^([\d.]+)万$/);
  if (wanMatch) {
    const v = Number.parseFloat(wanMatch[1]);
    return Number.isFinite(v) ? v * 10_000 : 0;
  }

  const millionMatch = cleaned.match(/^([\d.]+)百万$/);
  if (millionMatch) {
    const v = Number.parseFloat(millionMatch[1]);
    return Number.isFinite(v) ? v * 1_000_000 : 0;
  }

  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function parseAmountLimitYuan(limitStr: string | undefined): number {
  const n = parseDeclaredAmountYuan(limitStr ?? "");
  return n > 0 ? n : 10_000;
}

export function detectAmountAnomaly(parsedYuan: number): AmountAnomaly | null {
  if (parsedYuan <= 0) return null;

  if (parsedYuan >= 1_000_000) {
    return {
      level: "critical",
      parsedYuan,
      message: `申报金额 ${formatYuanBrief(parsedYuan)} 达百万级，极可能为录入错误（如多输入零），须立即与学生核对。`,
    };
  }

  if (parsedYuan >= DACHUANG_AMOUNT_BOUNDS.criticalYuan) {
    return {
      level: "critical",
      parsedYuan,
      message: `申报金额 ${formatYuanBrief(parsedYuan)} 远超大创常规经费（通常 ¥3,000–¥50,000），应按极高风险处理并核对是否误填。`,
    };
  }

  if (parsedYuan > DACHUANG_AMOUNT_BOUNDS.warningYuan) {
    return {
      level: "warning",
      parsedYuan,
      message: `申报金额 ${formatYuanBrief(parsedYuan)} 明显高于常见大创项目额度，建议人工核实。`,
    };
  }

  return null;
}

function formatYuanBrief(yuan: number): string {
  if (yuan >= 10_000) return `¥${(yuan / 10_000).toFixed(yuan % 10_000 === 0 ? 0 : 2)}万`;
  return `¥${yuan.toLocaleString("zh-CN")}`;
}

export function normalizeRiskScore(raw: number): number {
  return Math.min(RISK_SCORE_MAX, Math.max(0, Math.round(raw)));
}

/**
 * 在 Agent 原始分基础上，按申报金额与学院上限抬高风险分（避免 500 万仍显示低风险）
 */
export function adjustRiskScoreForDeclaredAmount(
  declaredAmount: string,
  agentScore: number,
  options?: { amountLimitYuan?: number },
): number {
  let score = normalizeRiskScore(agentScore);
  const yuan = parseDeclaredAmountYuan(declaredAmount);
  if (yuan <= 0) return score;

  const limit = options?.amountLimitYuan ?? 10_000;
  const anomaly = detectAmountAnomaly(yuan);

  if (anomaly?.level === "critical") {
    score = Math.max(score, yuan >= 1_000_000 ? 96 : 90);
  } else if (anomaly?.level === "warning") {
    score = Math.max(score, 78);
  } else if (yuan > limit) {
    score = Math.max(score, 72);
  } else if (yuan > DACHUANG_AMOUNT_BOUNDS.typicalProjectMax) {
    score = Math.max(score, 65);
  }

  return normalizeRiskScore(score);
}

export function riskLevelFromScore(score: number): RiskLevel {
  const s = normalizeRiskScore(score);
  if (s >= RISK_THRESHOLDS.midMax + 1) return "高";
  if (s >= RISK_THRESHOLDS.lowMax + 1) return "中";
  return "低";
}

export function riskScoreRingColor(score: number): string {
  const level = riskLevelFromScore(score);
  if (level === "高") return "#ef4444";
  if (level === "中") return "#eab308";
  return "#22c55e";
}

export function riskConclusionFallback(score: number): string {
  const level = riskLevelFromScore(score);
  if (level === "低") return "整体风险较低，建议人工复核后归档。";
  if (level === "中") return "存在中等风险，建议补充材料后复核。";
  return "风险偏高，建议重点核查申报材料与金额后再审批。";
}

export function riskSummaryFallback(score: number): string {
  const s = normalizeRiskScore(score);
  const level = riskLevelFromScore(s);
  if (level === "低") {
    return `合规风控风险分 ${s}/100（偏低），整体风险较低，建议人工复核后归档。`;
  }
  if (level === "中") {
    return `合规风控风险分 ${s}/100（中等），存在需补充材料项，请结合下表处理。`;
  }
  return `合规风控风险分 ${s}/100（偏高），建议重点核查后再审批。`;
}

export const RISK_SCORE_DEFINITION =
  "0–100 分：分数越高表示合规风险越大、疑点越多，越需优先复核；0 分表示几乎无风险。";

export function amountAnomalyRecommendation(anomaly: AmountAnomaly): string {
  return anomaly.message;
}
