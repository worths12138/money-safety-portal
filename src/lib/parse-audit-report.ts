import type { ReportFinding, RiskRow } from "@/lib/site-data";
import {
  normalizeRiskScore,
  riskConclusionFallback,
  riskSummaryFallback,
} from "@/lib/risk-score";

const INTEGRITY_TABLE_MARKERS =
  /支出项\s*\/\s*申报项|发票\s*\/\s*票据|支付记录|消耗\s*\/\s*使用证明|其他必要附件|整体申报材料|严重不全|核查结论/i;

/** 生成入库/展示用纯文本：去 **、Markdown 表格、第一节完整性表格与核查结论段 */
export function sanitizeReportText(text: string): string {
  if (!text?.trim()) return "";

  let s = text;

  s = s.replace(/\*\*/g, "").replace(/(?<!\*)\*(?!\*)/g, "");

  s = s
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      const pipes = (trimmed.match(/\|/g) || []).length;
      if (pipes >= 2) return false;
      if (/^:?-{2,}:?$/.test(trimmed.replace(/\|/g, "").trim())) return false;
      return true;
    })
    .join("\n");

  s = s.replace(/\|[^|\n]+(\|[^|\n]+){2,}/g, " ");

  s = s.replace(/支出项\s*\/\s*申报项[\s\S]*?(?=核查结论|##\s|$)/gi, "");
  s = s.replace(/核查结论[：:][\s\S]*/gi, "");
  s = s.replace(/(?:\d+\.\s*)?原始凭证缺失[^。\n]*[。]?/gi, "");
  s = s.replace(/PDF\s*(文档)?\s*提取失败[^。\n|]*/gi, "");
  s = s.replace(/整体申报材料[\s\S]*?严重不全/gi, "");
  s = s.replace(/[❌✅]\s*缺失\s*\([^)]*\)/g, "");

  s = s
    .replace(/Agent\s*风控评分\s*\d+\s*\/\s*100[。.]?\s*/gi, "")
    .replace(/Agent\s*已完成风控评估[。.]?\s*/gi, "");

  return s
    .replace(/^#+\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isIntegrityGarbage(text: string): boolean {
  return INTEGRITY_TABLE_MARKERS.test(text) || (text.match(/\|/g)?.length ?? 0) >= 2;
}

/** @deprecated 使用 sanitizeReportText */
export function stripMarkdownForDisplay(text: string): string {
  return sanitizeReportText(text);
}

function removeAgentBoilerplate(text: string): string {
  return sanitizeReportText(text);
}

function cleanCell(cell: string): string {
  const v = sanitizeReportText(cell);
  return v || "—";
}

export function parseRiskScore(markdown: string): number {
  const patterns = [
    /合规风控风险分[：:]\s*(\d{1,3})\s*\/\s*100/,
    /综合风险评分[：:]\s*(\d{1,3})\s*\/\s*100/,
    /风险评分[：:]\s*(\d{1,3})\s*\/\s*100/,
    /(\d{1,3})\s*\/\s*100\s*分/,
  ];
  for (const pattern of patterns) {
    const match = markdown.match(pattern);
    if (match) {
      const score = Number.parseInt(match[1], 10);
      if (score >= 0 && score <= 100) return normalizeRiskScore(score);
    }
  }
  return 50;
}

function riskLevelToFindingLevel(level: string): ReportFinding["level"] {
  if (level.includes("高")) return "高";
  if (level.includes("中")) return "中";
  return "低";
}

export function parseRiskRows(markdown: string): RiskRow[] {
  const section = markdown.split(/##\s*二、风险逐条分析/i)[1];
  if (!section) return [];

  const tablePart = section.split(/##\s*三、/i)[0] ?? section;
  const lines = tablePart.split("\n").filter((line) => line.trim().startsWith("|"));
  const dataLines = lines.filter((line) => !line.includes("---") && !line.includes("序号"));

  return dataLines
    .map((line) => line.split("|").map((cell) => cell.trim()).filter(Boolean))
    .filter((cells) => cells.length >= 6)
    .map((cells, index) => {
      const hasRiskLevelCol = cells.length >= 7;
      return {
        seq: cleanCell(cells[0] || String(index + 1)),
        item: cleanCell(cells[1] || "—"),
        amount: cleanCell(cells[2] || "待确认"),
        tag: cleanCell(cells[3] || "待核实"),
        riskDesc: cleanCell(
          hasRiskLevelCol ? `${cells[4] || "—"}（${cells[5] || ""}）` : cells[4] || "—",
        ),
        suggestion: cleanCell(hasRiskLevelCol ? cells[6] || "请补充材料" : cells[5] || "请补充材料"),
      };
    });
}

export function parseFindings(_markdown: string, riskRows: RiskRow[]): ReportFinding[] {
  return riskRows.slice(0, 5).map((row) => ({
    title: row.item,
    level: riskLevelToFindingLevel(row.riskDesc),
    detail: sanitizeReportText(`${row.tag}：${row.riskDesc}`),
  }));
}

export function parseRecommendations(markdown: string): string[] {
  const section = markdown.split(/##\s*五、对教师的综合建议/i)[1];
  if (!section) return [];

  const body = section.split(/---/)[0] ?? section;
  const bullets = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line) || /^\d+[.)]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, "").replace(/^\d+[.)]\s+/, "").trim())
    .map((line) => sanitizeReportText(line))
    .filter((line) => line.length > 8 && !isIntegrityGarbage(line));

  if (bullets.length > 0) return bullets.slice(0, 5);

  const paragraphs = body
    .split("\n")
    .map((line) => sanitizeReportText(line))
    .filter((line) => line.length > 12 && !isIntegrityGarbage(line));

  return paragraphs.slice(0, 3);
}

export function parseConclusion(markdown: string, riskScore: number): string {
  const recs = parseRecommendations(markdown).filter(
    (r) => !/紧急核对申报金额|六百万元|6[,，]?\s*000[,，]?\s*000|录入错误/i.test(r),
  );

  const preferred = recs.find((r) => r.length <= 120) ?? recs[0];
  if (preferred) {
    return sanitizeReportText(preferred).slice(0, 160);
  }

  return riskConclusionFallback(riskScore);
}

export function parseSummary(markdown: string, riskScore: number): string {
  const section3 = markdown.split(/##\s*三、风险评估评分/i)[1]?.split(/##\s*四、/i)[0] ?? "";
  const scoreMatch = section3.match(/(?:合规风控风险分|综合风险评分)[：:]\s*(\d{1,3})\s*\/\s*100/);
  const score = scoreMatch ? Number.parseInt(scoreMatch[1], 10) : riskScore;

  const prose = sanitizeReportText(
    section3.replace(/(?:合规风控风险分|综合风险评分)[：:]\s*\d{1,3}\s*\/\s*100\s*分?[^。\n]*/gi, ""),
  );

  if (prose.length >= 16 && !isIntegrityGarbage(prose)) {
    return `合规风控风险分 ${score}/100（越高风险越大）。${prose.slice(0, 100)}`;
  }

  return riskSummaryFallback(score);
}

/** 报告页展示时清洗历史脏数据 */
export function formatConclusionForDisplay(conclusion: string, riskScore: number): string {
  const cleaned = removeAgentBoilerplate(conclusion);
  if (cleaned.length >= 12 && !isIntegrityGarbage(cleaned)) return cleaned.slice(0, 200);

  return riskConclusionFallback(riskScore);
}

export function formatSummaryForDisplay(summary: string): string {
  const cleaned = removeAgentBoilerplate(summary);
  if (cleaned.length >= 8 && !isIntegrityGarbage(cleaned)) return cleaned.slice(0, 280);
  return "详见下方风险表格与处理建议。";
}

/** 读取库内记录时统一清洗各文本字段 */
export function sanitizeReportFields<T extends {
  conclusion?: string;
  summary?: string;
  recommendations?: string[];
  findings?: ReportFinding[];
  riskRows?: RiskRow[];
}>(data: T): T {
  return {
    ...data,
    conclusion: data.conclusion ? sanitizeReportText(data.conclusion) : data.conclusion,
    summary: data.summary ? sanitizeReportText(data.summary) : data.summary,
    recommendations: data.recommendations?.map((r) => sanitizeReportText(r)).filter(Boolean),
    findings: data.findings?.map((f) => ({
      ...f,
      title: sanitizeReportText(f.title),
      detail: sanitizeReportText(f.detail),
    })),
    riskRows: data.riskRows?.map((row) => ({
      ...row,
      item: cleanCell(row.item),
      amount: cleanCell(row.amount),
      tag: cleanCell(row.tag),
      riskDesc: cleanCell(row.riskDesc),
      suggestion: cleanCell(row.suggestion),
    })),
  };
}
