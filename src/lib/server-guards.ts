type RateState = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateState>();

function clientKey(request: Request, route: string) {
  const forwarded = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "local";
  return `${route}:${forwarded.split(",")[0].trim() || "local"}`;
}

export function rateLimit(request: Request, route: string, limit = 12, windowMs = 30_000) {
  const key = clientKey(request, route);
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    const next = { count: 1, resetAt: now + windowMs };
    buckets.set(key, next);
    return { allowed: true, remaining: limit - 1, resetAt: next.resetAt };
  }

  if (current.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  buckets.set(key, current);
  return { allowed: true, remaining: Math.max(limit - current.count, 0), resetAt: current.resetAt };
}

export function timeoutResponse(message = "请求处理超时，请稍后重试。", status = 504) {
  return Response.json({ ok: false, message }, { status });
}

export async function withTimeout<T>(work: Promise<T>, ms = 8000, message = "请求处理超时，请稍后重试。") {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    });
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export function getClientTimeoutHeader(resetAt: number) {
  return { "Retry-After": String(Math.max(Math.ceil((resetAt - Date.now()) / 1000), 1)) };
}
