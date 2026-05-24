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
  /** 按相同金额去重后的支出笔数 */
  expenseCount: number;
  /** 风险表原始行数（含同金额重复行） */
  rawRowCount: number;
};

export type DedupedRiskExpense = {
  amountYuan: number;
  tier: "low" | "medium" | "high";
  sourceRows: RiskRow[];
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
  compliant: { label: "合规金额", color: "#4ade80", colorSide: "#16a34a" },
  low: { label: "低风险金额", color: "#22c55e", colorSide: "#15803d" },
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
      expenseCount: 1,
      rawRowCount: 0,
    };
  }
  return {
    total,
    compliant: Math.round(total * 0.05),
    low: Math.round(total * 0.15),
    medium: Math.round(total * 0.35),
    high: Math.round(total * 0.45),
    expenseCount: 1,
    rawRowCount: 0,
  };
}

function classifyRowRiskLevel(row: RiskRow): "low" | "medium" | "high" {
  const text = `${row.riskDesc} ${row.tag} ${row.suggestion}`;
  if (/高风险|风险等级[：:]\s*高|（高）|🔴/.test(text)) return "high";
  if (/中低|（中低）|🟡/.test(text)) return "low";
  if (/中风险|风险等级[：:]\s*中|（中）|🟠/.test(text)) return "medium";
  if (/低风险|风险等级[：:]\s*低|（低）/.test(text)) return "low";
  if (/高/.test(text) && !/高中|高等|高亮/.test(text)) return "high";
  if (/中/.test(text)) return "medium";
  return "low";
}

const AGGREGATE_ITEM_PATTERN =
  /全部项目|整体项目|项目总计|申报总计|报销总计|合计金额|总金额|全部支出|整体申报|项目合计|总计金额|申报总额|报销总额/;

/** 风险表中的汇总行（如「全部项目 ¥417」），不得参与单笔支出与饼图计算 */
export function isAggregateRiskRow(row: RiskRow, declaredTotalYuan?: number): boolean {
  const item = row.item.replace(/\s/g, "");
  const amount = parseMoneyString(row.amount);
  if (amount <= 0) return false;

  if (AGGREGATE_ITEM_PATTERN.test(item)) return true;
  if (/^(全部|整体|合计|总计|总额|申报|项目)(金额|费用|支出)?$/i.test(item)) return true;

  if (declaredTotalYuan && declaredTotalYuan > 0 && Math.abs(amount - declaredTotalYuan) < 0.01) {
    if (/时间逻辑|整体一致|项目周期|全局|汇总|总计|项目级/.test(`${row.tag} ${row.riskDesc}`)) return true;
    if (item.length <= 8 && /全部|整体|项目|合计|总计|申报/.test(item)) return true;
  }

  return false;
}

/** 合并同金额多行（如 Codex 178 的两条风险），避免饼图重复计笔 */
export function mergeSameAmountRiskRows(rows: RiskRow[]): RiskRow[] {
  const buckets = new Map<string, RiskRow[]>();

  for (const row of rows) {
    const amount = parseMoneyString(row.amount);
    if (amount <= 0) continue;
    const key = amount.toFixed(2);
    const list = buckets.get(key) ?? [];
    list.push(row);
    buckets.set(key, list);
  }

  const merged: RiskRow[] = [];
  let seq = 1;

  for (const group of buckets.values()) {
    const primary = group[0];
    if (group.length === 1) {
      merged.push({ ...primary, seq: String(seq++) });
      continue;
    }

    const tags = [...new Set(group.map((r) => r.tag.trim()).filter(Boolean))];
    const riskDescs = group.map((r) => r.riskDesc.trim()).filter(Boolean);
    const suggestions = [...new Set(group.map((r) => r.suggestion.trim()).filter(Boolean))];

    merged.push({
      seq: String(seq++),
      item: primary.item,
      amount: primary.amount,
      tag: tags.length === 1 ? tags[0] : tags.join(" / "),
      riskDesc: [...new Set(riskDescs)].join("；"),
      suggestion: suggestions.join("；"),
    });
  }

  return merged;
}

/** 排除汇总行并合并同金额，供入库与饼图共用 */
export function normalizeRiskRowsForAmount(riskRows: RiskRow[], declaredAmount: string): RiskRow[] {
  const declaredYuan = parseMoneyString(declaredAmount);
  const expenseRows = riskRows.filter((row) => !isAggregateRiskRow(row, declaredYuan));
  return mergeSameAmountRiskRows(expenseRows);
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

function tierPriority(tier: "low" | "medium" | "high"): number {
  if (tier === "high") return 3;
  if (tier === "medium") return 2;
  return 1;
}

function mergeTier(a: "low" | "medium" | "high", b: "low" | "medium" | "high"): "low" | "medium" | "high" {
  return tierPriority(a) >= tierPriority(b) ? a : b;
}

export function dedupeRiskRowsByAmount(riskRows: RiskRow[]): DedupedRiskExpense[] {
  const buckets = new Map<string, RiskRow[]>();

  for (const row of riskRows) {
    const amount = parseMoneyString(row.amount);
    if (amount <= 0) continue;
    const key = amount.toFixed(2);
    const list = buckets.get(key) ?? [];
    list.push(row);
    buckets.set(key, list);
  }

  const expenses: DedupedRiskExpense[] = [];
  for (const [key, rows] of buckets) {
    const amountYuan = Number.parseFloat(key);
    let tier: "low" | "medium" | "high" = "low";
    for (const row of rows) {
      tier = mergeTier(tier, classifyRowRiskLevel(row));
    }
    expenses.push({ amountYuan, tier, sourceRows: rows });
  }

  return expenses.sort((a, b) => b.amountYuan - a.amountYuan);
}

function sumFromDedupedExpenses(expenses: DedupedRiskExpense[]): Pick<AmountBreakdown, "low" | "medium" | "high"> {
  const sums = { low: 0, medium: 0, high: 0 };
  for (const expense of expenses) {
    sums[expense.tier] += expense.amountYuan;
  }
  return sums;
}

function estimateFromRiskScore(riskScore: number, total: number, expenseCount = 1): AmountBreakdown {
  const riskRatio = Math.min(100, Math.max(0, riskScore)) / 100;
  const riskPool = total * riskRatio;
  const compliant = Math.max(0, total - riskPool);
  return {
    total,
    compliant,
    low: riskPool * 0.45,
    medium: riskPool * 0.35,
    high: riskPool * 0.2,
    expenseCount,
    rawRowCount: 0,
  };
}

export function computeAmountBreakdown(input: {
  declaredAmount: string;
  riskRows: RiskRow[];
  riskScore: number;
  markdown?: string;
}): AmountBreakdown {
  const normalizedRows = normalizeRiskRowsForAmount(input.riskRows, input.declaredAmount);
  const dedupedExpenses = dedupeRiskRowsByAmount(normalizedRows);
  const rowsWithAmount = input.riskRows.filter((row) => parseMoneyString(row.amount) > 0);
  const fromRows = sumFromDedupedExpenses(dedupedExpenses);
  const rowRiskSum = fromRows.low + fromRows.medium + fromRows.high;
  const expenseCount = dedupedExpenses.length;
  const rawRowCount = rowsWithAmount.length;

  let total = parseMoneyString(input.declaredAmount);
  if (total <= 0 && rowRiskSum > 0) total = rowRiskSum;

  const amountAnomaly = total > 0 ? detectAmountAnomaly(total) : null;
  if (amountAnomaly) {
    const breakdown = breakdownForAmountAnomaly(total, amountAnomaly);
    return { ...breakdown, expenseCount: expenseCount || breakdown.expenseCount, rawRowCount };
  }

  const fromMd = input.markdown ? parseSection4Amounts(input.markdown) : {};
  if (fromMd.total && fromMd.total > 0) total = fromMd.total;
  if (total <= 0) total = 10000;

  let compliant = fromMd.compliant ?? 0;
  const hasDedupedRows = expenseCount > 0;
  let low = hasDedupedRows ? fromRows.low : (fromMd.low ?? fromRows.low);
  let medium = hasDedupedRows ? fromRows.medium : (fromMd.medium ?? fromRows.medium);
  let high = hasDedupedRows ? fromRows.high : (fromMd.high ?? fromRows.high);

  if (compliant <= 0 && rowRiskSum > 0) {
    compliant = Math.max(0, total - rowRiskSum);
  }

  const riskSum = low + medium + high;
  if (riskSum <= 0) {
    return estimateFromRiskScore(input.riskScore, total, expenseCount || 1);
  }

  if (compliant <= 0) {
    compliant = Math.max(0, total - riskSum);
  }

  const sum = compliant + low + medium + high;
  if (sum > 0 && Math.abs(sum - total) > 1 && rowRiskSum > 0 && Math.abs(rowRiskSum - total) <= total * 0.05) {
    compliant = Math.max(0, total - rowRiskSum);
    low = fromRows.low;
    medium = fromRows.medium;
    high = fromRows.high;
  } else if (sum > 0 && Math.abs(sum - total) > 1) {
    const scale = total / sum;
    compliant *= scale;
    low *= scale;
    medium *= scale;
    high *= scale;
  }

  return { total, compliant, low, medium, high, expenseCount: expenseCount || 1, rawRowCount };
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
