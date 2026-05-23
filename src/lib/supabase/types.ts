import type { ReportFinding, RiskRow } from "@/lib/site-data";

export type SubmissionStatus = "pending" | "approved" | "rejected";
export type AuditResult = "approved" | "rejected";

export type SubmissionRow = {
  id: string;
  project_name: string;
  project_period: string;
  amount: string;
  notes: string | null;
  owner: string;
  category: string;
  risk_score: number;
  status: SubmissionStatus;
  summary: string | null;
  conclusion: string | null;
  risk_rows: RiskRow[];
  findings: ReportFinding[];
  recommendations: string[];
  ai_notes: string[];
  submitted_at: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AuditRecordRow = {
  id: string;
  submission_id: string;
  project_name: string;
  amount: string | null;
  risk_score: number | null;
  result: AuditResult;
  action: string;
  actor_name: string;
  comment: string | null;
  created_at: string;
};
