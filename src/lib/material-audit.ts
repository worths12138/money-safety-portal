import {
  buildReconPromptHint,
  compareDeclaredAndVoucher,
  summarizeVoucherAmounts,
  type VoucherAmountSummary,
} from "@/lib/amount-reconciliation";
import { getFullAuditRulesPrompt } from "@/lib/compliance-rules";
import { extractPdfFromBase64 } from "@/lib/pdf-extract";
import { extractAmountsFromImages } from "@/lib/voucher-image-amount";
import { SUBMISSION_REPORT_FORMAT } from "@/lib/reimbursement-audit-prompts";
import { sleep } from "@/lib/zhipu-upstream";
import { zhipuChatCompletion, type ZhipuMessage } from "@/lib/zhipu";

export type UploadedMaterial = {
  name: string;
  type: string;
  b64: string;
};

const PDF_GAP_MS = 2500;
const VISION_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const VISION_AUDIT_SYSTEM = `你是中山大学软件工程学院大创项目报销审核专家。
请结合申报信息、PDF 提取文字与附带的图片，严格按照格式输出 Markdown 审核报告。
图片中可能包含发票、支付截图、订单清单等，请逐一识别并纳入分析，不得遗漏。
汇总金额时，若多份凭据金额相同，应先判断是否为同一笔支出的发票与支付佐证，避免重复累加；仅当确为多笔独立支出时才分别计入合计。
风险逐条分析表格中每行须为具体支出项，不得增加「全部项目」「合计」等汇总行；同一笔支出的多条风险须合并为一行。`;

export function isPdfMaterial(m: UploadedMaterial) {
  return m.type === "application/pdf" || m.name.toLowerCase().endsWith(".pdf");
}

export function isVisionImageMaterial(m: UploadedMaterial) {
  return VISION_IMAGE_TYPES.has(m.type) || m.type.startsWith("image/");
}

export function filterVisionMaterials(materials: UploadedMaterial[]) {
  return materials.filter((m) => isPdfMaterial(m) || isVisionImageMaterial(m));
}

async function extractPdfText(material: UploadedMaterial): Promise<string> {
  const result = await extractPdfFromBase64(material.b64, material.name);
  return result.text;
}

export type PreparedMaterials = {
  pdfText: string;
  pdfDocuments: { name: string; text: string }[];
  images: UploadedMaterial[];
  skippedNames: string[];
};

export async function prepareMaterialsForAudit(materials: UploadedMaterial[]): Promise<PreparedMaterials> {
  const pdfResults: { name: string; text: string }[] = [];
  const images: UploadedMaterial[] = [];
  const skippedNames: string[] = [];

  const vision = filterVisionMaterials(materials);
  const skipped = materials.filter((m) => !vision.includes(m));
  skippedNames.push(...skipped.map((m) => m.name));

  for (const m of vision) {
    if (isVisionImageMaterial(m) && !isPdfMaterial(m)) {
      images.push(m);
      continue;
    }
    if (isPdfMaterial(m)) {
      try {
        const text = await extractPdfText(m);
        pdfResults.push({ name: m.name, text });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "提取失败";
        pdfResults.push({ name: m.name, text: `[PDF 提取失败：${msg}]` });
      }
      const morePdf = vision.slice(vision.indexOf(m) + 1).some(isPdfMaterial);
      if (morePdf) await sleep(PDF_GAP_MS);
    }
  }

  const pdfText =
    pdfResults.length > 0
      ? pdfResults.map((r, i) => `── PDF ${i + 1}/${pdfResults.length}：${r.name} ──\n${r.text}`).join("\n\n")
      : "";

  return { pdfText, pdfDocuments: pdfResults, images, skippedNames };
}

export function buildMultimodalAuditMessages(input: {
  projectName: string;
  projectPeriod: string;
  amount: string;
  notes?: string;
  pdfText: string;
  images: UploadedMaterial[];
  skippedNames: string[];
  fullRulesPrompt: string;
  amountReconHint?: string;
}): ZhipuMessage[] {
  const skippedLine =
    input.skippedNames.length > 0
      ? `【未识图文件】以下文件未参与视觉审核（请转为 PDF/图片）：${input.skippedNames.join("、")}`
      : "";

  const textPrompt = [
    `【申报信息】`,
    `项目题目：${input.projectName}`,
    `项目周期：${input.projectPeriod}`,
    `申报总金额：${input.amount}`,
    `补充说明：${input.notes?.trim() || "无"}`,
    input.amountReconHint ?? "",
    input.fullRulesPrompt,
    input.pdfText ? `【PDF文字材料】\n${input.pdfText}` : "【PDF文字材料】：无",
    input.images.length > 0
      ? `【图片材料】\n以下 ${input.images.length} 张图片已直接附在本消息中，请逐张识别并纳入审核，不得遗漏。`
      : "【图片材料】：无",
    skippedLine,
    SUBMISSION_REPORT_FORMAT.replace("{title}", input.projectName).replace("{amount}", input.amount),
  ]
    .filter(Boolean)
    .join("\n\n");

  const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    { type: "text", text: textPrompt },
  ];

  for (const img of input.images) {
    content.push({ type: "text", text: `↓ 图片文件：${img.name}` });
    content.push({
      type: "image_url",
      image_url: { url: `data:${img.type};base64,${img.b64}` },
    });
  }

  return [{ role: "user", content }];
}

export type VisionAgentAuditResult = {
  markdown: string;
  voucherSummary: VoucherAmountSummary;
};

export async function runVisionAgentAudit(input: {
  projectName: string;
  projectPeriod: string;
  amount: string;
  notes?: string;
  materials: UploadedMaterial[];
}): Promise<VisionAgentAuditResult> {
  const fullRulesPrompt = await getFullAuditRulesPrompt();
  const { pdfText, pdfDocuments, images, skippedNames } = await prepareMaterialsForAudit(input.materials);

  if (!pdfText && images.length === 0) {
    throw new Error("没有可用于识图的凭证（请上传 PDF 或 JPG/PNG/WEBP 图片）。");
  }

  const imageExtractions =
    images.length > 0 ? await extractAmountsFromImages(images) : [];

  const voucherSummary = summarizeVoucherAmounts({
    pdfDocuments,
    imageExtractions,
    imageCount: images.length,
  });
  const recon = compareDeclaredAndVoucher(input.amount, voucherSummary);
  const amountReconHint = buildReconPromptHint(recon);

  const markdown = await zhipuChatCompletion({
    system: VISION_AUDIT_SYSTEM,
    messages: buildMultimodalAuditMessages({
      projectName: input.projectName,
      projectPeriod: input.projectPeriod,
      amount: input.amount,
      notes: input.notes,
      pdfText,
      images,
      skippedNames,
      fullRulesPrompt,
      amountReconHint,
    }),
    maxTokens: 4096,
  });

  return { markdown, voucherSummary };
}
