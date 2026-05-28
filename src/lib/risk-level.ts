export type RiskTier = "低" | "中" | "高";

export function riskTierFromScore(score: number): RiskTier {
  if (score >= 70) return "高";
  if (score >= 40) return "中";
  return "低";
}

export function riskTierLabel(tier: RiskTier): string {
  if (tier === "高") return "高风险";
  if (tier === "中") return "中风险";
  return "低风险";
}
