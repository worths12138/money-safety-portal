import { sleep } from "@/lib/zhipu-upstream";
import { zhipuChatCompletion } from "@/lib/zhipu";

export type VisionImageMaterial = {
  name: string;
  type: string;
  b64: string;
};

/** 图片金额识别间隔，降低智谱 429 */
const IMAGE_AMOUNT_GAP_MS = 1200;

const IMAGE_AMOUNT_SYSTEM = `你是财务单据金额识别助手。根据发票、支付截图、订单等图片，识别该张凭证用于报销的金额。
优先顺序：价税合计 > 实付/应付合计 > 订单总计 > 单张票据最大合理金额。
只输出一行 JSON，不要 Markdown 代码块：
{"totalYuan":123.45,"docType":"发票|支付截图|订单|其他","note":"一句话说明" }
若无法识别金额，totalYuan 填 null。`;

export type ImageAmountExtraction = {
  name: string;
  text: string;
  amountYuan: number | null;
  docType: string;
};

function parseImageAmountJson(raw: string): {
  totalYuan: number | null;
  docType: string;
  note: string;
} {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { totalYuan: null, docType: "其他", note: raw.trim().slice(0, 120) };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      totalYuan?: number | string | null;
      docType?: string;
      note?: string;
    };
    let totalYuan: number | null = null;
    if (typeof parsed.totalYuan === "number" && Number.isFinite(parsed.totalYuan)) {
      totalYuan = parsed.totalYuan;
    } else if (typeof parsed.totalYuan === "string" && parsed.totalYuan.trim()) {
      const n = Number.parseFloat(parsed.totalYuan.replace(/,/g, ""));
      totalYuan = Number.isFinite(n) ? n : null;
    }
    if (totalYuan !== null && (totalYuan < 0.01 || totalYuan > 50_000_000)) {
      totalYuan = null;
    }
    return {
      totalYuan,
      docType: parsed.docType?.trim() || "其他",
      note: parsed.note?.trim() || "",
    };
  } catch {
    return { totalYuan: null, docType: "其他", note: raw.trim().slice(0, 120) };
  }
}

function buildRecognitionText(
  name: string,
  parsed: { totalYuan: number | null; docType: string; note: string },
): string {
  if (parsed.totalYuan !== null && parsed.totalYuan > 0) {
    return [
      `【文件类型】：${parsed.docType}`,
      `价税合计：${parsed.totalYuan}元`,
      `【完整内容】：图片「${name}」识别金额 ${parsed.totalYuan} 元`,
      parsed.note ? `【说明】：${parsed.note}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return `【文件类型】：${parsed.docType}\n【识别说明】：${parsed.note || "未能识别有效金额"}`;
}

export async function extractAmountFromImage(material: VisionImageMaterial): Promise<ImageAmountExtraction> {
  const mime = material.type || "image/jpeg";
  const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    {
      type: "text",
      text: `请识别以下报销凭证图片中的金额。文件名：${material.name}`,
    },
    {
      type: "image_url",
      image_url: { url: `data:${mime};base64,${material.b64}` },
    },
  ];

  const raw = await zhipuChatCompletion({
    system: IMAGE_AMOUNT_SYSTEM,
    messages: [{ role: "user", content }],
    maxTokens: 320,
  });

  const parsed = parseImageAmountJson(raw);
  return {
    name: material.name,
    text: buildRecognitionText(material.name, parsed),
    amountYuan: parsed.totalYuan,
    docType: parsed.docType,
  };
}

export async function extractAmountsFromImages(
  images: VisionImageMaterial[],
  options?: { gapMs?: number },
): Promise<ImageAmountExtraction[]> {
  const gap = options?.gapMs ?? IMAGE_AMOUNT_GAP_MS;
  const results: ImageAmountExtraction[] = [];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    try {
      results.push(await extractAmountFromImage(img));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "识别失败";
      results.push({
        name: img.name,
        text: `[图片金额识别失败：${msg}]`,
        amountYuan: null,
        docType: "其他",
      });
    }
    if (i < images.length - 1) await sleep(gap);
  }

  return results;
}
