import { NextResponse } from "next/server";
import { ensureSupabaseConfigured } from "@/lib/api-config";
import { deleteAuditLogById } from "@/lib/submission-retention";
import { getClientTimeoutHeader, rateLimit, timeoutResponse, withTimeout } from "@/lib/server-guards";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const configError = ensureSupabaseConfigured();
  if (configError) {
    return configError;
  }

  const limited = rateLimit(request, "admin-delete-log", 20, 60_000);
  if (!limited.allowed) {
    return NextResponse.json(
      { ok: false, message: "删除操作过于频繁。" },
      { status: 429, headers: getClientTimeoutHeader(limited.resetAt) },
    );
  }

  try {
    const { id } = await params;
    await withTimeout(deleteAuditLogById(id), 8_000);
    return NextResponse.json({ ok: true, message: "审核记录已删除。" });
  } catch (error) {
    if (error instanceof Error && error.message.includes("超时")) {
      return timeoutResponse();
    }

    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "删除失败。" },
      { status: 400 },
    );
  }
}
