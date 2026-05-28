import { getReimbursementRagMeta } from "@/lib/rag/rules-store";
import type { ReimbursementRagRule } from "@/lib/rag/types";

export function formatRetrievedRulesForPrompt(rules: ReimbursementRagRule[]): string {
  if (rules.length === 0) {
    return "";
  }

  const conflictHandling = getReimbursementRagMeta().conflict_handling?.trim();

  const lines = rules.map((rule) => {
    const tags = rule.risk_tags.length ? rule.risk_tags.join("、") : "无";
    return [
      `- ${rule.rule_id}（${rule.category}，风险等级：${rule.risk_level}）`,
      `  规则：${rule.rule_content}`,
      `  来源：${rule.source}`,
      `  风险标签：${tags}`,
      `  整改建议：${rule.suggestion}`,
    ].join("\n");
  });

  const blocks = [
    "【命中规则库（审盾 RAG，仅可引用以下条目，禁止编造未列出的制度条款）】",
  ];
  if (conflictHandling) {
    blocks.push(`【冲突处理指引】\n${conflictHandling}`);
  }
  blocks.push(...lines);
  blocks.push("审核输出时须在风险分析中引用相关 rule_id，并体现 risk_tags 与 suggestion。");
  return blocks.join("\n");
}

export function formatRulesForStudentQa(
  rules: ReimbursementRagRule[],
  configurableRulesBlock: string,
): string {
  const ragBlock = formatRetrievedRulesForPrompt(rules);
  return [configurableRulesBlock, ragBlock].filter(Boolean).join("\n\n");
}
