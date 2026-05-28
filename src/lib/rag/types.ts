export type RagRiskLevel = "high" | "medium" | "low";

export type ReimbursementRagRule = {
  rule_id: string;
  category: string;
  keywords: string[];
  rule_content: string;
  source: string;
  risk_level: RagRiskLevel;
  risk_tags: string[];
  suggestion: string;
};

export type ReimbursementRagLibrary = {
  meta: {
    name: string;
    version: string;
    created_at?: string;
    source_materials?: string[];
    description?: string;
    /** v1.3+：R005 与 R014 等冲突时的模型判断指引 */
    conflict_handling?: string;
  };
  rules: ReimbursementRagRule[];
};
