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
  const materialSlots = [{ label: "报销材料", files }];

  const report: ReportData = {
    id,
    projectName: payload.projectName,
    projectPeriod: payload.projectPeriod,
    fundCategory: payload.fundCategory?.trim() ?? "",
    amount: payload.amount,
    conclusion: "已生成初审报告，建议人工复核后进入归档。",
    riskScore: files.length === 0 ? 38 : 18,
    summary: payload.notes?.trim()
      ? payload.notes.trim()
      : "系统已接收该次提交，正在等待风控和人工审核。",
    materials: materialSlots.map((item) => ({
      label: item.label,
      value: item.files.length ? item.files.join(" / ") : "",
      status: item.files.length ? "uploaded" : "blank",
    })),
    riskRows: defaultRiskRows,
    findings: [
      { title: "材料完整性", level: files.length === 0 ? "中" : "低", detail: "缺失材料会在审核页自动留白，便于后续补交。" },
      { title: "金额匹配", level: "低", detail: "提交金额会传递到后端规则引擎进行比对。" },
      { title: "接口预留", level: "低", detail: "当前页面已对接 /api/reports/:id 与 /api/agent/review。" },
    ],
    recommendations: ["补齐留白材料后再提交终审", "如涉及特殊材料，先在规则页更新学院定制项"],
    aiNotes: ["已预留 Agent 审核结果入口。", "提交后会进入报告页与后台列表。"],
  };

  reportStore.set(id, report);
  return report;
}

export function upsertReport(report: ReportData) {
  reportStore.set(report.id, report);
}
