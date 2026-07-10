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
import { ZHIPU_MODEL_LABEL, zhipuChatCompletion, zhipuChatCompletionStream } from "@/lib/zhipu";
import {
  buildSubmissionAuditMessages,
  SUBMISSION_AUDIT_SYSTEM,
} from "@/lib/reimbursement-audit-prompts";
import {
  loadServerMaterials,
  saveServerMaterials,
} from "@/lib/report-material-cache-server";
import {
  buildCodexDemoReview,
  isCodexDemoReview,
  waitForCodexDemoReview,
} from "@/lib/codex-demo-review";

export type AgentReviewInput = {
  reportId: string;
  extraText?: string;
  /** @deprecated 无 materials 时仅传文件名 */
  materialFiles?: string[];
  materials?: UploadedMaterial[];
};

export type AgentReviewProgressStep =
  | "load"
  | "pdf_extract"
  | "image_ocr"
  | "generating"
  | "parsing"
  | "done";

export type AgentReviewStreamCallbacks = {
  onProgress?: (step: AgentReviewProgressStep, label: string) => void;
  onDelta?: (fullMarkdown: string) => void;
};

type AgentReviewContext = {
  submission: SubmissionRow;
  visionMaterials: UploadedMaterial[];
  usedCachedMaterials: boolean;
  effectiveMaterials?: UploadedMaterial[];
  materialFiles?: string[];
  extraText?: string;
};

async function loadAgentReviewContext(
  input: AgentReviewInput,
  onProgress?: (step: AgentReviewProgressStep, label: string) => void,
): Promise<AgentReviewContext> {
  const reportId = input.reportId;
  const { extraText, materialFiles, materials } = input;

  onProgress?.("load", "正在从数据库加载申报记录…");
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
    onProgress?.("load", `正在暂存 ${materials.length} 份凭证…`);
    saveServerMaterials(reportId, materials);
  }

  onProgress?.("load", "正在读取服务端凭证缓存…");
  const cachedMaterials = loadServerMaterials(reportId);
  const usedCachedMaterials = Boolean(!materials?.length && cachedMaterials?.length);
  const effectiveMaterials = materials?.length ? materials : cachedMaterials ?? undefined;
  const visionMaterials = effectiveMaterials?.length ? filterVisionMaterials(effectiveMaterials) : [];

  if (visionMaterials.length > 0) {
    onProgress?.(
      "load",
      `已加载申报，共 ${visionMaterials.length} 份可识图凭证，准备审核…`,
    );
  } else {
    onProgress?.("load", "已加载申报（无可识图凭证，将基于字段与规则生成）…");
  }

  return {
    submission,
    visionMaterials,
    usedCachedMaterials,
    effectiveMaterials,
    materialFiles,
    extraText,
  };
}

async function generateAgentMarkdown(
  ctx: AgentReviewContext,
  callbacks?: AgentReviewStreamCallbacks,
): Promise<{
  markdown: string;
  amountRecon: ReturnType<typeof compareDeclaredAndVoucher>;
}> {
  const { submission, visionMaterials, effectiveMaterials, materialFiles, extraText } = ctx;
  const onProgress = callbacks?.onProgress;
  const onDelta = callbacks?.onDelta;

  let markdown: string;
  let amountRecon: ReturnType<typeof compareDeclaredAndVoucher> = null;

  if (visionMaterials.length > 0) {
    onProgress?.("load", "正在准备凭证与审核规则…");
    const audit = await runVisionAgentAudit(
      {
        projectName: submission.project_name,
        projectPeriod: submission.project_period,
        amount: submission.amount,
        notes: submission.notes ?? undefined,
        materials: visionMaterials,
      },
      {
        onProgress: (label) => {
          if (/PDF|提取/.test(label)) {
            onProgress?.("pdf_extract", label);
          } else if (/识别|并行|金额|张凭证/.test(label)) {
            onProgress?.("image_ocr", label);
          } else if (/生成|智谱|GLM/.test(label)) {
            onProgress?.("generating", label);
          } else if (/规则|知识|检索|并行|申报|凭证|数据库|缓存/.test(label)) {
            onProgress?.("load", label);
          } else {
            onProgress?.("load", label);
          }
        },
        onDelta,
      },
    );
    markdown = audit.markdown;
    amountRecon = compareDeclaredAndVoucher(submission.amount, audit.voucherSummary);
  } else {
    onProgress?.("load", "正在加载审核规则与知识库…");
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

    if (effectiveMaterials?.length) {
      onProgress?.("pdf_extract", "正在提取凭证文字…");
      const prepared = await prepareMaterialsForAudit(effectiveMaterials, (label) =>
        onProgress?.("pdf_extract", label),
      );
      if (prepared.images.length > 0) {
        onProgress?.("image_ocr", `正在识别 ${prepared.images.length} 张凭证金额…`);
      }
      const imageExtractions =
        prepared.images.length > 0
          ? await extractAmountsFromImages(prepared.images, {
              onProgress: (done, total, name) =>
                onProgress?.("image_ocr", `金额识别进度 ${done}/${total}：${name}`),
            })
          : [];
      const voucherSummary = summarizeVoucherAmounts({
        pdfDocuments: prepared.pdfDocuments,
        imageExtractions,
        imageCount: prepared.images.length,
      });
      amountRecon = compareDeclaredAndVoucher(submission.amount, voucherSummary);
    }

    onProgress?.("generating", "AI 正在生成风控报告…");
    markdown = await zhipuChatCompletionStream({
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
      onDelta: (_delta, full) => onDelta?.(full),
    });
  }

  return { markdown, amountRecon };
}

async function persistAgentReviewFromMarkdown(
  ctx: AgentReviewContext,
  markdown: string,
  amountRecon: ReturnType<typeof compareDeclaredAndVoucher>,
) {
  const { submission, visionMaterials, usedCachedMaterials } = ctx;
  const supabase = getSupabaseAdmin();

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
      risk_rows: riskRows,
      findings: findings.length ? findings : submission.findings,
      recommendations: recommendations.length ? recommendations : submission.recommendations,
      ai_notes: aiNotes,
    })
    .eq("id", submission.id)
    .select("*")
    .single();

  if (updateError) {
    throw new Error(updateError.message);
  }

  return {
    reportId: submission.id,
    riskScore,
    markdown,
    annotations: recommendations.slice(0, 3),
    submission: updated as SubmissionRow,
  };
}

async function persistCodexDemoReview(ctx: AgentReviewContext) {
  const { submission } = ctx;
  const supabase = getSupabaseAdmin();
  const demo = buildCodexDemoReview(submission);

  const { data: updated, error: updateError } = await supabase
    .from("submissions")
    .update({
      risk_score: demo.riskScore,
      summary: demo.summary,
      conclusion: demo.conclusion,
      risk_rows: demo.riskRows,
      findings: demo.findings,
      recommendations: demo.recommendations,
      ai_notes: demo.aiNotes,
    })
    .eq("id", submission.id)
    .select("*")
    .single();

  if (updateError) {
    throw new Error(updateError.message);
  }

  return {
    reportId: submission.id,
    riskScore: demo.riskScore,
    markdown: demo.markdown,
    annotations: demo.recommendations.slice(0, 3),
    submission: updated as SubmissionRow,
  };
}

export async function runAgentReviewStream(
  input: AgentReviewInput,
  callbacks?: AgentReviewStreamCallbacks,
) {
  const onProgress = callbacks?.onProgress;
  onProgress?.("load", "正在加载申报记录…");
  const ctx = await loadAgentReviewContext(input, onProgress);

  if (isCodexDemoReview(ctx.submission)) {
    callbacks?.onProgress?.("load", "已命中演示模式，正在准备预置审核结果…");
    await waitForCodexDemoReview(() => {
      callbacks?.onProgress?.("generating", "AI 正在生成风控报告…");
    });

    const demoPreview = buildCodexDemoReview(ctx.submission).markdown;
    callbacks?.onDelta?.(demoPreview);
    callbacks?.onProgress?.("parsing", "正在写入演示风控报告…");
    const result = await persistCodexDemoReview(ctx);
    callbacks?.onProgress?.("done", "风控报告已生成。");
    return result;
  }

  const { markdown, amountRecon } = await generateAgentMarkdown(ctx, callbacks);

  callbacks?.onProgress?.("parsing", "正在解析报告并写入数据库…");
  const result = await persistAgentReviewFromMarkdown(ctx, markdown, amountRecon);
  callbacks?.onProgress?.("done", "风控报告已生成。");

  return result;
}

export async function runAgentReview(input: AgentReviewInput) {
  return runAgentReviewStream(input);
}
