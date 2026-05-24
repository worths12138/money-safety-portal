import { spawn } from "node:child_process";
import path from "node:path";
import { zhipuChatCompletion } from "@/lib/zhipu";

export type PdfExtractMethod = "pymupdf" | "unpdf" | "ocr";

export type PdfExtractResult = {
  text: string;
  pages: number;
  method: PdfExtractMethod;
  ocrUsed: boolean;
};

const MIN_TEXT_LEN = 30;

const PDF_OCR_SYSTEM = `你是专业财务单据识别助手，请完整提取图片/PDF页面中的所有文字，不省略任何数字和金额。
输出格式：
【文件类型】：（发票/支付截图/订单清单/签领表/财务说明书/其他）
【完整内容】：（原文，逐字逐行）
【关键字段】：金额 / 商品 / 日期 / 抬头 / 税号 / 其他`;

type PyMuPdfPayload = {
  text?: string;
  pages?: number;
  ocrPages?: { page: number; b64: string }[];
  error?: string;
};

function pythonCommand(): string {
  if (process.env.PDF_PYTHON?.trim()) return process.env.PDF_PYTHON.trim();
  return process.platform === "win32" ? "python" : "python3";
}

function scriptPath(): string {
  return path.join(/* turbopackIgnore: true */ process.cwd(), "scripts", "extract_pdf.py");
}

function pythonDisabled(): boolean {
  return process.env.PDF_EXTRACT_DISABLE_PYTHON === "1";
}

async function extractWithPyMuPDF(buffer: Buffer): Promise<PyMuPdfPayload | null> {
  if (pythonDisabled()) return null;

  const script = scriptPath();
  const py = pythonCommand();

  return new Promise((resolve) => {
    const proc = spawn(py, [script], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let settled = false;

    const finish = (value: PyMuPdfPayload | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    const timer = setTimeout(() => {
      proc.kill();
      finish(null);
    }, 90_000);

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    proc.on("error", () => finish(null));

    proc.on("close", (code) => {
      if (code !== 0) {
        finish(null);
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as PyMuPdfPayload;
        if (parsed.error) {
          finish(null);
          return;
        }
        finish(parsed);
      } catch {
        finish(null);
      }
    });

    proc.stdin.write(buffer);
    proc.stdin.end();
  });
}

async function extractWithUnpdf(buffer: Buffer): Promise<{ text: string; pages: number }> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  const merged = Array.isArray(text) ? text.join("\n\n") : text;
  return { text: merged.trim(), pages: totalPages };
}

async function ocrPdfPagesWithZhipu(
  pages: { page: number; b64: string }[],
  fileName: string,
): Promise<string> {
  const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    {
      type: "text",
      text: `${PDF_OCR_SYSTEM}\n\n以下为扫描版 PDF「${fileName}」的页面图片，请逐页识别并合并输出全部文字。`,
    },
  ];

  for (const p of pages) {
    content.push({ type: "text", text: `── 第 ${p.page} 页 ──` });
    content.push({
      type: "image_url",
      image_url: { url: `data:image/png;base64,${p.b64}` },
    });
  }

  return zhipuChatCompletion({
    system: PDF_OCR_SYSTEM,
    messages: [{ role: "user", content }],
    maxTokens: 4096,
  });
}

function formatExtractedText(fileName: string, text: string, method: PdfExtractMethod, ocrUsed: boolean) {
  const methodLabel =
    method === "pymupdf" ? "PyMuPDF 文本层" : method === "unpdf" ? "PDF.js 文本层" : "页面 OCR";
  const ocrNote = ocrUsed ? "（含扫描页 OCR）" : "";
  return `【文件类型】：PDF 文档\n【提取方式】：${methodLabel}${ocrNote}\n【文件名】：${fileName}\n【完整内容】：\n${text.trim()}`;
}

/**
 * 从 PDF 二进制提取文字：PyMuPDF → unpdf → 扫描页智谱 OCR
 */
export async function extractPdfFromBuffer(buffer: Buffer, fileName: string): Promise<PdfExtractResult> {
  const pymupdf = await extractWithPyMuPDF(buffer);
  let text = pymupdf?.text?.trim() ?? "";
  let pages = pymupdf?.pages ?? 0;
  let method: PdfExtractMethod = "pymupdf";
  let ocrUsed = false;

  if (text.length < MIN_TEXT_LEN) {
    try {
      const unpdfResult = await extractWithUnpdf(buffer);
      pages = unpdfResult.pages || pages;
      if (unpdfResult.text.length > text.length) {
        text = unpdfResult.text;
        method = "unpdf";
      }
    } catch {
      /* unpdf 失败时继续 OCR 路径 */
    }
  }

  if (text.length < MIN_TEXT_LEN && pymupdf?.ocrPages?.length) {
    const ocrText = await ocrPdfPagesWithZhipu(pymupdf.ocrPages, fileName);
    text = [text, ocrText].filter(Boolean).join("\n\n").trim();
    method = "ocr";
    ocrUsed = true;
    pages = pages || pymupdf.pages || pymupdf.ocrPages.length;
  }

  if (text.length < MIN_TEXT_LEN) {
    const hint = pythonDisabled()
      ? "请取消 PDF_EXTRACT_DISABLE_PYTHON 或在本机安装 Python + PyMuPDF（pip install -r requirements-pdf.txt）。"
      : "若为扫描件 PDF，请安装 Python 与 PyMuPDF：pip install -r requirements-pdf.txt";
    throw new Error(`PDF「${fileName}」未能提取到有效文字。${hint}`);
  }

  return {
    text: formatExtractedText(fileName, text, method, ocrUsed),
    pages,
    method,
    ocrUsed,
  };
}

export async function extractPdfFromBase64(b64: string, fileName: string): Promise<PdfExtractResult> {
  const buffer = Buffer.from(b64, "base64");
  if (buffer.length < 8) {
    throw new Error(`PDF「${fileName}」内容为空或损坏。`);
  }
  return extractPdfFromBuffer(buffer, fileName);
}
