import type { AuditResult, SubmissionStatus } from "@/lib/supabase/types";

export type QueueStatusLabel = "待审核" | "通过" | "驳回";

export const STATUS_LABEL_TO_DB: Record<QueueStatusLabel, SubmissionStatus> = {
  待审核: "pending",
  通过: "approved",
  驳回: "rejected",
};

export const STATUS_DB_TO_LABEL: Record<SubmissionStatus, QueueStatusLabel> = {
  pending: "待审核",
  approved: "通过",
  rejected: "驳回",
};

export const REVIEW_LABEL_TO_RESULT: Record<Exclude<QueueStatusLabel, "待审核">, AuditResult> = {
  通过: "approved",
  驳回: "rejected",
};

export function reviewActionLabel(result: AuditResult) {
  return result === "approved" ? "一键通过" : "一键驳回";
}
