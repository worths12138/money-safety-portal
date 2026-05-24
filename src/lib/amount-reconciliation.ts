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

export type SameAmountExpenseGroup = {
  amountYuan: number;
  documents: VoucherDocumentAmount[];
  /** 是否按同一笔支出计一次（而非多笔相加） */
  treatedAsSingleExpense: boolean;
  reason: string;
};

export type VoucherAmountSummary = {
  voucherTotalYuan: number;
  /** 未去重前各凭据金额简单相加 */
  rawVoucherTotalYuan: number;
  documents: VoucherDocumentAmount[];
  sameAmountGroups: SameAmountExpenseGroup[];
  dedupeNotes: string[];
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

type DocumentKind = "invoice" | "payment" | "list" | "other";

function inferDocumentKind(name: string, method: string): DocumentKind {
  const text = `${name} ${method}`.toLowerCase();
  if (/发票|invoice|fapiao|税/.test(text)) return "invoice";
  if (/支付|转账|回单|微信|支付宝|payment|bank|流水/.test(text)) return "payment";
  if (/清单|明细|list|订单/.test(text)) return "list";
  return "other";
}

function amountKey(yuan: number): string {
  return yuan.toFixed(2);
}

function fileStem(name: string): string {
  return name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[_\-\s]+/g, "");
}

/** 多份凭据出现相同金额时，优先判断是否为同一笔支出的不同凭证（发票+支付等），避免重复累加 */
function analyzeSameAmountGroups(documents: VoucherDocumentAmount[]): SameAmountExpenseGroup[] {
  const recognized = documents.filter((d) => d.amountYuan > 0);
  const buckets = new Map<string, VoucherDocumentAmount[]>();

  for (const doc of recognized) {
    const key = amountKey(doc.amountYuan);
    const list = buckets.get(key) ?? [];
    list.push(doc);
    buckets.set(key, list);
  }

  const groups: SameAmountExpenseGroup[] = [];

  for (const [key, docs] of buckets) {
    const amountYuan = Number.parseFloat(key);
    if (docs.length <= 1) continue;

    const kinds = docs.map((d) => inferDocumentKind(d.name, d.method));
    const kindSet = new Set(kinds);
    const stems = docs.map((d) => fileStem(d.name));
    const uniqueStems = new Set(stems);

    let treatedAsSingleExpense = true;
    let reason = "";

    if (kindSet.has("invoice") && kindSet.has("payment")) {
      reason = `多份凭据均为 ${formatYuan(amountYuan)}，含发票与支付记录，按同一笔支出计一次。`;
    } else if (kindSet.has("invoice") && kindSet.has("list")) {
      reason = `多份凭据均为 ${formatYuan(amountYuan)}，含发票与清单/订单，按同一笔支出计一次。`;
    } else if (docs.length >= 3 && (kindSet.has("payment") || kindSet.has("list"))) {
      reason = `${docs.length} 份凭据均为 ${formatYuan(amountYuan)}，含支付/清单等多种佐证，按同一笔支出计一次。`;
    } else if (docs.length >= 3) {
      reason =
        uniqueStems.size === docs.length
          ? `${docs.length} 份不同文件名凭据均为 ${formatYuan(amountYuan)}，优先按同一笔支出的重复上传或多份佐证处理，仅计一次（若确为多笔同价采购请人工复核）。`
          : `${docs.length} 份凭据均为 ${formatYuan(amountYuan)}，文件名相近，按同一笔支出计一次。`;
    } else if (docs.length === 2 && kinds.every((k) => k === "invoice" || k === "payment" || k === "list")) {
      reason = `两份凭据金额均为 ${formatYuan(amountYuan)}，疑似同一笔支出的发票与佐证材料，按一笔计。`;
    } else if (docs.length >= 2) {
      reason = `多份凭据金额均为 ${formatYuan(amountYuan)}，优先按同一笔支出去重，仅计一次（避免发票与支付重复记账）。`;
    }

    groups.push({ amountYuan, documents: docs, treatedAsSingleExpense, reason });
  }

  return groups;
}

function computeDedupedVoucherTotal(
  documents: VoucherDocumentAmount[],
  groups: SameAmountExpenseGroup[],
): { total: number; rawTotal: number; notes: string[] } {
  const recognized = documents.filter((d) => d.amountYuan > 0);
  const rawTotal = recognized.reduce((s, d) => s + d.amountYuan, 0);

  if (groups.length === 0) {
    return { total: rawTotal, rawTotal, notes: [] };
  }

  const groupedKeys = new Set(
    groups.flatMap((g) => g.documents.map((d) => `${d.name}::${amountKey(d.amountYuan)}`)),
  );
  let total = 0;
  const notes: string[] = [];

  for (const g of groups) {
    if (g.treatedAsSingleExpense) {
      total += g.amountYuan;
      notes.push(g.reason);
    } else {
      total += g.amountYuan * g.documents.length;
      notes.push(g.reason);
    }
  }

  for (const doc of recognized) {
    const key = `${doc.name}::${amountKey(doc.amountYuan)}`;
    if (groupedKeys.has(key)) continue;
    total += doc.amountYuan;
  }

  if (rawTotal > total + 0.01) {
    notes.unshift(
      `凭据金额去重：简单相加 ${formatYuan(rawTotal)} → 按同一笔支出分析后 ${formatYuan(total)}（差额 ${formatYuan(rawTotal - total)} 可能为重复凭证）。`,
    );
  }

  return { total, rawTotal, notes };
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
  const sameAmountGroups = analyzeSameAmountGroups(documents);
  const { total: voucherTotalYuan, rawTotal: rawVoucherTotalYuan, notes: dedupeNotes } =
    computeDedupedVoucherTotal(documents, sameAmountGroups);

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
    rawVoucherTotalYuan,
    documents,
    sameAmountGroups,
    dedupeNotes,
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

  const dedupedNote =
    voucherSummary.rawVoucherTotalYuan > voucherTotalYuan + 0.01
      ? `（已按同一笔支出去重：简单相加 ${formatYuan(voucherSummary.rawVoucherTotalYuan)} → ${formatYuan(voucherTotalYuan)}）`
      : "";

  const higher = declaredYuan >= voucherTotalYuan;
  const message =
    severity === "ok"
      ? `申报总金额 ${formatYuan(declaredYuan)} 与凭据识别合计 ${formatYuan(voucherTotalYuan)} 基本一致（差额 ${formatYuan(deltaYuan)}）${dedupedNote}。`
      : higher
        ? `申报总金额 ${formatYuan(declaredYuan)} 高于凭据识别合计 ${formatYuan(voucherTotalYuan)}，差额 ${formatYuan(deltaYuan)}（约 ${deltaPercent}%），存在虚报或漏传凭证风险${dedupedNote}。`
        : `申报总金额 ${formatYuan(declaredYuan)} 低于凭据识别合计 ${formatYuan(voucherTotalYuan)}，差额 ${formatYuan(deltaYuan)}（约 ${deltaPercent}%），存在少报或重复记账风险${dedupedNote}。`;

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

export function sameAmountDedupeFinding(summary: VoucherAmountSummary): ReportFinding | null {
  if (summary.dedupeNotes.length === 0) return null;
  return {
    title: "同金额凭据去重",
    level: "中",
    detail: summary.dedupeNotes.join(" "),
  };
}

export function serializeAmountReconNote(recon: AmountReconciliation): string {
  return `${AMOUNT_RECON_AI_NOTE_PREFIX}${JSON.stringify({
    declaredYuan: recon.declaredYuan,
    voucherYuan: recon.voucherYuan,
    rawVoucherYuan: recon.voucherSummary.rawVoucherTotalYuan,
    dedupeNotes: recon.voucherSummary.dedupeNotes,
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
      rawVoucherYuan?: number;
      dedupeNotes?: string[];
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
        rawVoucherTotalYuan: raw.rawVoucherYuan ?? raw.voucherYuan,
        documents: [],
        sameAmountGroups: [],
        dedupeNotes: raw.dedupeNotes ?? [],
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
  const dedupeHint =
    recon.voucherSummary.dedupeNotes.length > 0
      ? ` 同金额分析：${recon.voucherSummary.dedupeNotes.join(" ")}`
      : "";
  if (recon.voucherYuan <= 0) {
    return `【系统金额预检】申报总金额 ${formatYuan(recon.declaredYuan)}；未能从 PDF/图片自动汇总凭据金额，请在报告中说明需人工核对一致性。${dedupeHint}`;
  }
  const source =
    recon.voucherSummary.imageCount > 0
      ? "PDF 文字 + 图片识图"
      : "PDF 文字";
  const rawNote =
    recon.voucherSummary.rawVoucherTotalYuan > recon.voucherYuan + 0.01
      ? `（未去重简单相加 ${formatYuan(recon.voucherSummary.rawVoucherTotalYuan)}，已按同一笔支出分析后计 ${formatYuan(recon.voucherYuan)}）`
      : "";
  return `【系统金额预检】申报总金额 ${formatYuan(recon.declaredYuan)}；凭据识别合计约 ${formatYuan(recon.voucherYuan)}${rawNote}（${source}，置信度：${recon.voucherSummary.confidence}）。差额 ${formatYuan(recon.deltaYuan)}。${dedupeHint} 汇总前先判断相同金额是否为同一笔支出（如发票+支付），勿重复累加。请在「金额风险汇总」中明确二者是否一致及处理建议。`;
}

function formatYuan(yuan: number): string {
  if (yuan >= 10_000) return `¥${(yuan / 10_000).toFixed(yuan % 10_000 === 0 ? 0 : 2)}万`;
  return `¥${yuan.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}
