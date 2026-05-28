import { isAuthEnabled } from "@/lib/auth/config";
import type { SessionProfile } from "@/lib/auth/types";
import { getSubmissionRow, ReportAccessError } from "@/lib/submissions-db";

/** 校验当前用户是否可查看该申报（报告 / 凭证） */
export async function assertReportViewAccess(reportId: string, viewer: SessionProfile | null) {
  const row = await getSubmissionRow(reportId);
  if (!row) {
    throw new ReportAccessError("未找到该申报记录。", 404);
  }

  if (isAuthEnabled()) {
    if (!viewer) {
      throw new ReportAccessError("请先登录后查看。", 401);
    }
    if (viewer.role === "student") {
      if (!row.submitter_id || row.submitter_id !== viewer.id) {
        throw new ReportAccessError("无权查看该报告。", 403);
      }
    }
  }

  return row;
}
