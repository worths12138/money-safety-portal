/** 是否启用 Supabase 登录（需配置 anon key） */
export function isAuthEnabled() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

export const DEMO_AUTH_EMAIL_DOMAIN = "msp.demo";

export function loginNameToEmail(loginName: string) {
  return `${loginName.trim().toLowerCase()}@${DEMO_AUTH_EMAIL_DOMAIN}`;
}

export function emailToLoginName(email: string) {
  const lower = email.trim().toLowerCase();
  const suffix = `@${DEMO_AUTH_EMAIL_DOMAIN}`;
  if (!lower.endsWith(suffix)) return lower.split("@")[0] ?? lower;
  return lower.slice(0, -suffix.length);
}

/** 每名学生最多保留申报条数 */
export const STUDENT_SUBMISSION_LIMIT = 10;

/** 教师每日 AI 初审次数上限（内存计数，重启清零） */
export function teacherAgentDailyLimit() {
  const raw = Number.parseInt(process.env.TEACHER_AGENT_DAILY_LIMIT ?? "30", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 30;
}
