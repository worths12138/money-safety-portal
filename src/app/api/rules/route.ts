import { NextResponse } from "next/server";
import { defaultRules } from "@/lib/site-data";
import { rateLimit, getClientTimeoutHeader, timeoutResponse, withTimeout } from "@/lib/server-guards";

let currentRules = defaultRules;

export async function GET(request: Request) {
  const limited = rateLimit(request, "rules-get", 30, 30_000);
  if (!limited.allowed) {
    return NextResponse.json(
      { ok: false, message: "规则读取过快，请稍后重试。" },
      { status: 429, headers: getClientTimeoutHeader(limited.resetAt) },
    );
  }

  try {
    const rules = await withTimeout(Promise.resolve(currentRules), 5_000);
    return NextResponse.json({ ok: true, rules });
  } catch (error) {
    if (error instanceof Error && error.message.includes("超时")) {
      return timeoutResponse();
    }

    return NextResponse.json({ ok: false, message: "规则读取失败。" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, "rules-put", 8, 60_000);
  if (!limited.allowed) {
    return NextResponse.json(
      { ok: false, message: "规则保存过于频繁。" },
      { status: 429, headers: getClientTimeoutHeader(limited.resetAt) },
    );
  }

  try {
    const payload = (await withTimeout(request.json(), 8_000)) as typeof defaultRules;
    currentRules = payload;
    return NextResponse.json({ ok: true, message: "规则已保存。", rules: currentRules });
  } catch (error) {
    if (error instanceof Error && error.message.includes("超时")) {
      return timeoutResponse();
    }

    return NextResponse.json({ ok: false, message: "规则保存失败。" }, { status: 500 });
  }
}
