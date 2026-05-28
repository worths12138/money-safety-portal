import { formatConfigurableRulesPrompt, getComplianceRules } from "@/lib/compliance-rules";
import { formatRulesForStudentQa } from "@/lib/rag/format-prompt";
import { retrieveReimbursementRules } from "@/lib/rag/retrieve";
import type { ReimbursementRagRule } from "@/lib/rag/types";
import { zhipuChatCompletion } from "@/lib/zhipu";

const QA_SYSTEM = `你是「审盾」大创报销合规答疑助手（学生端弱 AI）。
你只能依据用户消息中的【学院可配置规则】与【命中规则库】作答。
禁止编造制度条款、金额上限或报销类目；无依据时必须明确建议「请咨询指导老师或查阅学院报销目录」。
回答使用简体中文，条理清晰，控制在 400 字以内；可引用规则 ID（如 R001）。`;

function qaModelId() {
  return process.env.ZHIPU_QA_MODEL?.trim() || "glm-4-flash";
}

export type StudentQaResult = {
  answer: string;
  matchedRules: ReimbursementRagRule[];
};

export async function runStudentComplianceQa(question: string): Promise<StudentQaResult> {
  const trimmed = question.trim();
  if (!trimmed) {
    throw new Error("请输入问题。");
  }
  if (trimmed.length > 2000) {
    throw new Error("问题过长，请控制在 2000 字以内。");
  }

  const matchedRules = retrieveReimbursementRules(trimmed, { maxRules: 6 });
  const configurableRulesBlock = formatConfigurableRulesPrompt(await getComplianceRules());
  const contextBlock = formatRulesForStudentQa(matchedRules, configurableRulesBlock);

  const answer = await zhipuChatCompletion({
    system: QA_SYSTEM,
    model: qaModelId(),
    maxTokens: 1024,
    messages: [
      {
        role: "user",
        content: `${contextBlock}\n\n【学生问题】\n${trimmed}`,
      },
    ],
  });

  return { answer: answer.trim(), matchedRules };
}
