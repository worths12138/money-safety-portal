/** 是否在「提交申报」时同步跑 Agent（生产建议 false，改由运营台触发） */

export function resolveRunAgentOnSubmit(bodyFlag?: boolean): boolean {
  if (bodyFlag === true) return true;
  if (bodyFlag === false) return false;

  const raw = process.env.AUTO_AGENT_ON_SUBMIT?.trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "yes") return true;
  if (raw === "0" || raw === "false" || raw === "no") return false;

  return false;
}

export function submissionJsonParseTimeoutMs(): number {
  const raw = Number.parseInt(process.env.SUBMISSION_JSON_TIMEOUT_MS ?? "120000", 10);
  return Number.isFinite(raw) && raw >= 30_000 ? raw : 120_000;
}
