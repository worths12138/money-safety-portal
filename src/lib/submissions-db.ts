import { enforceAdminRetention } from "@/lib/submission-retention";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { AuditRecordRow, AuditResult, SubmissionRow } from "@/lib/supabase/types";
import { REVIEW_LABEL_TO_RESULT, STATUS_DB_TO_LABEL, reviewActionLabel } from "@/lib/review-status";
import { sanitizeReportFields } from "@/lib/parse-audit-report";
import {
  defaultRiskRows,
  type OperationLog,
  type QueueItem,
  type ReportData,
  type ReportFinding,
  type RiskRow,
} from "@/lib/site-data";

export type SubmissionMaterialPayload = {
  name: string;
  type: string;
  b64: string;
};

export type SubmissionPayload = {
  projectName: string;
  projectPeriod: string;
  amount: string;
  notes?: string;
  owner?: string;
  category?: string;
  materialFiles?: string[];
  materials?: SubmissionMaterialPayload[];
};

function formatSubmittedAt(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const time = date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });

  if (date >= startOfToday) {
    return `今天 ${time}`;
  }
  if (date >= startOfYesterday) {
    return `昨天 ${time}`;
  }
  return date.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatLogTime(iso: string) {
  return new Date(iso).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function asRiskRows(value: unknown): RiskRow[] {
  return Array.isArray(value) ? (value as RiskRow[]) : [];
}

function asFindings(value: unknown): ReportFinding[] {
  return Array.isArray(value) ? (value as ReportFinding[]) : [];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function rowToReport(row: SubmissionRow): ReportData {
  return sanitizeReportFields({
    id: row.id,
    projectName: row.project_name,
    projectPeriod: row.project_period,
    fundCategory: row.category,
    amount: row.amount,
    conclusion: row.conclusion ?? "",
    riskScore: row.risk_score,
    summary: row.summary ?? "",
    materials: [],
    riskRows: asRiskRows(row.risk_rows).length ? asRiskRows(row.risk_rows) : defaultRiskRows,
    findings: asFindings(row.findings),
    recommendations: asStringArray(row.recommendations),
    aiNotes: asStringArray(row.ai_notes).map((n) =>
      typeof n === "string" ? n.replace(/\*\*/g, "") : n,
    ),
  });
}

function rowToQueueItem(row: SubmissionRow): QueueItem {
  return {
    id: row.id,
    projectName: row.project_name,
    risk: row.risk_score,
    status: STATUS_DB_TO_LABEL[row.status],
    owner: row.owner,
    submittedAt: formatSubmittedAt(row.submitted_at),
    category: row.category,
  };
}

function rowToOperationLog(row: AuditRecordRow): OperationLog {
  const resultLabel = row.result === "approved" ? "通过" : "驳回";
  return {
    id: row.id,
    submissionId: row.submission_id,
    actor: row.actor_name,
    action: row.action,
    target: `${row.project_name}（${row.submission_id}）· ${resultLabel}`,
    time: formatLogTime(row.created_at),
  };
}

function defaultFindings(): ReportFinding[] {
  return [
    { title: "凭证完整性", level: "中", detail: "本平台不存储上传文件，Agent 基于申报字段与文件名进行风控。" },
    { title: "金额合规", level: "低", detail: "申报金额将传入 Agent 与报销规则进行比对。" },
    { title: "Agent 评估", level: "低", detail: "提交后将由 GLM-5V-Turbo 生成风控报告并回写本页数据。" },
  ];
}

export async function listRecentReports(limit = 2) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .order("submitted_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data as SubmissionRow[]).map(rowToReport);
}

export async function listQueueItems() {
  await enforceAdminRetention();

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .order("submitted_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as SubmissionRow[]).map(rowToQueueItem);
}

export async function listAuditLogs(limit = 50) {
  await enforceAdminRetention();

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("audit_records")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data as AuditRecordRow[]).map(rowToOperationLog);
}

export async function getReportById(id: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("submissions").select("*").eq("id", id).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return rowToReport(data as SubmissionRow);
}

export async function createSubmission(payload: SubmissionPayload) {
  const id = `2026-${Date.now().toString().slice(-6)}`;
  const materialHint =
    payload.materials && payload.materials.length > 0
      ? `已上传 ${payload.materials.length} 份凭证，Agent 将进行多模态识图审核。`
      : payload.materialFiles?.length
        ? `已登记 ${payload.materialFiles.length} 个文件名（未传文件内容，仅文字风控）。`
        : "";
  const summary = [payload.notes?.trim(), materialHint].filter(Boolean).join(" ") ||
    "系统已接收合规申报，正在等待 Agent 风控评估与人工复核。";

  const row = {
    id,
    project_name: payload.projectName.trim(),
    project_period: payload.projectPeriod.trim(),
    amount: payload.amount.trim(),
    notes: payload.notes?.trim() || null,
    owner: payload.owner?.trim() || "软件工程学院 申报人",
    category: payload.category?.trim() || "",
    risk_score: 28,
    status: "pending" as const,
    summary,
    conclusion: "已生成风控初审结论，建议人工复核后归档。",
    risk_rows: defaultRiskRows,
    findings: defaultFindings(),
    recommendations: ["补齐留白凭证后提交终审", "特殊合规条款请先在规则页维护"],
    ai_notes: ["正在等待 GLM-5V-Turbo Agent 生成风控结论…"],
  };

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("submissions").insert(row).select("*").single();

  if (error) {
    throw new Error(error.message);
  }

  await enforceAdminRetention();

  return rowToReport(data as SubmissionRow);
}

export async function reviewSubmission(id: string, result: AuditResult, actorName = "运营人员") {
  const supabase = getSupabaseAdmin();

  const { data: existing, error: fetchError } = await supabase.from("submissions").select("*").eq("id", id).maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (!existing) {
    throw new Error("未找到该申报记录。");
  }

  const submission = existing as SubmissionRow;
  const status = result;

  const { data: updated, error: updateError } = await supabase
    .from("submissions")
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { data: auditRow, error: auditError } = await supabase
    .from("audit_records")
    .insert({
      submission_id: id,
      project_name: submission.project_name,
      amount: submission.amount,
      risk_score: submission.risk_score,
      result,
      action: reviewActionLabel(result),
      actor_name: actorName,
    })
    .select("*")
    .single();

  if (auditError) {
    throw new Error(auditError.message);
  }

  await enforceAdminRetention();

  return {
    queueItem: rowToQueueItem(updated as SubmissionRow),
    log: rowToOperationLog(auditRow as AuditRecordRow),
  };
}

export function parseReviewResult(status: "通过" | "驳回") {
  return REVIEW_LABEL_TO_RESULT[status];
}
