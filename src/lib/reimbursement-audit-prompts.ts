export const REIMBURSEMENT_RULES = `【报销规则】
可报销：人文社科书籍、办公用品（笔纸本文件夹信封U盘移动硬盘，单价<1000元）、云服务/大模型API（需消耗记录+官网收费标准）、办公软件会员（需收费标准+用途说明）
不可报销：大额电子用品、邮寄、交通、培训、租赁、劳务、背包、Kindle、耳机、内置电池、触控笔、品牌专用配件
发票要求：抬头"中山大学"，税号121000004558631445，不接受复印件/扫描件
支付原则：支付金额 ≤ 发票金额（就低报销）
充值/云服务：必须提供已消耗记录，按实际消耗量报销；需官网收费标准截图
大模型API：账单须有软件名称和明细
经费上限：上学期3000元`;

export const SUBMISSION_AUDIT_SYSTEM = `你是中山大学软件工程学院大创项目报销风控专家。
请根据申报字段与报销规则输出 Markdown 风控审核报告，语言为中文。
若未提供可识图凭证，不得臆造发票内容，对无法核验项须标注「需上传凭证后复核」。
申报总金额若超过大创常规经费（通常单项目总经费约 3,000–50,000 元，百万级几乎必为录入错误），合规风控风险分必须≥90，并在金额风险汇总中将绝大部分划入高风险金额。
必须比对「申报总金额」与凭据（发票/支付记录）识别出的金额合计；不一致时须在风险表中标注「金额不符」并提高风险分。`;

export const SUBMISSION_REPORT_FORMAT = `请严格输出以下 Markdown 结构（不要省略章节标题）：

# 大创报销材料风险审核报告

**项目题目**：{title}
**报销总金额**：{amount}

---

## 一、材料完整性核查

（按支出项或申报项列出材料齐备情况；无法核验的写「需上传凭证后复核」）

---

## 二、风险逐条分析

| 序号 | 支出项 | 金额(元) | 问题类型 | 具体问题 | 风险等级 | 处理建议 |
|------|--------|---------|---------|---------|---------|---------|

---

## 三、风险评估评分

**合规风控风险分：XX / 100 分**（评分越高表示合规风险越大、疑点越多，越需优先复核；0 表示几乎无风险）

| 评估维度 | 权重 | 得分 | 说明 |
|---------|------|------|------|
| 材料完整性 | 25% | | |
| 用途相关性 | 30% | | |
| 价格合理性 | 20% | | |
| 发票规范性 | 15% | | |
| 整体一致性 | 10% | | |

---

## 四、金额风险汇总

| 类别 | 金额(元) | 占比 |
|------|---------|------|
| 报销总金额 | | 100% |
| 合规金额 | | |
| 存在风险金额 | | |
| 建议拒绝金额 | | |

---

## 五、对教师的综合建议

（3-5条可操作建议）

---
*本报告仅供参考，最终审批决定由教师负责。*`;

export function buildSubmissionAuditMessages(input: {
  projectName: string;
  projectPeriod: string;
  amount: string;
  notes?: string;
  materialFiles?: string[];
  extraText?: string;
  fullRulesPrompt: string;
}) {
  const filesLine =
    input.materialFiles && input.materialFiles.length > 0
      ? input.materialFiles.join("、")
      : "（申报时未登记文件名）";

  const userText = [
    `【申报信息】`,
    `项目题目：${input.projectName}`,
    `项目周期：${input.projectPeriod}`,
    `申报总金额：${input.amount}`,
    `补充说明：${input.notes?.trim() || "无"}`,
    `已登记凭证文件名（平台未存储文件本体，无法 OCR/识图）：${filesLine}`,
    input.fullRulesPrompt,
    input.extraText ? `【补充上下文】\n${input.extraText}` : "",
    SUBMISSION_REPORT_FORMAT.replace("{title}", input.projectName).replace("{amount}", input.amount),
  ]
    .filter(Boolean)
    .join("\n\n");

  return [{ role: "user", content: userText }];
}
