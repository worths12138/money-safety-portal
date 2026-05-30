import { defaultRules } from "@/lib/site-data";
import { REIMBURSEMENT_RULES } from "@/lib/reimbursement-audit-prompts";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

export type ComplianceRulesConfig = {
  allowedCategories: string[];
  amountLimit: string;
  deadline: string;
  specialMaterials: string[];
};

export type ComplianceRulesRecord = ComplianceRulesConfig & {
  updatedAt?: string;
  storage: "database" | "memory";
};

const RULES_ROW_ID = "default";

const RULES_PROMPT_CACHE_MS = 60_000;
let cachedFullRulesPrompt: { value: string; at: number } | null = null;

let memoryRules: ComplianceRulesConfig = { ...defaultRules };

function normalizeConfig(input: ComplianceRulesConfig): ComplianceRulesConfig {
  return {
    allowedCategories: input.allowedCategories.map((s) => s.trim()).filter(Boolean),
    amountLimit: input.amountLimit.trim(),
    deadline: input.deadline.trim(),
    specialMaterials: input.specialMaterials.map((s) => s.trim()).filter(Boolean),
  };
}

function rowToConfig(row: {
  allowed_categories: string[] | null;
  amount_limit: string | null;
  deadline: string | null;
  special_materials: string[] | null;
  updated_at?: string;
}): ComplianceRulesRecord {
  return {
    allowedCategories: Array.isArray(row.allowed_categories) ? row.allowed_categories : defaultRules.allowedCategories,
    amountLimit: row.amount_limit ?? defaultRules.amountLimit,
    deadline: row.deadline ?? defaultRules.deadline,
    specialMaterials: Array.isArray(row.special_materials) ? row.special_materials : defaultRules.specialMaterials,
    updatedAt: row.updated_at,
    storage: "database",
  };
}

export function formatConfigurableRulesPrompt(rules: ComplianceRulesConfig): string {
  const normalized = normalizeConfig(rules);
  return `【学院可配置合规规则（规则页维护，审核时必须遵守）】
允许支出类别白名单：${normalized.allowedCategories.length ? normalized.allowedCategories.join("、") : "未配置"}
单笔金额上限：${normalized.amountLimit || "未配置"}
申报截止时间（DDL）：${normalized.deadline || "未配置"}
特殊凭证要求：${normalized.specialMaterials.length ? normalized.specialMaterials.join("、") : "未配置"}
说明：支出不在白名单、超过上限、临近或超过 DDL、缺少特殊凭证的，须在报告中明确风险等级与处理建议。`;
}

export function buildFullAuditRulesPrompt(config: ComplianceRulesConfig): string {
  return [REIMBURSEMENT_RULES, formatConfigurableRulesPrompt(config)].join("\n\n");
}

export async function getComplianceRules(): Promise<ComplianceRulesRecord> {
  if (!isSupabaseConfigured()) {
    return { ...normalizeConfig(memoryRules), storage: "memory" };
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("compliance_rules")
    .select("allowed_categories, amount_limit, deadline, special_materials, updated_at")
    .eq("id", RULES_ROW_ID)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    await saveComplianceRules(defaultRules);
    return { ...defaultRules, storage: "database" };
  }

  return rowToConfig(data);
}

export async function getFullAuditRulesPrompt(): Promise<string> {
  const now = Date.now();
  if (cachedFullRulesPrompt && now - cachedFullRulesPrompt.at < RULES_PROMPT_CACHE_MS) {
    return cachedFullRulesPrompt.value;
  }
  const rules = await getComplianceRules();
  const value = buildFullAuditRulesPrompt(rules);
  cachedFullRulesPrompt = { value, at: now };
  return value;
}

export async function saveComplianceRules(
  input: ComplianceRulesConfig,
  updatedBy = "运营人员",
): Promise<ComplianceRulesRecord> {
  const normalized = normalizeConfig(input);

  if (!isSupabaseConfigured()) {
    memoryRules = normalized;
    cachedFullRulesPrompt = null;
    return { ...normalized, storage: "memory" };
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("compliance_rules")
    .upsert({
      id: RULES_ROW_ID,
      allowed_categories: normalized.allowedCategories,
      amount_limit: normalized.amountLimit,
      deadline: normalized.deadline,
      special_materials: normalized.specialMaterials,
      updated_by: updatedBy,
    })
    .select("allowed_categories, amount_limit, deadline, special_materials, updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  memoryRules = normalized;
  cachedFullRulesPrompt = null;
  return rowToConfig(data);
}
