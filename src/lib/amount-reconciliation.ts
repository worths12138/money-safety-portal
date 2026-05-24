import { parseDeclaredAmountYuan } from "@/lib/risk-score";
import type { ReportFinding } from "@/lib/site-data";
import type { ImageAmountExtraction } from "@/lib/voucher-image-amount";

export const AMOUNT_RECON_AI_NOTE_PREFIX = "AMOUNT_RECON:";

export type VoucherConfidence = "high" | "medium" | "low" | "none";

export type VoucherDocumentAmount = {
  name: string;
  amountYuan: number;
  method: string;
};

export type VoucherAmountSummary = {
  voucherTotalYuan: number;
  documents: VoucherDocumentAmount[];
  imageCount: number;
  confidence: VoucherConfidence;
};

export type AmountMismatchSeverity = "ok" | "warning" | "critical";

export type AmountReconciliation = {
  declaredYuan: number;
  voucherYuan: number;
  deltaYuan: number;
  deltaPercent: number;
  severity: AmountMismatchSeverity;
  message: string;
  voucherSummary: VoucherAmountSummary;
};

const TOTAL_LINE =
  /(?:价税合计|金额合计|合计金额|总计|总额|应付(?:合计)?|实付(?:金额)?|报销(?:总)?金额|小写)[：:\s]*[¥￥]?\s*([\d,，]+\.?\d*)/i;

const PRIORITY_TOTAL =
  /价税合计[^0-9¥￥]{0,12}[¥￥]?\s*([\d,，]+\.?\d*)|（小写）[^0-9¥￥]{0,6}[¥￥]?\s*([\d,，]+\.?\d*)/i;

function tokenToYuan(token: string): number {
  const n = Number.parseFloat(token.replace(/,/g, "").replace(/，/g, ""));
  if (!Number.isFinite(n) || n < 0.01) return 0;
  if (n > 50_000_000) return 0;
  return n;
}

function isLikelyNoise(yuan: number): boolean {
  if (yuan >= 1900 && yuan <= 2100 && Number.isInteger(yuan)) return true;
  if (yuan > 0 && yuan < 1) return true;
  return false;
}

function extractPriorityTotal(text: string): number | null {
  const m = text.match(PRIORITY_TOTAL);
  if (!m) return null;
  const raw = m[1] || m[2];
  if (!raw) return null;
  const yuan = tokenToYuan(raw);
  return yuan > 0 ? yuan : null;
}

function extractTotalLineAmount(text: string): number | null {
  const lines = text.split("\n");
  for (const line of lines) {
    if (!TOTAL_LINE.test(line)) continue;
    const m = line.match(TOTAL_LINE);
    if (!m?.[1]) continue;
    const yuan = tokenToYuan(m[1]);
    if (yuan > 0 && !isLikelyNoise(yuan)) return yuan;
  }
  return null;
}

function extractLargestReasonableAmount(text: string): number {
  const candidates: number[] = [];
  const patterns = [
    /[¥￥]\s*([\d,，]+\.?\d*)/g,
    /([\d,，]+\.?\d{1,2})\s*元/g,
    /(?:金额|合计)[：:\s]*([\d,，]+\.?\d*)/gi,
  ];

  for (const pattern of patterns) {
    for (const m of text.matchAll(pattern)) {
      const yuan = tokenToYuan(m[1]);
      if (yuan > 0 && !isLikelyNoise(yuan)) candidates.push(yuan);
    }
  }

  if (candidates.length === 0) return 0;
  return Math.max(...candidates);
}

export function extractAmountFromDocumentText(text: string, name: string): VoucherDocumentAmount {
  if (!text.trim() || text.includes("PDF 提取失败") || text.includes("提取失败")) {
    return { name, amountYuan: 0, method: "未提取到文字" };
  }

  const priority = extractPriorityTotal(text);
  if (priority) return { name, amountYuan: priority, method: "价税合计/小写" };

  const totalLine = extractTotalLineAmount(text);
  if (totalLine) return { name, amountYuan: totalLine, method: "合计行" };

  const largest = extractLargestReasonableAmount(text);
  if (largest > 0) return { name, amountYuan: largest, method: "文内最大金额（待人工复核）" };

  return { name, amountYuan: 0, method: "未识别" };
}

function documentFromImageExtraction(img: ImageAmountExtraction): VoucherDocumentAmount {
  if (img.amountYuan !== null && img.amountYuan > 0) {
    return {
      name: img.name,
      amountYuan: img.amountYuan,
      method: `图片识图(${img.docType})`,
    };
  }
  return extractAmountFromDocumentText(img.text, img.name);
}

export function summarizeVoucherAmounts(input: {
  pdfDocuments: { name: string; text: string }[];
  imageExtractions?: ImageAmountExtraction[];
  imageCount: number;
}): VoucherAmountSummary {
  const pdfDocs = input.pdfDocuments.map((d) => extractAmountFromDocumentText(d.text, d.name));
  const imageDocs = (input.imageExtractions ?? []).map((img) => documentFromImageExtraction(img));
  const documents = [...pdfDocs, ...imageDocs];
  const recognized = documents.filter((d) => d.amountYuan > 0);
  const voucherTotalYuan = recognized.reduce((s, d) => s + d.amountYuan, 0);

  let confidence: VoucherConfidence = "none";
  if (recognized.length > 0) {
    const methods = recognized.map((d) => d.method);
    const hasVision = methods.some((m) => m.startsWith("图片识图"));
    if (methods.every((m) => m.includes("价税合计") || m.includes("合计行") || m.startsWith("图片识图"))) {
      confidence = hasVision ? "medium" : "high";
    } else if (methods.some((m) => m.includes("合计") || m.startsWith("图片识图"))) {
      confidence = "medium";
    } else {
      confidence = "low";
    }
  }

  return {
    voucherTotalYuan,
    documents,
    imageCount: input.imageCount,
    confidence,
  };
}

export function parsePdfBundleToDocuments(pdfText: string): { name: string; text: string }[] {
  if (!pdfText.trim()) return [];

  const parts = pdfText.split(/\n*── PDF \d+\/\d+：/);
  if (parts.length <= 1) {
    return [{ name: "PDF", text: pdfText }];
  }

  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const nl = part.indexOf("\n");
      const name = nl === -1 ? part.slice(0, 80) : part.slice(0, nl).replace(/──\s*$/, "").trim();
      const text = nl === -1 ? "" : part.slice(nl + 1);
      return { name, text };
    });
}

function mismatchSeverity(
  declaredYuan: number,
  voucherYuan: number,
): { severity: AmountMismatchSeverity; deltaYuan: number; deltaPercent: number } {
  const deltaYuan = Math.abs(declaredYuan - voucherYuan);
  const base = Math.max(declaredYuan, voucherYuan, 1);
  const deltaPercent = Math.round((deltaYuan / base) * 1000) / 10;

  const toleranceYuan = Math.max(1, declaredYuan * 0.01);

  if (deltaYuan <= toleranceYuan) {
    return { severity: "ok", deltaYuan, deltaPercent };
  }

  if (deltaPercent >= 20 && deltaYuan >= 50) {
    return { severity: "critical", deltaYuan, deltaPercent };
  }

  if (deltaPercent >= 5 && deltaYuan >= 10) {
    return { severity: "warning", deltaYuan, deltaPercent };
  }

  return { severity: "ok", deltaYuan, deltaPercent };
}

export function compareDeclaredAndVoucher(
  declaredAmount: string,
  voucherSummary: VoucherAmountSummary,
): AmountReconciliation | null {
  const declaredYuan = parseDeclaredAmountYuan(declaredAmount);
  if (declaredYuan <= 0) return null;

  const { voucherTotalYuan, confidence, imageCount } = voucherSummary;

  if (voucherTotalYuan <= 0) {
    if (imageCount > 0) {
      return {
        declaredYuan,
        voucherYuan: 0,
        deltaYuan: declaredYuan,
        deltaPercent: 100,
        severity: "warning",
        message:
          "已上传图片凭证，但未能从图片/PDF 中识别出有效金额；请人工核对申报总金额与发票/支付截图是否一致。",
        voucherSummary,
      };
    }
    return null;
  }

  const { severity, deltaYuan, deltaPercent } = mismatchSeverity(declaredYuan, voucherTotalYuan);

  const higher = declaredYuan >= voucherTotalYuan;
  const message =
    severity === "ok"
      ? `申报总金额 ${formatYuan(declaredYuan)} 与凭据识别合计 ${formatYuan(voucherTotalYuan)} 基本一致（差额 ${formatYuan(deltaYuan)}）。`
      : higher
        ? `申报总金额 ${formatYuan(declaredYuan)} 高于凭据识别合计 ${formatYuan(voucherTotalYuan)}，差额 ${formatYuan(deltaYuan)}（约 ${deltaPercent}%），存在虚报或漏传凭证风险。`
        : `申报总金额 ${formatYuan(declaredYuan)} 低于凭据识别合计 ${formatYuan(voucherTotalYuan)}，差额 ${formatYuan(deltaYuan)}（约 ${deltaPercent}%），存在少报或重复记账风险。`;

  return {
    declaredYuan,
    voucherYuan: voucherTotalYuan,
    deltaYuan,
    deltaPercent,
    severity,
    message,
    voucherSummary,
  };
}

export function adjustRiskScoreForAmountMismatch(
  score: number,
  recon: AmountReconciliation | null,
): number {
  if (!recon || recon.severity === "ok") return score;
  if (recon.severity === "critical") return Math.max(score, 85);
  return Math.max(score, 70);
}

export function amountMismatchRecommendation(recon: AmountReconciliation): string {
  return recon.message;
}

export function amountMismatchFinding(recon: AmountReconciliation): ReportFinding {
  return {
    title: "申报与凭据金额",
    level: recon.severity === "critical" ? "高" : recon.severity === "warning" ? "中" : "低",
    detail: recon.message,
  };
}

export function serializeAmountReconNote(recon: AmountReconciliation): string {
  return `${AMOUNT_RECON_AI_NOTE_PREFIX}${JSON.stringify({
    declaredYuan: recon.declaredYuan,
    voucherYuan: recon.voucherYuan,
    deltaYuan: recon.deltaYuan,
    deltaPercent: recon.deltaPercent,
    severity: recon.severity,
    message: recon.message,
    confidence: recon.voucherSummary.confidence,
  })}`;
}

export function parseAmountReconFromAiNotes(notes: string[]): AmountReconciliation | null {
  const line = notes.find((n) => n.startsWith(AMOUNT_RECON_AI_NOTE_PREFIX));
  if (!line) return null;
  try {
    const raw = JSON.parse(line.slice(AMOUNT_RECON_AI_NOTE_PREFIX.length)) as {
      declaredYuan: number;
      voucherYuan: number;
      deltaYuan: number;
      deltaPercent: number;
      severity: AmountMismatchSeverity;
      message: string;
      confidence: VoucherConfidence;
    };
    return {
      ...raw,
      voucherSummary: {
        voucherTotalYuan: raw.voucherYuan,
        documents: [],
        imageCount: 0,
        confidence: raw.confidence,
      },
    };
  } catch {
    return null;
  }
}

export function buildReconPromptHint(recon: AmountReconciliation | null): string {
  if (!recon) return "";
  if (recon.voucherYuan <= 0) {
    return `【系统金额预检】申报总金额 ${formatYuan(recon.declaredYuan)}；未能从 PDF/图片自动汇总凭据金额，请在报告中说明需人工核对一致性。`;
  }
  const source =
    recon.voucherSummary.imageCount > 0
      ? "PDF 文字 + 图片识图"
      : "PDF 文字";
  return `【系统金额预检】申报总金额 ${formatYuan(recon.declaredYuan)}；凭据识别合计约 ${formatYuan(recon.voucherYuan)}（${source}，置信度：${recon.voucherSummary.confidence}）。差额 ${formatYuan(recon.deltaYuan)}。请在「金额风险汇总」中明确二者是否一致及处理建议。`;
}

function formatYuan(yuan: number): string {
  if (yuan >= 10_000) return `¥${(yuan / 10_000).toFixed(yuan % 10_000 === 0 ? 0 : 2)}万`;
  return `¥${yuan.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}
