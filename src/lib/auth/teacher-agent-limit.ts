import { teacherAgentDailyLimit } from "@/lib/auth/config";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function dayKey(teacherId: string) {
  const d = new Date();
  return `${teacherId}:${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

export function checkTeacherAgentQuota(teacherId: string) {
  const limit = teacherAgentDailyLimit();
  const key = dayKey(teacherId);
  const now = Date.now();
  const endOfDay = new Date();
  endOfDay.setUTCHours(23, 59, 59, 999);

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: endOfDay.getTime() };
    buckets.set(key, bucket);
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      limit,
      message: `今日 AI 初审次数已达上限（${limit} 次），请明日再试或联系管理员。`,
    };
  }

  bucket.count += 1;
  return {
    allowed: true,
    remaining: limit - bucket.count,
    limit,
    message: "",
  };
}
