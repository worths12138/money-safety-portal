import { NextResponse } from "next/server";
import { runAgentReview } from "@/lib/agent-review";
import { ensureSupabaseConfigured } from "@/lib/api-config";
import { rateLimit, getClientTimeoutHeader, timeoutResponse, withTimeout } from "@/lib/server-guards";
import { createSubmission, getReportById, type SubmissionPayload } from "@/lib/submissions-db";
import { MAX_MATERIAL_FILES, MAX_MATERIAL_MB } from "@/lib/material-limits";
import { resolveRunAgentOnSubmit, submissionJsonParseTimeoutMs } from "@/lib/submit-agent-config";
import { saveServerMaterials } from "@/lib/report-material-cache-server";

export const maxDuration = 300;

const MAX_MATERIAL_BYTES = MAX_MATERIAL_MB * 1024 * 1024;

function validateMaterials(materials: SubmissionPayload["materials"]) {
  if (!materials?.length) return materials;
  if (materials.length > MAX_MATERIAL_FILES) {
    throw new Error(`凭证最多上传 ${MAX_MATERIAL_FILES} 个文件。`);
  }
  for (const m of materials) {
    const size = Math.ceil((m.b64.length * 3) / 4);
    if (size > MAX_MATERIAL_BYTES) {
      throw new Error(`文件 ${m.name} 超过 ${MAX_MATERIAL_MB}MB 限制。`);
    }
  }
  return materials;
}

export async function POST(request: Request) {
  const configError = ensureSupabaseConfigured();
  if (configError) {
    return configError;
  }

  const limited = rateLimit(request, "submissions", 6, 60_000);
  if (!limited.allowed) {
    return NextResponse.json(
      { ok: false, message: "访问过快，请稍后再试。" },
      { status: 429, headers: getClientTimeoutHeader(limited.resetAt) },
    );
  }

  try {
    const payload = (await withTimeout(
      request.json(),
      submissionJsonParseTimeoutMs(),
    )) as SubmissionPayload;
    validateMaterials(payload.materials);

    const materialFiles =
      payload.materialFiles ??
      payload.materials?.map((m) => m.name) ??
      [];

    const runAgent = resolveRunAgentOnSubmit(payload.runAgent);
    const report = await withTimeout(
      createSubmission({ ...payload, materialFiles }, { deferAgent: !runAgent }),
      8_000,
    );

    if (payload.materials?.length) {
      saveServerMaterials(report.id, payload.materials);
    }

    let message = runAgent
      ? "申报成功，Agent 正在识图并生成风控报告…"
      : "申报已入库。请在运营台对该条记录点击「AI 初审」，或稍后在报告页重新评估。";

    if (runAgent) {
      try {
        await withTimeout(
          runAgentReview({
            reportId: report.id,
            materialFiles,
            materials: payload.materials,
          }),
          240_000,
          "Agent 识图评估超时，请稍后在运营台或报告页重新发起 AI 初审。",
        );
        message = payload.materials?.length
          ? "申报成功，Agent 已完成凭证识图与风控评估。"
          : "申报成功，Agent 已完成风控评估。";
      } catch (agentError) {
        const agentMessage = agentError instanceof Error ? agentError.message : "Agent 评估失败";
        message = `申报已入库，但 Agent 评估未完成：${agentMessage}`;
      }
    }

    const latest = (await getReportById(report.id)) ?? report;

    return NextResponse.json({
      ok: true,
      id: report.id,
      message,
      report: latest,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("超时")) {
      return timeoutResponse();
    }

    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "提交失败，请检查字段后重试。" },
      { status: 400 },
    );
  }
}
