/** 合规风控运营台 — 字段与业务项定义 */

export type AdminFieldDefinition = {
  key: string;
  label: string;
  definition: string;
  source?: string;
};

/** 左侧申报队列（submissions 表）列定义 */
export const adminQueueFieldDefinitions: AdminFieldDefinition[] = [
  {
    key: "project",
    label: "项目",
    definition: "大创报销申报对应的项目信息，含项目名称、申报人（学院/姓名）及支出类别；点击项目名或「风控报告」可跳转至该条的风险评估书（/report/:id）。",
    source: "submissions.project_name / owner / category",
  },
  {
    key: "risk",
    label: "风险",
    definition: "风险分（0–100），由 Agent 预审与规则引擎综合得出；分数越高表示合规疑点越多，建议优先复核。",
    source: "submissions.risk_score",
  },
  {
    key: "status",
    label: "状态",
    definition: "人工审核结论：待审核（尚未处置）、通过（准予报销流程继续）、驳回（不予通过，可要求补证或重报）。",
    source: "submissions.status → pending / approved / rejected",
  },
  {
    key: "submittedAt",
    label: "提交时间",
    definition: "学生提交合规申报的时间，用于排序与超时提醒。",
    source: "submissions.submitted_at",
  },
  {
    key: "actions",
    label: "操作",
    definition: "运营人员对「待审核」申报执行通过或驳回；每次操作会写入审核记录且不可覆盖历史。",
    source: "POST /api/admin/review",
  },
];

/** 风险分级筛选 */
export const adminRiskFilterDefinitions: AdminFieldDefinition[] = [
  { key: "all", label: "全部", definition: "显示所有风险等级的申报。" },
  { key: "low", label: "低", definition: "风险分 < 40，材料与金额匹配度较高，可批量快审。" },
  { key: "mid", label: "中", definition: "风险分 40–69，存在材料或金额疑点，建议逐项核对。" },
  { key: "high", label: "高", definition: "风险分 ≥ 70，存在明显合规风险，优先处理。" },
];

/** 右侧审核记录（audit_records 表） */
export const adminAuditLogFieldDefinitions: AdminFieldDefinition[] = [
  {
    key: "actor",
    label: "操作人",
    definition: "执行审核处置的人员标识；当前版本无登录，默认为「运营人员」或种子数据中的角色名。",
    source: "audit_records.actor_name",
  },
  {
    key: "action",
    label: "操作类型",
    definition: "处置动作名称，如「一键通过」「一键驳回」。",
    source: "audit_records.action",
  },
  {
    key: "target",
    label: "对象",
    definition: "被审核的申报快照：项目名称、申报编号及审核结果；可通过链接打开对应风险评估书。",
    source: "audit_records.project_name + submission_id + result",
  },
  {
    key: "time",
    label: "时间",
    definition: "完成审核操作的时间点。",
    source: "audit_records.created_at",
  },
];

/** 数据实体说明（与 Supabase 表对应） */
export const adminEntityDefinitions = [
  {
    name: "申报单（submissions）",
    description: "学生提交的合规申报及当前审核状态；不含上传文件，仅存文字与风控结论。",
  },
  {
    name: "审核记录（audit_records）",
    description: "每次通过/驳回产生一条只增不改的日志，保存审核时的项目名、金额、风险分与结果快照。",
  },
] as const;
