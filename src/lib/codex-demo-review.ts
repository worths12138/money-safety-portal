import type { ReportFinding, RiskRow } from "@/lib/site-data";
import type { SubmissionRow } from "@/lib/supabase/types";

export const CODEX_DEMO_REVIEW_TITLE = "codex审核";
export const KIMI_DEMO_REVIEW_TITLE = "kimi审核";
export const CODEX_DEMO_REVIEW_DELAY_MS = 18_000;

type DemoReviewData = {
  riskScore: number;
  summary: string;
  conclusion: string;
  riskRows: RiskRow[];
  findings: ReportFinding[];
  recommendations: string[];
};

type DemoReviewResult = DemoReviewData & {
  markdown: string;
  aiNotes: string[];
};

export function isCodexDemoReview(submission: Pick<SubmissionRow, "project_name">) {
  const title = submission.project_name.trim();
  return title === CODEX_DEMO_REVIEW_TITLE || title === KIMI_DEMO_REVIEW_TITLE;
}

export async function waitForCodexDemoReview(
  onProgress?: (elapsedSeconds: number, remainingSeconds: number) => void,
) {
  const startedAt = Date.now();
  const totalSeconds = Math.ceil(CODEX_DEMO_REVIEW_DELAY_MS / 1000);

  onProgress?.(0, totalSeconds);

  while (Date.now() - startedAt < CODEX_DEMO_REVIEW_DELAY_MS) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const elapsedSeconds = Math.min(
      totalSeconds,
      Math.floor((Date.now() - startedAt) / 1000),
    );
    onProgress?.(elapsedSeconds, Math.max(totalSeconds - elapsedSeconds, 0));
  }
}

function parseAmountYuan(amount: string | null | undefined) {
  const normalized = String(amount ?? "").replace(/[,，\s¥￥元]/g, "");
  const match = normalized.match(/\d+(?:\.\d+)?/);
  return match ? Number.parseFloat(match[0]) : 0;
}

function normalizeDateText(text: string | null | undefined) {
  return String(text ?? "")
    .replace(/\s/g, "")
    .replace(/年|月/g, ".")
    .replace(/日/g, "")
    .replace(/-/g, ".");
}

function isKimiLowRiskCase(submission: SubmissionRow) {
  const amountYuan = parseAmountYuan(submission.amount);
  const period = normalizeDateText(submission.project_period);
  return amountYuan > 0 && amountYuan <= 300 && /2026\.0?4\.22/.test(period);
}

function amountReconNote(input: {
  declaredYuan: number;
  voucherYuan: number;
  deltaYuan: number;
  deltaPercent: number;
  severity: "warning" | "critical";
  message: string;
}) {
  return `AMOUNT_RECON:${JSON.stringify({
    ...input,
    rawVoucherYuan: input.voucherYuan,
    dedupeNotes: [],
    confidence: "low",
  })}`;
}

function buildMarkdown(submission: SubmissionRow, demo: DemoReviewData): string {
  const riskLevel = demo.riskScore >= 80 ? "高风险" : demo.riskScore >= 50 ? "中风险" : "低风险";

  return `# 大创报销材料风险审核报告

**项目题目**：${submission.project_name}
**项目周期/时间**：${submission.project_period || "待确认"}
**申报金额**：${submission.amount || "待确认"}

## 一、总体结论

${demo.conclusion}

${demo.summary}

## 二、风险逐条分析

| 序号 | 支出项 | 金额 | 风险标签 | 风险描述 | 处理建议 |
| --- | --- | --- | --- | --- | --- |
${demo.riskRows
  .map(
    (row) =>
      `| ${row.seq} | ${row.item} | ${row.amount} | ${row.tag} | ${row.riskDesc} | ${row.suggestion} |`,
  )
  .join("\n")}

## 三、风险评估评分

综合风险评分：${demo.riskScore}/100 分。风险等级：${riskLevel}。

## 四、主要风险点

${demo.findings.map((finding) => `- ${finding.title}：${finding.detail}`).join("\n")}

## 五、对教师的综合建议

${demo.recommendations.map((item) => `- ${item}`).join("\n")}
`;
}

function buildCodexReview(submission: SubmissionRow): DemoReviewResult {
  const riskRows: RiskRow[] = [
    {
      seq: "1",
      item: "信息系统服务\\软件服务（Codex）",
      amount: "178",
      tag: "时间合规性 / 支付一致性 / 材料缺失",
      riskDesc:
        "项目周期不符：项目周期为2026.2-2026.3，而发票及支付时间为2026-05-22，发生在项目结题后，原则上不予报销。（High）；收款方不一致：发票销售方为“郑州市渡轩书贸易有限公司”，但支付宝支付凭证显示收款方为“肖巧满(个人)”。（High）；存在资金流向异常风险。（High）；缺少必要佐证：申报题目含“codex”，涉及大模型API或云服务。根据规则，必须提供消耗记录（token/用量）及官网收费标准截图。目前仅有笼统的“软件服务”发票。（Medium）",
      suggestion:
        "请说明延期依据或剔除该笔支出。若无合理解释，建议拒绝。需补充情况说明及代付证明，证实该个人收款人与开票公司的关系（如个体户法人代收等），否则涉嫌违规。请上传后台消耗明细截图及对应时段的官网计价标准，按实际消耗里程核算。",
    },
    {
      seq: "2",
      item: "申报汇总",
      amount: "22",
      tag: "金额虚报",
      riskDesc: "申报金额大于凭据：申报200元，实际发票/支付金额约为178元。（Low）",
      suggestion: "建议修正报销金额为178元（若上述风险排除后）。",
    },
  ];
  const findings: ReportFinding[] = [
    {
      title: "申报总金额与凭据金额不一致",
      level: "中",
      detail: "申报总金额 ¥200 高于凭据识别合计 ¥178，差额 ¥22（约 11%），存在虚报或漏传凭证风险。",
    },
    {
      title: "时间合规性 / 支付一致性 / 材料缺失",
      level: "高",
      detail:
        "发票及支付时间为 2026-05-22，晚于项目周期 2026.2-2026.3；发票销售方与支付收款方不一致；未提供 Codex/API 消耗记录及官网收费标准截图。",
    },
    {
      title: "金额虚报",
      level: "低",
      detail: "申报金额 200 元，实际发票与支付凭证金额约 178 元。",
    },
  ];
  const recommendations = [
    "建议重点核查后再审批。",
    "请说明延期依据或剔除该笔支出；若无合理解释，建议拒绝。",
    "补充个人收款人与开票公司的关系证明、后台消耗明细截图及官网计价标准。",
    "若上述风险排除后，将报销金额修正为 178 元。",
  ];
  const message =
    "申报总金额 ¥200 高于凭据识别合计 ¥178，差额 ¥22（约 11%），存在虚报或漏传凭证风险。";
  const demo: DemoReviewData = {
    riskScore: 85,
    summary: `${message} 合规风控风险分 85/100（偏高），建议重点核查后再审批。`,
    conclusion:
      "严重时间逻辑：重点质询为何在项目结束（2026.3）两个月后（2026.5）才产生该项目的大额核心支出，防止挪用经费或补开发票行为。",
    riskRows,
    findings,
    recommendations,
  };
  const markdown = buildMarkdown(submission, demo);
  return {
    ...demo,
    markdown,
    aiNotes: [
      "演示模式：标题为 codex审核，已跳过智谱接口并按预置结果生成报告。",
      "演示耗时：约 18 秒。",
      amountReconNote({
        declaredYuan: 200,
        voucherYuan: 178,
        deltaYuan: 22,
        deltaPercent: 11,
        severity: "warning",
        message,
      }),
      markdown,
    ],
  };
}

function buildKimiHighRiskReview(submission: SubmissionRow): DemoReviewResult {
  const riskRows: RiskRow[] = [
    {
      seq: "1",
      item: "Kimi Vip 会员订阅服务（北京月之暗面科技有限公司）",
      amount: "199",
      tag: "规则违规/材料缺失",
      riskDesc:
        "命中 R014：该支出属「Kimi Vip」包月会员订阅，依据规则须补充官网收费标准截图、详细用途说明及项目期间使用记录。发票明细为「信息系统服务\\技术服务」，虽可由支付凭证佐证，但仍建议备注具体服务内容。（Medium）",
      suggestion:
        "补充北京月之暗面官网 Kimi VIP 199 元档位价格截图、书面用途说明，以及项目期间使用记录截图。",
    },
    {
      seq: "2",
      item: "未知支出项（申报余额）",
      amount: "1801",
      tag: "虚报/凭证缺失",
      riskDesc:
        "申报总额 2000 元，已识别凭证仅 199 元，差额 1801 元无任何发票、支付记录或说明，涉嫌虚报或漏传材料。（High）",
      suggestion:
        "立即整改：要么补充 1801 元对应的合规发票及支付凭证，要么将申报总金额修正为 199 元并重新提交。",
    },
  ];
  const findings: ReportFinding[] = [
    {
      title: "申报总金额与凭据金额不一致",
      level: "高",
      detail:
        "申报总金额 ¥2,000 高于凭据识别合计 ¥199，差额 ¥1,801（约 90.1%），存在虚报或漏传凭证风险。",
    },
    {
      title: "规则违规/材料缺失",
      level: "中",
      detail:
        "Kimi Vip 会员订阅需补充官网收费标准、详细用途说明，以及项目期间使用记录截图。",
    },
    {
      title: "虚报/凭证缺失",
      level: "高",
      detail: "申报余额 1801 元缺少发票、支付记录或说明。",
    },
  ];
  const recommendations = [
    "立即退回并要求解释金额差异。",
    "学生需书面说明 1801 元差额原因：是漏传材料还是误填总额。",
    "如为漏传，限期 3 个工作日内补齐所有原始凭证；如为误填，要求重新提交申请表并将总额改为 199 元。",
    "补充 Kimi VIP 官网价格截图、用途说明及项目期间使用记录截图。",
  ];
  const message =
    "申报总金额 ¥2,000 高于凭据识别合计 ¥199，差额 ¥1,801（约 90.1%），存在虚报或漏传凭证风险。";
  const demo: DemoReviewData = {
    riskScore: 85,
    summary: `${message} 合规风控风险分 85/100（高风险），存在需补充材料项，请结合下表处理。`,
    conclusion:
      "立即退回并要求解释金额差异：请学生书面说明 1801 元差额原因，是漏传材料还是误填总额；如为漏传，限期 3 个工作日内补齐所有原始凭证；如为误填，要求重新提交申请表并将总额改为 199 元。",
    riskRows,
    findings,
    recommendations,
  };
  const markdown = buildMarkdown(submission, demo);
  return {
    ...demo,
    markdown,
    aiNotes: [
      "演示模式：标题为 kimi审核，金额 2000 且周期 2026.1-2026.3，按高风险预置结果生成报告。",
      "演示耗时：约 18 秒。",
      amountReconNote({
        declaredYuan: 2000,
        voucherYuan: 199,
        deltaYuan: 1801,
        deltaPercent: 90.1,
        severity: "critical",
        message,
      }),
      markdown,
    ],
  };
}

function buildKimiLowRiskReview(submission: SubmissionRow): DemoReviewResult {
  const riskRows: RiskRow[] = [
    {
      seq: "1",
      item: "Kimi Vip 会员订阅服务（北京月之暗面科技有限公司）",
      amount: "199",
      tag: "时间合规 / 凭证一致",
      riskDesc:
        "支付记录显示交易时间为 2026年4月22日 15:27:12，发票开具日期为 2026年04月22日，票据与支付时间一致，未发现跨期或补开发票风险。（Low）",
      suggestion: "可作为项目期间合规支出进入教师复核，归档时保留发票与支付记录。",
    },
    {
      seq: "2",
      item: "会员服务用途",
      amount: "199",
      tag: "用途合理",
      riskDesc:
        "商品为 Kimi Vip，商户与发票销售方均指向北京月之暗面科技有限公司，支出可用于资料检索、文本整理、代码辅助与项目文档处理等科研辅助场景。（Low）",
      suggestion: "建议在归档说明中注明用于项目资料整理与开发辅助，便于后续抽查。",
    },
  ];
  const findings: ReportFinding[] = [
    {
      title: "时间合规",
      level: "低",
      detail:
        "支付时间与发票日期均为 2026年4月22日，时间一致，未发现跨期或结题后补开发票问题。",
    },
    {
      title: "凭证一致",
      level: "低",
      detail: "支付记录商品为 Kimi Vip，收款商户为北京月之暗面科技有限公司，与发票销售方一致。",
    },
    {
      title: "用途合理",
      level: "低",
      detail: "Kimi Vip 可用于项目资料整理、文本分析、代码辅助和文档撰写等科研辅助工作。",
    },
  ];
  const recommendations = [
    "AI 初审未发现明显风险，建议进入教师复核并可按流程通过。",
    "归档时保留 kimi发票.pdf 与 kimi支付记录.jpg，作为同一笔支出的完整凭证链。",
    "可在备注中补充一句用途说明：用于项目资料整理、文本分析及开发辅助。",
  ];
  const demo: DemoReviewData = {
    riskScore: 12,
    summary:
      "支付时间与发票日期均为 2026年4月22日，凭证链条一致，Kimi Vip 支出用途与科研辅助场景匹配。合规风控风险分 12/100（低风险），未发现明显异常。",
    conclusion:
      "Kimi Vip 会员服务支付时间为 2026年4月22日，发票开具日期同为 2026年04月22日，时间与商户信息一致，属于低风险合规支出，建议通过 AI 初审。",
    riskRows,
    findings,
    recommendations,
  };
  const markdown = buildMarkdown(submission, demo);
  return {
    ...demo,
    markdown,
    aiNotes: [
      "演示模式：标题为 kimi审核，金额 199 且时间 2026.4.22，按低风险预置结果生成报告。",
      "演示耗时：约 18 秒。",
      "Kimi 凭证时间：2026年4月22日；支付记录与发票日期一致，未触发金额或时间风险。",
      markdown,
    ],
  };
}

function buildKimiReview(submission: SubmissionRow): DemoReviewResult {
  return isKimiLowRiskCase(submission)
    ? buildKimiLowRiskReview(submission)
    : buildKimiHighRiskReview(submission);
}

export function buildCodexDemoReview(submission: SubmissionRow) {
  return submission.project_name.trim() === KIMI_DEMO_REVIEW_TITLE
    ? buildKimiReview(submission)
    : buildCodexReview(submission);
}
