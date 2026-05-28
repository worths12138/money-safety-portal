import { formatRetrievedRulesForPrompt } from "@/lib/rag/format-prompt";
import { buildAuditRetrievalQuery, retrieveReimbursementRules } from "@/lib/rag/retrieve";
import type { ReimbursementRagRule } from "@/lib/rag/types";

export type RagAuditContext = {
  matchedRules: ReimbursementRagRule[];
  ragPromptBlock: string;
};

export function buildRagAuditContext(parts: {
  projectName?: string;
  projectPeriod?: string;
  amount?: string;
  notes?: string;
  pdfText?: string;
  materialFileNames?: string[];
  extraText?: string;
  maxRules?: number;
}): RagAuditContext {
  const query = buildAuditRetrievalQuery(parts);
  const matchedRules = retrieveReimbursementRules(query, { maxRules: parts.maxRules ?? 8 });
  const ragPromptBlock = formatRetrievedRulesForPrompt(matchedRules);
  return { matchedRules, ragPromptBlock };
}
