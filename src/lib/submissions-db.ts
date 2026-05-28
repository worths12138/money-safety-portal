import { isAuthEnabled } from "@/lib/auth/config";
import type { SessionProfile } from "@/lib/auth/types";
import { enforceAdminRetention, enforceStudentSubmissionRetention } from "@/lib/submission-retention";
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
  /** 是否在提交时同步跑 Agent；默认由环境变量 AUTO_AGENT_ON_SUBMIT 决定 */
  runAgent?: boolean;
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

export async function getSubmissionRow(id: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("submissions").select("*").eq("id", id).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? (data as SubmissionRow) : null;
}

export async function getReportById(id: string) {
  const row = await getSubmissionRow(id);
  return row ? rowToReport(row) : null;
}

export class ReportAccessError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

/** 按登录角色校验后可返回报告 */
export async function getReportByIdForViewer(id: string, viewer: SessionProfile | null) {
  const row = await getSubmissionRow(id);
  if (!row) {
    return null;
  }

  if (isAuthEnabled()) {
    if (!viewer) {
      throw new ReportAccessError("请先登录后查看报告。", 401);
    }
    if (viewer.role === "student") {
      if (!row.submitter_id || row.submitter_id !== viewer.id) {
        throw new ReportAccessError("无权查看该报告，请确认报告编号属于本人。");
      }
    }
  }

  return rowToReport(row);
}

export type StudentSubmissionItem = {
  id: string;
  projectName: string;
  amount: string;
  riskScore: number;
  status: string;
  submittedAt: string;
};

export async function listStudentSubmissions(submitterId: string): Promise<StudentSubmissionItem[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("submissions")
    .select("id, project_name, amount, risk_score, status, submitted_at")
    .eq("submitter_id", submitterId)
    .order("submitted_at", { ascending: false })
    .limit(10);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    projectName: row.project_name as string,
    amount: row.amount as string,
    riskScore: row.risk_score as number,
    status: STATUS_DB_TO_LABEL[row.status as keyof typeof STATUS_DB_TO_LABEL] ?? String(row.status),
    submittedAt: formatSubmittedAt(row.submitted_at as string),
  }));
}

export async function createSubmission(
  payload: SubmissionPayload,
  options?: { deferAgent?: boolean; submitterId?: string; ownerDisplay?: string },
) {
  const id = `2026-${Date.now().toString().slice(-6)}`;
  const deferAgent = options?.deferAgent === true;
  const materialHint =
    payload.materials && payload.materials.length > 0
      ? deferAgent
        ? `已上传 ${payload.materials.length} 份凭证，待运营台发起 AI 风控初审。`
        : `已上传 ${payload.materials.length} 份凭证，Agent 将进行多模态识图审核。`
      : payload.materialFiles?.length
        ? `已登记 ${payload.materialFiles.length} 个文件名（未传文件内容，仅文字风控）。`
        : "";
  const summary =
    [payload.notes?.trim(), materialHint].filter(Boolean).join(" ") ||
    (deferAgent
      ? "申报已入库，请在运营台发起 AI 风控初审后再人工复核。"
      : "系统已接收合规申报，正在等待 Agent 风控评估与人工复核。");

  const owner =
    payload.owner?.trim() || options?.ownerDisplay?.trim() || "软件工程学院 申报人";
  const submitterId = options?.submitterId ?? null;

  const rowBase = {
    submitter_id: submitterId,
  };

  const row = deferAgent
    ? {
        ...rowBase,
        id,
        project_name: payload.projectName.trim(),
        project_period: payload.projectPeriod.trim(),
        amount: payload.amount.trim(),
        notes: payload.notes?.trim() || null,
        owner,
        category: payload.category?.trim() || "",
        risk_score: 0,
        status: "pending" as const,
        summary,
        conclusion: "待 AI 风控初审",
        risk_rows: defaultRiskRows,
        findings: [
          {
            title: "待 AI 初审",
            level: "低",
            detail: "凭证已暂存，请在运营台点击「AI 初审」生成正式风控报告。",
          },
        ],
        recommendations: ["由运营人员在 /admin 发起 AI 初审", "初审完成后再执行通过或驳回"],
        ai_notes: ["申报已入库，待运营台 AI 风控初审。"],
      }
    : {
        ...rowBase,
        id,
        project_name: payload.projectName.trim(),
        project_period: payload.projectPeriod.trim(),
        amount: payload.amount.trim(),
        notes: payload.notes?.trim() || null,
        owner,
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

  if (submitterId) {
    await enforceStudentSubmissionRetention(submitterId);
  }
  await enforceAdminRetention();

  return rowToReport(data as SubmissionRow);
}

export async function reviewSubmission(
  id: string,
  result: AuditResult,
  actorName = "运营人员",
) {
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
