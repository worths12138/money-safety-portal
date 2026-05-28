import { getAllReimbursementRagRules } from "@/lib/rag/rules-store";
import type { ReimbursementRagRule } from "@/lib/rag/types";

const RISK_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1 };

export type RetrieveRulesOptions = {
  /** 最多返回条数，默认 8 */
  maxRules?: number;
  /** 无关键词命中时是否返回全部规则（默认 false，避免撑爆上下文） */
  fallbackAll?: boolean;
};

function normalizeQuery(query: string) {
  return query.trim().toLowerCase();
}

function ruleMatchesQuery(rule: ReimbursementRagRule, queryLower: string): boolean {
  for (const kw of rule.keywords) {
    const k = kw.trim().toLowerCase();
    if (k.length >= 2 && queryLower.includes(k)) {
      return true;
    }
  }
  if (queryLower.includes(rule.rule_id.toLowerCase())) {
    return true;
  }
  if (queryLower.includes(rule.category.toLowerCase())) {
    return true;
  }
  return false;
}

/** 轻量关键词召回（与 RAG 库发送教程一致） */
export function retrieveReimbursementRules(
  queryText: string,
  options?: RetrieveRulesOptions,
): ReimbursementRagRule[] {
  const maxRules = options?.maxRules ?? 8;
  const queryLower = normalizeQuery(queryText);
  if (!queryLower) {
    return options?.fallbackAll ? getAllReimbursementRagRules().slice(0, maxRules) : [];
  }

  const rules = getAllReimbursementRagRules();
  const matched = rules.filter((rule) => ruleMatchesQuery(rule, queryLower));

  if (matched.length === 0) {
    if (options?.fallbackAll) {
      return rules.slice(0, maxRules);
    }
    return [];
  }

  matched.sort((a, b) => (RISK_WEIGHT[b.risk_level] ?? 0) - (RISK_WEIGHT[a.risk_level] ?? 0));
  return matched.slice(0, maxRules);
}

export function buildAuditRetrievalQuery(parts: {
  projectName?: string;
  projectPeriod?: string;
  amount?: string;
  notes?: string;
  pdfText?: string;
  materialFileNames?: string[];
  extraText?: string;
  userQuestion?: string;
}): string {
  return [
    parts.userQuestion,
    parts.projectName,
    parts.projectPeriod,
    parts.amount,
    parts.notes,
    parts.extraText,
    parts.materialFileNames?.join(" "),
    parts.pdfText ? parts.pdfText.slice(0, 4000) : "",
  ]
    .filter(Boolean)
    .join("\n");
}
