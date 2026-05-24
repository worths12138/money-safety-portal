import { NextResponse } from "next/server";
import { extractPdfFromBase64 } from "@/lib/pdf-extract";
import { rateLimit } from "@/lib/server-guards";

export const maxDuration = 120;

const MAX_B64_LEN = 28 * 1024 * 1024;

export async function POST(request: Request) {
  const limited = rateLimit(request, "pdf-extract", 20, 60_000);
  if (!limited.allowed) {
    return NextResponse.json({ ok: false, message: "请求过于频繁，请稍后再试。" }, { status: 429 });
  }

  try {
    const body = (await request.json()) as { b64?: string; name?: string };
    const b64 = body.b64?.trim();
    const name = body.name?.trim() || "document.pdf";

    if (!b64) {
      return NextResponse.json({ ok: false, message: "缺少 PDF 内容（b64）。" }, { status: 400 });
    }
    if (b64.length > MAX_B64_LEN) {
      return NextResponse.json({ ok: false, message: "PDF 文件过大。" }, { status: 400 });
    }

    const result = await extractPdfFromBase64(b64, name);

    return NextResponse.json({
      ok: true,
      text: result.text,
      pages: result.pages,
      method: result.method,
      ocrUsed: result.ocrUsed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF 解析失败";
    return NextResponse.json({ ok: false, message }, { status: 422 });
  }
}
