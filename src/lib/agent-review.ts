import {
  amountMismatchFinding,
  amountMismatchRecommendation,
  adjustRiskScoreForAmountMismatch,
  compareDeclaredAndVoucher,
  sameAmountDedupeFinding,
  serializeAmountReconNote,
  summarizeVoucherAmounts,
} from "@/lib/amount-reconciliation";
import { getComplianceRules, getFullAuditRulesPrompt } from "@/lib/compliance-rules";
import { buildRagAuditContext } from "@/lib/rag/audit-context";
import {
  filterVisionMaterials,
  prepareMaterialsForAudit,
  runVisionAgentAudit,
  type UploadedMaterial,
} from "@/lib/material-audit";
import { extractAmountsFromImages } from "@/lib/voucher-image-amount";
import {
  parseConclusion,
  parseFindings,
  parseRecommendations,
  parseRiskRows,
  parseRiskScore,
  parseSummary,
  sanitizeReportText,
} from "@/lib/parse-audit-report";
import {
  adjustRiskScoreForDeclaredAmount,
  amountAnomalyRecommendation,
  detectAmountAnomaly,
  parseAmountLimitYuan,
  parseDeclaredAmountYuan,
} from "@/lib/risk-score";
import { normalizeRiskRowsForAmount } from "@/lib/risk-amount-breakdown";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { SubmissionRow } from "@/lib/supabase/types";
import type { ReportFinding } from "@/lib/site-data";
import { ZHIPU_MODEL_LABEL, zhipuChatCompletion } from "@/lib/zhipu";
import {
  buildSubmissionAuditMessages,
  SUBMISSION_AUDIT_SYSTEM,
} from "@/lib/reimbursement-audit-prompts";
import {
  loadServerMaterials,
  saveServerMaterials,
} from "@/lib/report-material-cache-server";

export type AgentReviewInput = {
  reportId: string;
  extraText?: string;
  /** @deprecated 无 materials 时仅传文件名 */
  materialFiles?: string[];
  materials?: UploadedMaterial[];
};

export async function runAgentReview({
  reportId,
  extraText,
  materialFiles,
  materials,
}: AgentReviewInput) {
  const supabase = getSupabaseAdmin();
  const { data: existing, error: fetchError } = await supabase
    .from("submissions")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }
  if (!existing) {
    throw new Error("未找到该申报记录。");
  }

  const submission = existing as SubmissionRow;

  if (materials?.length) {
    saveServerMaterials(reportId, materials);
  }

  const cachedMaterials = loadServerMaterials(reportId);
  const usedCachedMaterials = Boolean(!materials?.length && cachedMaterials?.length);
  const effectiveMaterials = materials?.length ? materials : cachedMaterials ?? undefined;
  const visionMaterials = effectiveMaterials?.length ? filterVisionMaterials(effectiveMaterials) : [];

  let markdown: string;
  let amountRecon: ReturnType<typeof compareDeclaredAndVoucher> = null;

  if (visionMaterials.length > 0) {
    const audit = await runVisionAgentAudit({
      projectName: submission.project_name,
      projectPeriod: submission.project_period,
      amount: submission.amount,
      notes: submission.notes ?? undefined,
      materials: visionMaterials,
    });
    markdown = audit.markdown;
    amountRecon = compareDeclaredAndVoucher(submission.amount, audit.voucherSummary);
  } else {
    const fullRulesPrompt = await getFullAuditRulesPrompt();
    const { ragPromptBlock } = buildRagAuditContext({
      projectName: submission.project_name,
      projectPeriod: submission.project_period,
      amount: submission.amount,
      notes: submission.notes ?? undefined,
      materialFileNames: materialFiles,
      extraText,
    });
    const rulesWithRag = [fullRulesPrompt, ragPromptBlock].filter(Boolean).join("\n\n");
    markdown = await zhipuChatCompletion({
      system: SUBMISSION_AUDIT_SYSTEM,
      messages: buildSubmissionAuditMessages({
        projectName: submission.project_name,
        projectPeriod: submission.project_period,
        amount: submission.amount,
        notes: submission.notes ?? undefined,
        materialFiles,
        extraText,
        fullRulesPrompt: rulesWithRag,
      }),
      maxTokens: 4096,
    });

    if (effectiveMaterials?.length) {
      const prepared = await prepareMaterialsForAudit(effectiveMaterials);
      const imageExtractions =
        prepared.images.length > 0 ? await extractAmountsFromImages(prepared.images) : [];
      const voucherSummary = summarizeVoucherAmounts({
        pdfDocuments: prepared.pdfDocuments,
        imageExtractions,
        imageCount: prepared.images.length,
      });
      amountRecon = compareDeclaredAndVoucher(submission.amount, voucherSummary);
    }
  }

  const agentRiskScore = parseRiskScore(markdown);
  const rules = await getComplianceRules();
  const amountLimitYuan = parseAmountLimitYuan(rules.amountLimit);

  let riskScore = adjustRiskScoreForDeclaredAmount(submission.amount, agentRiskScore, {
    amountLimitYuan,
  });
  riskScore = adjustRiskScoreForAmountMismatch(riskScore, amountRecon);

  const riskRows = normalizeRiskRowsForAmount(parseRiskRows(markdown), submission.amount);
  let findings: ReportFinding[] = parseFindings(markdown, riskRows);
  let recommendations = parseRecommendations(markdown);

  const amountYuan = parseDeclaredAmountYuan(submission.amount);
  const amountAnomaly = detectAmountAnomaly(amountYuan);
  if (amountAnomaly) {
    const amountRec = amountAnomalyRecommendation(amountAnomaly);
    recommendations = [amountRec, ...recommendations.filter((r) => !r.includes("录入") && !r.includes("核对"))].slice(
      0,
      5,
    );
  }

  if (amountRecon && amountRecon.severity !== "ok") {
    const rec = amountMismatchRecommendation(amountRecon);
    recommendations = [rec, ...recommendations.filter((r) => r !== rec)].slice(0, 5);
    findings = [amountMismatchFinding(amountRecon), ...findings.filter((f) => f.title !== "申报与凭据金额")].slice(0, 6);
  } else if (amountRecon?.severity === "ok" && amountRecon.voucherYuan > 0) {
    findings = [
      amountMismatchFinding(amountRecon),
      ...findings.filter((f) => f.title !== "申报与凭据金额"),
    ].slice(0, 6);
  }

  if (amountRecon?.voucherSummary.dedupeNotes.length) {
    const dedupeFinding = sameAmountDedupeFinding(amountRecon.voucherSummary);
    if (dedupeFinding) {
      findings = [
        dedupeFinding,
        ...findings.filter((f) => f.title !== "同金额凭据去重"),
      ].slice(0, 6);
    }
  }

  const conclusion = parseConclusion(markdown, riskScore);
  let summary = parseSummary(markdown, riskScore);
  if (amountAnomaly) {
    summary = `${amountAnomaly.message} ${summary}`;
  }
  if (amountRecon && amountRecon.severity !== "ok") {
    summary = `${amountRecon.message} ${summary}`;
  }

  const modeNote =
    visionMaterials.length > 0
      ? usedCachedMaterials
        ? `由智谱 ${ZHIPU_MODEL_LABEL} 对服务端暂存凭证（${visionMaterials.length} 份）重新多模态识图审核。`
        : `由智谱 ${ZHIPU_MODEL_LABEL} 对 ${visionMaterials.length} 份凭证进行多模态识图审核。`
      : `由智谱 ${ZHIPU_MODEL_LABEL} 基于申报字段与规则生成（未上传可识图凭证或暂存已过期）。`;

  const cleanPreview = sanitizeReportText(markdown);
  const preview =
    cleanPreview.length > 600 ? `${cleanPreview.slice(0, 600)}…` : cleanPreview || modeNote;
  const aiNotes = [
    modeNote,
    ...(amountRecon ? [serializeAmountReconNote(amountRecon)] : []),
    preview,
  ];

  const { data: updated, error: updateError } = await supabase
    .from("submissions")
    .update({
      risk_score: riskScore,
      summary,
      conclusion,
      risk_rows: riskRows.length ? riskRows : submission.risk_rows,
      findings: findings.length ? findings : submission.findings,
      recommendations: recommendations.length ? recommendations : submission.recommendations,
      ai_notes: aiNotes,
    })
    .eq("id", reportId)
    .select("*")
    .single();

  if (updateError) {
    throw new Error(updateError.message);
  }

  return {
    reportId,
    riskScore,
    markdown,
    annotations: recommendations.slice(0, 3),
    submission: updated as SubmissionRow,
  };
}
