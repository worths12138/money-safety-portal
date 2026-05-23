import { defaultRiskRows, featuredReports, type ReportData } from "@/lib/site-data";

type SubmissionPayload = {
  projectName: string;
  projectPeriod: string;
  fundCategory?: string;
  amount: string;
  notes?: string;
  materialFiles?: string[];
  receiptFiles?: string[];
  paymentFiles?: string[];
  listFiles?: string[];
};

function collectMaterialFiles(payload: SubmissionPayload) {
  if (payload.materialFiles?.length) {
    return payload.materialFiles;
  }
  return [
    ...(payload.receiptFiles ?? []),
    ...(payload.paymentFiles ?? []),
    ...(payload.listFiles ?? []),
  ];
}

const reportStore = new Map<string, ReportData>(featuredReports.map((item) => [item.id, item]));

export function listReports() {
  return Array.from(reportStore.values());
}

export function getStoredReport(id: string) {
  return reportStore.get(id) ?? featuredReports[0];
}

export function saveSubmission(payload: SubmissionPayload) {
  const id = `2026-${Date.now().toString().slice(-6)}`;
  const files = collectMaterialFiles(payload);
  const materialSlots = [{ label: "合规凭证", files }];

  const report: ReportData = {
    id,
    projectName: payload.projectName,
    projectPeriod: payload.projectPeriod,
    fundCategory: payload.fundCategory?.trim() ?? "",
    amount: payload.amount,
    conclusion: "已生成风控初审结论，建议人工复核后归档。",
    riskScore: files.length === 0 ? 38 : 18,
    summary: payload.notes?.trim()
      ? payload.notes.trim()
      : "系统已接收合规申报，正在等待 Agent 风控评估与人工复核。",
    materials: materialSlots.map((item) => ({
      label: item.label,
      value: item.files.length ? item.files.join(" / ") : "",
      status: item.files.length ? "uploaded" : "blank",
    })),
    riskRows: defaultRiskRows,
    findings: [
      { title: "凭证完整性", level: files.length === 0 ? "中" : "低", detail: "缺失凭证会在风控报告中留白，便于后续补证。" },
      { title: "金额合规", level: "低", detail: "申报金额将传入规则引擎进行限额与一致性比对。" },
      { title: "Agent 接口", level: "低", detail: "已对接 /api/reports/:id 与 /api/agent/review。" },
    ],
    recommendations: ["补齐留白凭证后提交终审", "特殊合规条款请先在规则页维护"],
    aiNotes: ["Agent 风控结果可回写报告。", "提交后进入风控报告页与运营队列。"],
  };

  reportStore.set(id, report);
  return report;
}

export function upsertReport(report: ReportData) {
  reportStore.set(report.id, report);
}
