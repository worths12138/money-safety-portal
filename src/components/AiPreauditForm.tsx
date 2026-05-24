"use client";

import { type DragEvent, type FormEvent, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  materialCountWarnMessage,
  MAX_MATERIAL_FILES,
  MAX_MATERIAL_MB,
} from "@/lib/material-limits";

const ACCEPTED_EXTENSIONS = [".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".heic"];
const VISION_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".webp"];
const ACCEPT_INPUT =
  ".pdf,.doc,.docx,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const blankForm = {
  projectName: "",
  projectPeriod: "",
  amount: "",
  notes: "",
};

type StoredFile = {
  key: string;
  file: File;
};

const wrapStyle: CSSProperties = {
  maxWidth: "100%",
  margin: "0 auto",
  fontFamily: "system-ui,-apple-system,sans-serif",
  color: "#111827",
};

const cardStyle: CSSProperties = {
  background: "#fff",
  border: "0.5px solid #e5e7eb",
  borderRadius: 12,
  padding: "18px 22px",
  marginBottom: 14,
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: "#6b7280",
  display: "block",
  marginBottom: 6,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "0.5px solid #d1d5db",
  borderRadius: 8,
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const primaryBtnStyle = (on: boolean): CSSProperties => ({
  padding: "10px 22px",
  borderRadius: 8,
  border: "none",
  fontSize: 14,
  fontWeight: 500,
  cursor: on ? "pointer" : "default",
  background: on ? "#1d4ed8" : "#e5e7eb",
  color: on ? "#fff" : "#9ca3af",
  transition: "background .15s",
  fontFamily: "inherit",
});

function isAcceptedFile(file: File) {
  const lower = file.name.toLowerCase();
  if (ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) return true;
  return file.type.startsWith("image/") || file.type === "application/pdf" || file.type.includes("word");
}

function isVisionFile(file: File) {
  const lower = file.name.toLowerCase();
  if (VISION_EXTENSIONS.some((ext) => lower.endsWith(ext))) return true;
  return file.type === "application/pdf" || ["image/jpeg", "image/png", "image/webp"].includes(file.type);
}

function mergeFiles(current: StoredFile[], incoming: FileList | null) {
  if (!incoming) return current;
  const map = new Map(current.map((item) => [item.key, item]));
  for (const file of Array.from(incoming)) {
    if (!isAcceptedFile(file)) continue;
    if (file.size > MAX_MATERIAL_MB * 1024 * 1024) continue;
    const key = `${file.name}-${file.size}`;
    if (!map.has(key)) map.set(key, { key, file });
  }
  return Array.from(map.values()).slice(0, MAX_MATERIAL_FILES);
}

function fileToBase64(file: File): Promise<{ name: string; type: string; b64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve({
        name: file.name,
        type: file.type || "application/octet-stream",
        b64: result.split(",")[1] ?? "",
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function AiPreauditForm() {
  const router = useRouter();
  const [form, setForm] = useState(blankForm);
  const [storedFiles, setStoredFiles] = useState<StoredFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("填写申报信息并上传凭证后，提交将自动识图并生成风控报告。");

  const visionCount = useMemo(() => storedFiles.filter((s) => isVisionFile(s.file)).length, [storedFiles]);
  const nonVisionCount = storedFiles.length - visionCount;
  const manyMaterialsWarn = useMemo(() => materialCountWarnMessage(visionCount), [visionCount]);

  function updateField(name: keyof typeof blankForm, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function addFiles(files: FileList | null) {
    setStoredFiles((current) => mergeFiles(current, files));
  }

  function removeFile(key: string) {
    setStoredFiles((current) => current.filter((item) => item.key !== key));
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
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
    setStatus("正在上传凭证：PDF 本地解析 + 图片金额识图，随后生成风控报告…");

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 240_000);

    try {
      const visionFiles = storedFiles.filter((s) => isVisionFile(s.file)).map((s) => s.file);
      setStatus(`正在编码 ${visionFiles.length} 份识图凭证…`);
      const materials = await Promise.all(visionFiles.map(fileToBase64));

      setStatus("正在提交并生成风控报告（约 1～4 分钟，请勿关闭页面）…");

      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          materialFiles: storedFiles.map((s) => s.file.name),
          materials,
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
      const message =
        error instanceof DOMException && error.name === "AbortError"
          ? "请求超时（凭证较多时常见）。请缩小图片体积或减少文件数后重试，或稍后在报告页使用「重新识图评估」。"
          : error instanceof Error
            ? error.message
            : "提交失败，请检查网络后重试。";
      setStatus(`❌ ${message}`);
    } finally {
      window.clearTimeout(timer);
      setSubmitting(false);
    }
  }

  return (
    <div style={wrapStyle}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: "#111827" }}>AI 风控预审</h1>
        <p style={{ fontSize: 12, color: "#9ca3af", margin: "5px 0 0", lineHeight: 1.6 }}>
          合规申报信息入库 · 凭证多模态识图 · 自动生成可解释风控报告（格式与风控报告页一致）
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={cardStyle}>
          <p style={{ ...labelStyle, marginBottom: 12, fontSize: 13, color: "#374151" }}>一、合规申报信息</p>
          <div style={{ display: "grid", gap: 12 }}>
            <label>
              <span style={labelStyle}>项目题目</span>
              <input
                style={inputStyle}
                required
                disabled={submitting}
                placeholder="例：基于大语言模型的智能代码审查系统研究"
                value={form.projectName}
                onChange={(e) => updateField("projectName", e.target.value)}
              />
            </label>
            <label>
              <span style={labelStyle}>项目周期</span>
              <input
                style={inputStyle}
                required
                disabled={submitting}
                placeholder="2026-03 - 2026-05"
                value={form.projectPeriod}
                onChange={(e) => updateField("projectPeriod", e.target.value)}
              />
            </label>
            <label>
              <span style={labelStyle}>申报总金额</span>
              <input
                style={inputStyle}
                required
                disabled={submitting}
                placeholder="¥4,860"
                value={form.amount}
                onChange={(e) => updateField("amount", e.target.value)}
              />
            </label>
            <label>
              <span style={labelStyle}>补充说明</span>
              <textarea
                style={{ ...inputStyle, minHeight: 88, resize: "vertical" }}
                disabled={submitting}
                placeholder="特殊合规说明、补证情况等"
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
              />
            </label>
          </div>
        </div>

        <div style={cardStyle}>
          <p style={{ ...labelStyle, marginBottom: 12, fontSize: 13, color: "#374151" }}>二、上传报销凭证</p>
          <label
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            style={{
              display: "block",
              border: `1.5px dashed ${dragging ? "#93c5fd" : "#d1d5db"}`,
              borderRadius: 10,
              padding: "22px 20px",
              textAlign: "center",
              cursor: submitting ? "default" : "pointer",
              background: dragging ? "#eff6ff" : "#fafafa",
            }}
          >
            <input
              type="file"
              multiple
              accept={ACCEPT_INPUT}
              disabled={submitting}
              style={{ display: "none" }}
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <div style={{ fontSize: 26, marginBottom: 6 }}>📁</div>
            <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>点击或拖拽上传（PDF / JPG / PNG / WEBP）</p>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#9ca3af" }}>
              PDF 本地解析（PyMuPDF 优先）；图片视觉审核 · 单文件 ≤ {MAX_MATERIAL_MB}MB · 最多 {MAX_MATERIAL_FILES} 个 · 8 份以上可能接近超时
            </p>
          </label>

          {storedFiles.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              {storedFiles.map(({ key, file }) => (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 10px",
                    borderRadius: 8,
                    border: "0.5px solid #e5e7eb",
                    marginBottom: 6,
                    fontSize: 12,
                  }}
                >
                  <span>{isVisionFile(file) ? "🖼️" : "📄"}</span>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {file.name}
                  </span>
                  <span style={{ color: "#9ca3af" }}>{(file.size / 1024).toFixed(0)}KB</span>
                  {!submitting ? (
                    <button type="button" onClick={() => removeFile(key)} style={{ border: "none", background: "none", cursor: "pointer", color: "#9ca3af" }}>
                      ×
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <button type="submit" disabled={submitting || visionCount === 0} style={primaryBtnStyle(!submitting && visionCount > 0)}>
            {submitting ? "识图审核中…" : "提交并生成风控报告"}
          </button>
        </div>

        {visionCount === 0 ? (
          <p style={{ fontSize: 12, color: "#b45309", margin: "0 0 8px" }}>请至少上传 1 份 PDF 或图片凭证。</p>
        ) : null}
        {manyMaterialsWarn ? (
          <p style={{ fontSize: 12, color: "#b45309", margin: "0 0 8px", lineHeight: 1.6 }}>{manyMaterialsWarn}</p>
        ) : null}
        {nonVisionCount > 0 ? (
          <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 8px" }}>
            {nonVisionCount} 个 Word 等文件仅登记文件名，不参与识图。
          </p>
        ) : null}

        <div
          style={{
            ...cardStyle,
            marginBottom: 0,
            background: status.startsWith("❌") ? "#fef2f2" : submitting ? "#f0f9ff" : "#f9fafb",
            borderColor: status.startsWith("❌") ? "#fecaca" : submitting ? "#bae6fd" : "#e5e7eb",
          }}
        >
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: status.startsWith("❌") ? "#dc2626" : "#374151" }}>
            {status}
          </p>
        </div>
      </form>
    </div>
  );
}
