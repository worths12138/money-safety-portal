import { NextResponse } from "next/server";
import { ensureSupabaseConfigured } from "@/lib/api-config";
import { authErrorResponse, getSessionProfile } from "@/lib/auth/session";
import { assertReportViewAccess } from "@/lib/report-access";
import { getServerMaterialByIndex, touchServerMaterials } from "@/lib/report-material-cache-server";
import { ReportAccessError } from "@/lib/submissions-db";

function contentTypeFor(material: { type: string; name: string }) {
  if (material.type?.trim()) return material.type;
  const lower = material.name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; index: string }> }) {
  const configError = ensureSupabaseConfigured();
  if (configError) {
    return configError;
  }

  try {
    const { id, index: indexRaw } = await params;
    const index = Number.parseInt(indexRaw, 10);
    if (!Number.isFinite(index) || index < 0) {
      return NextResponse.json({ ok: false, message: "无效的文件序号。" }, { status: 400 });
    }

    const viewer = await getSessionProfile();
    await assertReportViewAccess(id, viewer);

    const material = getServerMaterialByIndex(id, index);
    if (!material?.b64?.trim()) {
      return NextResponse.json({ ok: false, message: "凭证不存在或已过期。" }, { status: 404 });
    }

    touchServerMaterials(id);

    const bytes = Buffer.from(material.b64, "base64");
    const type = contentTypeFor(material);

    return new NextResponse(bytes, {
      headers: {
        "Content-Type": type,
        "Content-Disposition": `inline; filename="${encodeURIComponent(material.name)}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    if (error instanceof ReportAccessError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "读取凭证失败。" },
      { status: 500 },
    );
  }
}
