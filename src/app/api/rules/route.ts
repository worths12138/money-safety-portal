import { NextResponse } from "next/server";
import { getComplianceRules, saveComplianceRules } from "@/lib/compliance-rules";
import { rateLimit, getClientTimeoutHeader, timeoutResponse, withTimeout } from "@/lib/server-guards";

export async function GET(request: Request) {
  const limited = rateLimit(request, "rules-get", 30, 30_000);
  if (!limited.allowed) {
    return NextResponse.json(
      { ok: false, message: "规则读取过快，请稍后重试。" },
      { status: 429, headers: getClientTimeoutHeader(limited.resetAt) },
    );
  }

  try {
    const rules = await withTimeout(getComplianceRules(), 5_000);
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
    const payload = (await withTimeout(request.json(), 8_000)) as {
      allowedCategories: string[];
      amountLimit: string;
      deadline: string;
      specialMaterials: string[];
    };

    const rules = await withTimeout(saveComplianceRules(payload), 8_000);
    const persistHint =
      rules.storage === "memory"
        ? "规则已保存（当前未配置 Supabase，仅本次服务运行有效）。"
        : "规则已保存，将作用于后续 Agent 审核与材料审核。";

    return NextResponse.json({ ok: true, message: persistHint, rules });
  } catch (error) {
    if (error instanceof Error && error.message.includes("超时")) {
      return timeoutResponse();
    }

    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "规则保存失败。" },
      { status: 500 },
    );
  }
}
