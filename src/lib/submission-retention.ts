import { getSupabaseAdmin } from "@/lib/supabase/admin";

/** 运营台申报队列最大保留条数 */
export const ADMIN_QUEUE_RETENTION_LIMIT = 50;

/** 审核记录最大保留条数 */
export const ADMIN_AUDIT_LOG_RETENTION_LIMIT = 50;

async function deleteOldestRows(
  table: "submissions" | "audit_records",
  orderColumn: "submitted_at" | "created_at",
  excess: number,
): Promise<number> {
  if (excess <= 0) return 0;

  const supabase = getSupabaseAdmin();

  if (table === "submissions") {
    const { data: oldest, error: listError } = await supabase
      .from("submissions")
      .select("id")
      .order("submitted_at", { ascending: true })
      .limit(excess);

    if (listError) {
      throw new Error(listError.message);
    }

    const ids = (oldest ?? []).map((row) => row.id);
    if (ids.length === 0) return 0;

    const { error: auditDelError } = await supabase.from("audit_records").delete().in("submission_id", ids);
    if (auditDelError) {
      throw new Error(auditDelError.message);
    }

    const { error: subDelError } = await supabase.from("submissions").delete().in("id", ids);
    if (subDelError) {
      throw new Error(subDelError.message);
    }

    return ids.length;
  }

  const { data: oldest, error: listError } = await supabase
    .from("audit_records")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(excess);

  if (listError) {
    throw new Error(listError.message);
  }

  const ids = (oldest ?? []).map((row) => row.id);
  if (ids.length === 0) return 0;

  const { error: delError } = await supabase.from("audit_records").delete().in("id", ids);
  if (delError) {
    throw new Error(delError.message);
  }

  return ids.length;
}

/**
 * 申报队列超过上限时，删除 submitted_at 最早的记录（先删关联 audit_records）
 */
export async function enforceSubmissionRetention(
  limit = ADMIN_QUEUE_RETENTION_LIMIT,
): Promise<{ deletedSubmissions: number }> {
  const supabase = getSupabaseAdmin();
  const { count, error: countError } = await supabase
    .from("submissions")
    .select("*", { count: "exact", head: true });

  if (countError) {
    throw new Error(countError.message);
  }

  const total = count ?? 0;
  if (total <= limit) {
    return { deletedSubmissions: 0 };
  }

  const deletedSubmissions = await deleteOldestRows("submissions", "submitted_at", total - limit);
  return { deletedSubmissions };
}

/**
 * 审核记录超过上限时，删除 created_at 最早的记录
 */
export async function enforceAuditLogRetention(
  limit = ADMIN_AUDIT_LOG_RETENTION_LIMIT,
): Promise<{ deletedLogs: number }> {
  const supabase = getSupabaseAdmin();
  const { count, error: countError } = await supabase
    .from("audit_records")
    .select("*", { count: "exact", head: true });

  if (countError) {
    throw new Error(countError.message);
  }

  const total = count ?? 0;
  if (total <= limit) {
    return { deletedLogs: 0 };
  }

  const deletedLogs = await deleteOldestRows("audit_records", "created_at", total - limit);
  return { deletedLogs };
}

/** 运营台数据保留策略（申报队列 + 审核记录各最多 50 条） */
export async function enforceAdminRetention() {
  const submissionResult = await enforceSubmissionRetention();
  const auditResult = await enforceAuditLogRetention();
  return {
    deletedSubmissions: submissionResult.deletedSubmissions,
    deletedLogs: auditResult.deletedLogs,
  };
}
