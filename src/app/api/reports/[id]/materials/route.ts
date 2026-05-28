import { NextResponse } from "next/server";
import { ensureSupabaseConfigured } from "@/lib/api-config";
import { authErrorResponse, getSessionProfile } from "@/lib/auth/session";
import { assertReportViewAccess } from "@/lib/report-access";
import {
  getMaterialCacheStatus,
  getServerMaterialMeta,
  touchServerMaterials,
} from "@/lib/report-material-cache-server";
import { ReportAccessError } from "@/lib/submissions-db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const configError = ensureSupabaseConfigured();
  if (configError) {
    return configError;
  }

  try {
    const { id } = await params;
    const viewer = await getSessionProfile();
    await assertReportViewAccess(id, viewer);

    const meta = getServerMaterialMeta(id);
    if (!meta) {
      return NextResponse.json({
        ok: true,
        available: false,
        materials: [],
        materialCache: getMaterialCacheStatus(id),
        message: "凭证暂存已过期或未上传，请学生重新提交或延长 MATERIAL_CACHE_TTL_SEC。",
      });
    }

    touchServerMaterials(id);

    return NextResponse.json({
      ok: true,
      available: true,
      materials: meta.materials.map((m, index) => ({
        index,
        name: m.name,
        type: m.type,
        isPdf: m.type === "application/pdf" || m.name.toLowerCase().endsWith(".pdf"),
        isImage: m.type.startsWith("image/"),
        previewUrl: `/api/reports/${id}/materials/${index}`,
      })),
      materialCache: getMaterialCacheStatus(id),
    });
  } catch (error) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    if (error instanceof ReportAccessError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "加载凭证失败。" },
      { status: 500 },
    );
  }
}
