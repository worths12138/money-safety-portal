export type Metric = {
  label: string;
  value: string;
  hint: string;
};

export type SubmissionMaterial = {
  label: string;
  value: string;
  status: "uploaded" | "blank";
};

export type ReportFinding = {
  title: string;
  level: "低" | "中" | "高";
  detail: string;
};

export type RiskRow = {
  seq: string;
  item: string;
  amount: string;
  tag: string;
  riskDesc: string;
  suggestion: string;
};

export const defaultRiskRows: RiskRow[] = [
  {
    seq: "1",
    item: "键盘",
    amount: "待确认",
    tag: "材料不完整",
    riskDesc: "缺少支付记录和签领表，无法核实购买真实性",
    suggestion: "补充材料后可受理",
  },
  {
    seq: "2-9",
    item: "PDF发票1-8",
    amount: "待确认",
    tag: "材料不完整",
    riskDesc: "订单详情和支付记录缺失，无法核实与项目相关性",
    suggestion: "补充材料后可受理",
  },
  {
    seq: "汇总",
    item: "全部支出",
    amount: "待确认",
    tag: "用途说明不足",
    riskDesc: "缺少自拟清单和报销清单，无法判断整体合规性",
    suggestion: "补充完整清单和签字",
  },
];

export type ReportData = {
  id: string;
  projectName: string;
  projectPeriod: string;
  fundCategory: string;
  amount: string;
  conclusion: string;
  riskScore: number;
  summary: string;
  materials: SubmissionMaterial[];
  riskRows: RiskRow[];
  findings: ReportFinding[];
  recommendations: string[];
  aiNotes: string[];
};

export type QueueItem = {
  id: string;
  projectName: string;
  risk: number;
  status: "待审核" | "通过" | "驳回";
  owner: string;
  submittedAt: string;
  category: string;
};

export type RuleItem = {
  id: string;
  title: string;
  value: string;
  detail: string;
};

export type OperationLog = {
  id: string;
  actor: string;
  action: string;
  target: string;
  time: string;
};

export const dashboardMetrics: Metric[] = [
  { label: "大创提交", value: "28", hint: "较昨日 +12%" },
  { label: "高风险待审", value: "6", hint: "先处理采购类项目" },
  { label: "平均审核时长", value: "4.2 分钟", hint: "包含 AI 初筛" },
  { label: "材料完整率", value: "91%", hint: "缺失项自动留白" },
];

export const quickHighlights = [
  "支持发票、回单、清单与附件说明等材料拖拽上传",
  "报告页展示总体结论、风险分、AI 标注与整改建议",
  "管理员可按风险筛选、批量处理并查看操作日志",
  "规则页可维护大创经费上限、DDL 和学院定制要求",
];

export const featuredReports: ReportData[] = [
  {
    id: "2026-041",
    projectName: "校园协同开发平台",
    projectPeriod: "2026-03 - 2026-05",
    fundCategory: "软件订阅",
    amount: "¥4,860",
    conclusion: "建议通过，票据结构完整，仅有一项支付记录缺失，需补充后归档。",
    riskScore: 22,
    summary: "AI 先行判断为低风险，金额与类别匹配，存在一张未签章清单。",
    materials: [
      { label: "票据", value: "电子发票 2 份，已验真", status: "uploaded" },
      { label: "支付记录", value: "", status: "blank" },
      { label: "材料清单", value: "大创项目报销清单（已盖章）", status: "uploaded" },
    ],
    riskRows: defaultRiskRows,
    findings: [
      { title: "类别匹配", level: "低", detail: "软件订阅用途与项目阶段一致。" },
      { title: "金额上限", level: "低", detail: "未超过学院设置的单项限额。" },
      { title: "签章完整性", level: "中", detail: "清单已盖章，支付记录需补齐存档。" },
    ],
    recommendations: ["补齐支付记录后进入终审", "导出 PDF 存档并同步学院台账"],
    aiNotes: ["票据号码与平台返回结果一致。", "风险主要来自材料缺失，不影响金额真实性。"],
  },
  {
    id: "2026-042",
    projectName: "智能代码评测系统",
    projectPeriod: "2026-02 - 2026-04",
    fundCategory: "设备采购",
    amount: "¥12,800",
    conclusion: "建议驳回，超过单项采购上限且缺少比价材料。",
    riskScore: 81,
    summary: "涉及高金额设备采购，需补交比价单和审批说明。",
    materials: [
      { label: "票据", value: "发票 1 份，已上传", status: "uploaded" },
      { label: "支付记录", value: "银行回单 1 份", status: "uploaded" },
      { label: "材料清单", value: "", status: "blank" },
    ],
    riskRows: [
      {
        seq: "1",
        item: "评测服务器",
        amount: "¥12,800",
        tag: "金额超限",
        riskDesc: "超过设备采购单项上限，需审批说明",
        suggestion: "补充比价单或拆分申报",
      },
      {
        seq: "汇总",
        item: "全部支出",
        amount: "¥12,800",
        tag: "材料不完整",
        riskDesc: "未提供材料清单，完整度不足",
        suggestion: "补交签章清单后重新提交",
      },
    ],
    findings: [
      { title: "金额上限", level: "高", detail: "超过设备采购单项上限。" },
      { title: "比价材料", level: "高", detail: "未提供至少三家比价记录。" },
      { title: "项目周期", level: "中", detail: "采购时间略晚于登记周期中段。" },
    ],
    recommendations: ["补充比价单和审批说明", "拆分采购或重新申报类别"],
    aiNotes: ["模型检测到金额异常集中。", "材料清单缺失使完整度评分下降。"],
  },
];

export const adminQueue: QueueItem[] = [
  {
    id: "2026-041",
    projectName: "校园协同开发平台",
    risk: 22,
    status: "待审核",
    owner: "软件工程学院 张同学",
    submittedAt: "今天 09:42",
    category: "软件订阅",
  },
  {
    id: "2026-042",
    projectName: "智能代码评测系统",
    risk: 81,
    status: "待审核",
    owner: "软件工程学院 李同学",
    submittedAt: "今天 10:14",
    category: "设备采购",
  },
  {
    id: "2026-039",
    projectName: "移动端课题管理工具",
    risk: 44,
    status: "通过",
    owner: "软件工程学院 王同学",
    submittedAt: "昨日 18:20",
    category: "差旅交通",
  },
];

export const auditRules: RuleItem[] = [
  { id: "limit", title: "金额上限", value: "单笔 ¥10,000", detail: "超过上限自动标记高风险。" },
  { id: "ddl", title: "材料提交截止", value: "2026-06-10 18:00", detail: "超时进入补交流程。" },
  { id: "category", title: "可报销类别", value: "软件订阅 / 设备采购 / 差旅交通", detail: "不在白名单的类别将提醒人工复核。" },
  { id: "special", title: "特殊材料", value: "比价单 / 签章清单 / 会议纪要", detail: "按学院规则扩展。" },
];

export const operationLogs: OperationLog[] = [
  { id: "log-1", actor: "财务老师", action: "批量通过", target: "3 条低风险提交", time: "10:28" },
  { id: "log-2", actor: "系统", action: "自动标红", target: "智慧农场传感器套件", time: "10:15" },
  { id: "log-3", actor: "审核员", action: "退回补交", target: "校园低碳配送小车", time: "09:58" },
];

export const reportMaterialTypes = [
  "票据",
  "支付记录",
  "材料清单",
  "比价单",
  "签章页",
  "补充说明",
];

export const defaultRules = {
  allowedCategories: ["软件订阅", "设备采购", "差旅交通"],
  amountLimit: "¥10,000",
  deadline: "2026-06-10 18:00",
  specialMaterials: ["比价单", "签章清单", "会议纪要"],
};

export function getReportById(id: string) {
  return featuredReports.find((item) => item.id === id) ?? featuredReports[0];
}
