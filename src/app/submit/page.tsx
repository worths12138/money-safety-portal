"use client";

import Link from "next/link";
import { type DragEvent, type FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const ACCEPTED_EXTENSIONS = [".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".heic"];
const ACCEPT_INPUT =
  ".pdf,.doc,.docx,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const blankForm = {
  projectName: "",
  projectPeriod: "",
  amount: "",
  notes: "",
};

function isAcceptedFile(file: File) {
  const lower = file.name.toLowerCase();
  if (ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return true;
  }
  return file.type.startsWith("image/") || file.type === "application/pdf" || file.type.includes("word");
}

function mergeFileNames(current: string[], incoming: FileList | null) {
  if (!incoming) {
    return current;
  }
  const names = new Set(current);
  for (const file of Array.from(incoming)) {
    if (isAcceptedFile(file)) {
      names.add(file.name);
    }
  }
  return Array.from(names);
}

export default function SubmitPage() {
  const router = useRouter();
  const [form, setForm] = useState(blankForm);
  const [materialFiles, setMaterialFiles] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("等待提交");

  const summaryCards = useMemo(
    () => [
      { label: "凭证格式", value: "PDF / Word / 图片" },
      { label: "超时处理", value: "8 秒后自动中止请求" },
      { label: "防重复提交", value: "按钮提交中会被锁定" },
    ],
    [],
  );

  function updateField(name: keyof typeof blankForm, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function addFiles(files: FileList | null) {
    setMaterialFiles((current) => mergeFileNames(current, files));
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }
    setDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus("正在提交并等待 Agent 风控评估...");

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          materialFiles,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? "提交失败");
      }

      const payload = (await response.json()) as { id: string; message: string };
      setStatus(payload.message);
      router.push(`/report/${payload.id}`);
    } catch (error) {
      const message = error instanceof DOMException && error.name === "AbortError"
        ? "请求超时，已自动中止，请稍后重试。"
        : error instanceof Error
          ? error.message
          : "提交失败，请检查网络后重试。";
      setStatus(message);
    } finally {
      window.clearTimeout(timer);
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="sysu-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-700">/submit</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">提交合规申报</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              填写项目名、周期与申报金额后，在同一区域上传发票、支付凭证与清单等佐证材料。支持 PDF、Word 与常见图片格式；未上传项在风控报告中保持留白。
            </p>
          </div>
          <Link href="/admin" className="border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50">
            去后台查看
          </Link>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">项目名</span>
              <input className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-blue-500" value={form.projectName} onChange={(event) => updateField("projectName", event.target.value)} placeholder="例如：智能代码评测系统" required />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">项目周期</span>
              <input className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-blue-500" value={form.projectPeriod} onChange={(event) => updateField("projectPeriod", event.target.value)} placeholder="2026-03 - 2026-05" required />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">金额</span>
              <input className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-blue-500" value={form.amount} onChange={(event) => updateField("amount", event.target.value)} placeholder="¥4,860" required />
            </label>
          </div>

          <label className="space-y-2 block">
            <span className="text-sm font-medium text-slate-700">补充说明</span>
            <textarea className="min-h-28 w-full rounded-md border border-slate-200 bg-white px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-blue-500" value={form.notes} onChange={(event) => updateField("notes", event.target.value)} placeholder="如有特殊合规说明、补证情况或风险备注，请写在这里。" />
          </label>

          <label
            className={`flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-6 py-10 text-center transition ${
              dragging ? "border-blue-400 bg-blue-50/40" : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/50"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              className="hidden"
              multiple
              accept={ACCEPT_INPUT}
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />

            <span className="grid h-14 w-14 place-items-center rounded-full border border-slate-200 bg-slate-50 text-slate-600">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                <path d="M12 16V5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="m8 9 4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 20h14" strokeLinecap="round" />
                <path d="M8 17.5h8" strokeLinecap="round" />
              </svg>
            </span>

            <p className="mt-5 text-base font-semibold text-slate-900">点击或拖拽上传合规凭证</p>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
              支持 PDF、Word（.doc / .docx）及 JPG、PNG、WEBP 等图片，可一次选择多个文件。
            </p>
            <p className="mt-1 text-xs text-slate-400">发票、支付回单、支出清单、签章页等均可用于风控核验</p>

            {materialFiles.length > 0 ? (
              <ul className="mt-6 w-full max-w-lg space-y-2 text-left text-sm text-slate-700">
                {materialFiles.map((file) => (
                  <li key={file} className="rounded-md border border-slate-200 bg-white px-3 py-2 truncate">
                    {file}
                  </li>
                ))}
              </ul>
            ) : null}
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "提交中..." : "提交合规申报"}
            </button>
            <Link href="/report/2026-041" className="border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50">
              先看示例风控报告
            </Link>
          </div>
          <p className="min-h-6 text-sm text-slate-500">{status}</p>
        </form>
      </section>

      <aside className="space-y-6">
        <div className="sysu-card p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">提交说明</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-950">申报与 Agent 接口</h3>
          <p className="mt-3 text-sm leading-6 text-slate-500">申报数据经 /api/submissions 入库，并可对接 /api/agent/review 触发风控 Agent 评估。</p>
        </div>

        <div className="grid gap-4">
          {summaryCards.map((item) => (
            <div key={item.label} className="sysu-card p-5">
              <p className="text-sm text-slate-500">{item.label}</p>
              <p className="mt-2 text-lg font-semibold text-slate-950">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="sysu-card p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">已选凭证</p>
          <div className="mt-4 rounded-md border border-dashed border-slate-200 px-4 py-3">
            <p className="text-sm font-medium text-slate-700">
              {materialFiles.length ? `共 ${materialFiles.length} 个文件` : "尚未选择文件"}
            </p>
            <p className="mt-1 min-h-5 text-sm leading-6 text-slate-500">
              {materialFiles.length ? materialFiles.join(" / ") : ""}
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
