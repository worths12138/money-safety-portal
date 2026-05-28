import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReimbursementRagLibrary, ReimbursementRagRule } from "@/lib/rag/types";

const RULES_PATH = join(process.cwd(), "data", "reimbursement-rag-rules.json");

let cached: ReimbursementRagLibrary | null = null;

function loadLibraryFromDisk(): ReimbursementRagLibrary {
  const raw = readFileSync(RULES_PATH, "utf8");
  const parsed = JSON.parse(raw) as ReimbursementRagLibrary;
  if (!Array.isArray(parsed.rules)) {
    throw new Error("RAG 规则库格式错误：缺少 rules 数组。");
  }
  return parsed;
}

export function getReimbursementRagLibrary(): ReimbursementRagLibrary {
  if (!cached) {
    cached = loadLibraryFromDisk();
  }
  return cached;
}

export function getAllReimbursementRagRules(): ReimbursementRagRule[] {
  return getReimbursementRagLibrary().rules;
}

export function getReimbursementRagMeta() {
  return getReimbursementRagLibrary().meta;
}
