import {
  detectAmountAnomaly,
  parseDeclaredAmountYuan,
  type AmountAnomaly,
} from "@/lib/risk-score";
import type { RiskRow } from "@/lib/site-data";

export type RiskAmountTier = "compliant" | "low" | "medium" | "high";

export type AmountBreakdown = {
  total: number;
  compliant: number;
  low: number;
  medium: number;
  high: number;
};

export type AmountSegment = {
  tier: RiskAmountTier;
  label: string;
  amount: number;
  percent: number;
  color: string;
  colorSide: string;
};

export const AMOUNT_TIER_COLORS: Record<
  RiskAmountTier,
  { label: string; color: string; colorSide: string }
> = {
  compliant: { label: "合规金额", color: "#22c55e", colorSide: "#15803d" },
  low: { label: "低风险金额", color: "#3b82f6", colorSide: "#1d4ed8" },
  medium: { label: "中风险金额", color: "#eab308", colorSide: "#a16207" },
  high: { label: "高风险金额", color: "#ef4444", colorSide: "#b91c1c" },
};

export function parseMoneyString(raw: string): number {
  return parseDeclaredAmountYuan(raw);
}

function breakdownForAmountAnomaly(total: number, anomaly: AmountAnomaly): AmountBreakdown {
  if (anomaly.level === "critical") {
    return {
      total,
      compliant: 0,
      low: 0,
      medium: Math.round(total * 0.08),
      high: Math.round(total * 0.92),
    };
  }
  return {
    total,
    compliant: Math.round(total * 0.05),
    low: Math.round(total * 0.15),
    medium: Math.round(total * 0.35),
    high: Math.round(total * 0.45),
  };
}

function classifyRowRiskLevel(row: RiskRow): "low" | "medium" | "high" {
  const text = `${row.riskDesc} ${row.tag} ${row.suggestion}`;
  if (/高风险|风险等级[：:]\s*高|（高）/.test(text)) return "high";
  if (/中风险|风险等级[：:]\s*中|（中）/.test(text)) return "medium";
  if (/低风险|风险等级[：:]\s*低|（低）/.test(text)) return "low";
  if (/高/.test(text) && !/高中|高等|高亮/.test(text)) return "high";
  if (/中/.test(text)) return "medium";
  return "low";
}

function parseSection4Amounts(markdown: string): Partial<AmountBreakdown> {
  const section = markdown.split(/##\s*四、金额风险汇总/i)[1]?.split(/##\s*五、/i)[0];
  if (!section) return {};

  const result: Partial<AmountBreakdown> = {};
  const lines = section.split("\n").filter((line) => line.trim().startsWith("|"));

  for (const line of lines) {
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length < 2) continue;

    const label = cells[0];
    const amount = parseMoneyString(cells[1]);
    if (amount <= 0) continue;

    if (/报销总金额|总金额/.test(label)) result.total = amount;
    else if (/合规/.test(label) && !/风险/.test(label)) result.compliant = amount;
    else if (/高风险/.test(label)) result.high = amount;
    else if (/中风险/.test(label)) result.medium = amount;
    else if (/低风险/.test(label)) result.low = amount;
    else if (/建议拒绝|拒绝/.test(label)) result.high = (result.high ?? 0) + amount;
    else if (/存在风险|风险金额/.test(label)) {
      const existing = (result.low ?? 0) + (result.medium ?? 0) + (result.high ?? 0);
      const remain = Math.max(0, amount - existing);
      result.low = (result.low ?? 0) + remain * 0.4;
      result.medium = (result.medium ?? 0) + remain * 0.35;
      result.high = (result.high ?? 0) + remain * 0.25;
    }
  }

  return result;
}

function sumFromRiskRows(riskRows: RiskRow[]): Pick<AmountBreakdown, "low" | "medium" | "high"> {
  const sums = { low: 0, medium: 0, high: 0 };
  for (const row of riskRows) {
    const amount = parseMoneyString(row.amount);
    if (amount <= 0) continue;
    const tier = classifyRowRiskLevel(row);
    sums[tier] += amount;
  }
  return sums;
}

function estimateFromRiskScore(riskScore: number, total: number): AmountBreakdown {
  const riskRatio = Math.min(100, Math.max(0, riskScore)) / 100;
  const riskPool = total * riskRatio;
  const compliant = Math.max(0, total - riskPool);
  return {
    total,
    compliant,
    low: riskPool * 0.45,
    medium: riskPool * 0.35,
    high: riskPool * 0.2,
  };
}

export function computeAmountBreakdown(input: {
  declaredAmount: string;
  riskRows: RiskRow[];
  riskScore: number;
  markdown?: string;
}): AmountBreakdown {
  const fromRows = sumFromRiskRows(input.riskRows);
  const rowRiskSum = fromRows.low + fromRows.medium + fromRows.high;

  let total = parseMoneyString(input.declaredAmount);
  if (total <= 0 && rowRiskSum > 0) total = rowRiskSum;

  const amountAnomaly = total > 0 ? detectAmountAnomaly(total) : null;
  if (amountAnomaly) {
    return breakdownForAmountAnomaly(total, amountAnomaly);
  }

  const fromMd = input.markdown ? parseSection4Amounts(input.markdown) : {};
  if (fromMd.total && fromMd.total > 0) total = fromMd.total;
  if (total <= 0) total = 10000;

  let compliant = fromMd.compliant ?? 0;
  let low = fromMd.low ?? fromRows.low;
  let medium = fromMd.medium ?? fromRows.medium;
  let high = fromMd.high ?? fromRows.high;

  if (compliant <= 0 && rowRiskSum > 0) {
    compliant = Math.max(0, total - rowRiskSum);
  }

  const riskSum = low + medium + high;
  if (riskSum <= 0) {
    return estimateFromRiskScore(input.riskScore, total);
  }

  if (compliant <= 0) {
    compliant = Math.max(0, total - riskSum);
  }

  const sum = compliant + low + medium + high;
  if (sum > 0 && Math.abs(sum - total) > 1) {
    const scale = total / sum;
    compliant *= scale;
    low *= scale;
    medium *= scale;
    high *= scale;
  }

  return { total, compliant, low, medium, high };
}

export function breakdownToSegments(breakdown: AmountBreakdown): AmountSegment[] {
  const entries = (
    [
      { tier: "compliant" as const, amount: breakdown.compliant },
      { tier: "low" as const, amount: breakdown.low },
      { tier: "medium" as const, amount: breakdown.medium },
      { tier: "high" as const, amount: breakdown.high },
    ] satisfies { tier: RiskAmountTier; amount: number }[]
  ).filter((e) => e.amount > 0);

  const sum = entries.reduce((s, e) => s + e.amount, 0) || breakdown.total || 1;

  return entries.map((e) => {
    const meta = AMOUNT_TIER_COLORS[e.tier];
    return {
      tier: e.tier,
      label: meta.label,
      amount: e.amount,
      percent: Math.round((e.amount / sum) * 1000) / 10,
      color: meta.color,
      colorSide: meta.colorSide,
    };
  });
}

export function formatYuan(amount: number): string {
  if (amount >= 10000) {
    return `¥${(amount / 10000).toFixed(amount % 10000 === 0 ? 0 : 2)}万`;
  }
  return `¥${amount.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}
