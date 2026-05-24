/**
 * 大创报销材料风险审核组件（智谱 GLM-5V-Turbo + Next.js）
 * PDF 逐份串行提取文字；图片直接作为多模态附件参与审核。
 */

"use client";

import { useCallback, useRef, useState, type CSSProperties, type ReactNode } from "react";

const PROXY_URL = "/api/audit";
const PDF_EXTRACT_URL = "/api/pdf/extract";
const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_MB = 20;
/** 扫描页 OCR 时相邻 PDF 之间的间隔，降低智谱 429 */
const PDF_REQUEST_GAP_MS = 1500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseProxyError(status: number, body: string): string {
  if (status === 429 || body.includes("1302") || body.includes("速率限制")) {
    return "智谱请求过于频繁，请等待 1～2 分钟后重试。多个 PDF 会逐份调用模型，建议减少 PDF 数量或先转为图片。";
  }
  try {
    const parsed = JSON.parse(body) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {
    /* use raw */
  }
  return `请求失败 ${status}: ${body}`;
}

type Phase = "idle" | "extracting" | "auditing" | "done" | "error";
type FileStateStatus = "pending" | "extracting" | "done" | "skipped" | "error";
type FileState = { status: FileStateStatus; label: string };
type ImageFile = { name: string; type: string; b64: string };
type PdfResult = { name: string; text: string };

type AuditMessage = {
  role: string;
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
};

const isPdf = (f: File) => f.type === "application/pdf";

const AUDIT_SYSTEM = `你是中山大学软件工程学院大创项目报销审核专家。
请结合所有文字材料和附带的图片，严格按照格式输出Markdown审核报告。
图片中可能包含发票、支付截图、订单清单等，请逐一识别并纳入分析，不得遗漏。`;

const REPORT_FORMAT = `请输出以下格式的Markdown审核报告：

# 大创报销材料风险审核报告

**项目题目**：{title}
**报销总金额**：XXX 元

---

## 一、材料完整性核查

（按支出项逐项列出：发票✅/❌、支付记录✅/❌、订单清单✅/❌、缺漏说明）

---

## 二、风险逐条分析

| 序号 | 支出项 | 金额(元) | 问题类型 | 具体问题 | 风险等级 | 处理建议 |
|------|--------|---------|---------|---------|---------|---------|

问题类型（可多选用顿号分隔）：用途相关性、价格虚高、材料缺失、发票违规、金额不符、禁止类目、数量异常、重复报销风险、私人物品风险、预充值未消耗、说明缺失、地址异常

---

## 三、风险评估评分

**合规风控风险分：XX / 100 分**（分数越高=风险越大，越需优先复核）

| 评估维度 | 权重 | 得分 | 说明 |
|---------|------|------|------|
| 材料完整性 | 25% | | |
| 用途相关性 | 30% | | |
| 价格合理性 | 20% | | |
| 发票规范性 | 15% | | |
| 整体一致性 | 10% | | |

---

## 四、金额风险汇总

| 类别 | 金额(元) | 占比 |
|------|---------|------|
| 报销总金额 | | 100% |
| 合规金额 | | |
| 存在风险金额 | | |
| 建议拒绝金额 | | |

---

## 五、对教师的综合建议

（3-5条可操作建议）

---
*本报告仅供参考，最终审批决定由教师负责。*`;

function buildAuditMessages(title: string, pdfText: string, images: ImageFile[]): AuditMessage[] {
  const textPrompt = [
    `你是中山大学软件工程学院大创项目报销审核专家。`,
    `项目题目：${title || "（未提供，用途相关性分析按通用标准判断）"}`,
    `【规则说明】报销规则与学院可配置规则已由系统在服务端注入，请严格遵循 system 中的全部规则。`,
    pdfText ? `【PDF文字材料】\n${pdfText}` : "【PDF文字材料】：无",
    images.length > 0
      ? `【图片材料】\n以下 ${images.length} 张图片已直接附在本消息中，请逐张识别发票/截图/清单等内容并纳入审核，不得遗漏。`
      : "【图片材料】：无",
    REPORT_FORMAT.replace("{title}", title || "未提供"),
  ].join("\n\n");

  const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    { type: "text", text: textPrompt },
  ];
  for (const img of images) {
    content.push({ type: "text", text: `↓ 图片文件：${img.name}` });
    content.push({
      type: "image_url",
      image_url: { url: `data:${img.type};base64,${img.b64}` },
    });
  }

  return [{ role: "user", content }];
}

async function extractPdfViaApi(file: File): Promise<string> {
  const b64 = await fileToBase64(file);
  const res = await fetch(PDF_EXTRACT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ b64, name: file.name }),
  });
  const data = (await res.json()) as { ok?: boolean; text?: string; message?: string };
  if (!res.ok || !data.ok || !data.text) {
    throw new Error(data.message || `PDF 解析失败 (${res.status})`);
  }
  return data.text;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const result = r.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function callProxy({
  messages,
  system,
  onChunk,
}: {
  messages: AuditMessage[];
  system?: string;
  onChunk?: (full: string) => void;
}) {
  const maxAttempts = 3;
  let res: Response | null = null;
  let lastBody = "";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    res = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, system }),
    });
    if (res.ok) break;
    lastBody = await res.text();
    if (res.status === 429 && attempt < maxAttempts - 1) {
      await sleep(4000 * (attempt + 1));
      continue;
    }
    throw new Error(parseProxyError(res.status, lastBody));
  }

  if (!res?.ok) {
    throw new Error(parseProxyError(res?.status ?? 500, lastBody));
  }
  if (!res.body) {
    throw new Error("响应体为空");
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of dec.decode(value).split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const d = line.slice(6).trim();
      if (d === "[DONE]") break;
      try {
        const parsed = JSON.parse(d) as { choices?: Array<{ delta?: { content?: string } }> };
        const delta = parsed.choices?.[0]?.delta?.content ?? "";
        if (delta) {
          full += delta;
          onChunk?.(full);
        }
      } catch {
        /* ignore malformed SSE chunks */
      }
    }
  }
  return full;
}

function MD({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  let tableRows: string[] = [];
  let k = 0;

  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
      if (p.startsWith("**") && p.endsWith("**")) {
        return <strong key={i}>{p.slice(2, -2)}</strong>;
      }
      if (p.startsWith("`") && p.endsWith("`")) {
        return (
          <code
            key={i}
            style={{ background: "#f3f4f6", padding: "1px 5px", borderRadius: 3, fontSize: "0.88em" }}
          >
            {p.slice(1, -1)}
          </code>
        );
      }
      return p;
    });

  const flushTable = () => {
    if (!tableRows.length) return;
    const rows = tableRows.map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
    const head = rows[0];
    const body = rows.slice(2);
    out.push(
      <div key={k++} style={{ overflowX: "auto", margin: "12px 0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {head.map((h, i) => (
                <th
                  key={i}
                  style={{
                    padding: "7px 10px",
                    textAlign: "left",
                    borderBottom: "1.5px solid #e5e7eb",
                    background: "#f9fafb",
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: "0.5px solid #f3f4f6" }}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    style={{
                      padding: "6px 10px",
                      verticalAlign: "top",
                      color: cell.includes("高风险")
                        ? "#dc2626"
                        : cell.includes("中风险")
                          ? "#d97706"
                          : cell.includes("低风险")
                            ? "#16a34a"
                            : "#374151",
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );
    tableRows = [];
  };

  for (const line of lines) {
    if (line.startsWith("|")) {
      tableRows.push(line);
      continue;
    }
    flushTable();
    if (line.startsWith("# ")) {
      out.push(
        <h1 key={k++} style={{ fontSize: 20, fontWeight: 600, margin: "20px 0 10px", color: "#111827" }}>
          {line.slice(2)}
        </h1>,
      );
    } else if (line.startsWith("## ")) {
      out.push(
        <h2
          key={k++}
          style={{
            fontSize: 15,
            fontWeight: 600,
            margin: "18px 0 8px",
            color: "#1f2937",
            borderBottom: "1px solid #e5e7eb",
            paddingBottom: 5,
          }}
        >
          {line.slice(3)}
        </h2>,
      );
    } else if (line.startsWith("### ")) {
      out.push(
        <h3 key={k++} style={{ fontSize: 13, fontWeight: 600, margin: "12px 0 4px", color: "#374151" }}>
          {line.slice(4)}
        </h3>,
      );
    } else if (line.startsWith("---")) {
      out.push(<hr key={k++} style={{ border: "none", borderTop: "0.5px solid #e5e7eb", margin: "12px 0" }} />);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      out.push(
        <li key={k++} style={{ marginLeft: 18, marginBottom: 3, fontSize: 13, color: "#374151" }}>
          {inline(line.slice(2))}
        </li>,
      );
    } else if (line.trim()) {
      out.push(
        <p key={k++} style={{ margin: "4px 0", fontSize: 13, lineHeight: 1.7, color: "#374151" }}>
          {inline(line)}
        </p>,
      );
    }
  }
  flushTable();
  return <>{out}</>;
}

export default function ReimbursementAuditor() {
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [fileStates, setFileStates] = useState<FileState[]>([]);
  const [curStream, setCurStream] = useState("");
  const [report, setReport] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const aborted = useRef(false);

  const updateFileState = (idx: number, patch: Partial<FileState>) =>
    setFileStates((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const valid = Array.from(incoming).filter(
      (f) => ACCEPTED_TYPES.includes(f.type) && f.size <= MAX_MB * 1024 * 1024,
    );
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      const next = valid.filter((f) => !names.has(f.name));
      setFileStates((ps) => [...ps, ...next.map(() => ({ status: "pending" as const, label: "" }))]);
      return [...prev, ...next];
    });
  }, []);

  const removeFile = (idx: number) => {
    setFiles((p) => p.filter((_, i) => i !== idx));
    setFileStates((p) => p.filter((_, i) => i !== idx));
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const run = async () => {
    if (!files.length) return;
    aborted.current = false;
    setPhase("extracting");
    setReport("");
    setErrMsg("");
    setCurStream("");
    setFileStates(files.map(() => ({ status: "pending", label: "" })));

    const pdfResults: PdfResult[] = [];
    const imageFiles: ImageFile[] = [];

    for (let i = 0; i < files.length; i++) {
      if (aborted.current) break;
      const f = files[i];

      if (!isPdf(f)) {
        updateFileState(i, { status: "extracting", label: "读取中…" });
        const b64 = await fileToBase64(f);
        imageFiles.push({ name: f.name, type: f.type, b64 });
        updateFileState(i, { status: "skipped", label: "图片·直接审核" });
        setCurStream("");
        continue;
      }

      updateFileState(i, { status: "extracting", label: "本地解析 PDF…" });
      setCurStream("");
      try {
        const text = await extractPdfViaApi(f);
        pdfResults.push({ name: f.name, text });
        updateFileState(i, { status: "done", label: "PDF·文字已提取" });
        const hasMorePdf = files.slice(i + 1).some(isPdf);
        if (hasMorePdf && !aborted.current) {
          updateFileState(i, { label: "PDF·已提取，等待间隔…" });
          await sleep(PDF_REQUEST_GAP_MS);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "未知错误";
        pdfResults.push({ name: f.name, text: `[提取失败：${message}]` });
        updateFileState(i, { status: "error", label: "提取失败" });
        if (message.includes("频繁") || message.includes("429")) {
          setErrMsg(message);
          setPhase("error");
          return;
        }
      }
    }

    if (aborted.current) {
      setPhase("idle");
      return;
    }

    setPhase("auditing");
    setCurStream("");

    const pdfText =
      pdfResults.length > 0
        ? pdfResults.map((r, i) => `── PDF ${i + 1}/${pdfResults.length}：${r.name} ──\n${r.text}`).join("\n\n")
        : "";

    try {
      const auditMessages = buildAuditMessages(title, pdfText, imageFiles);
      const r = await callProxy({
        messages: auditMessages,
        system: AUDIT_SYSTEM,
        onChunk: setReport,
      });
      setReport(r);
      setPhase("done");
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "审核失败");
      setPhase("error");
    }
  };

  const reset = () => {
    aborted.current = true;
    setPhase("idle");
    setFiles([]);
    setFileStates([]);
    setCurStream("");
    setReport("");
    setErrMsg("");
    setTitle("");
  };

  const isRunning = phase === "extracting" || phase === "auditing";

  const pillColor = (status: FileStateStatus) =>
    (
      {
        pending: { bg: "#f3f4f6", text: "#9ca3af" },
        extracting: { bg: "#dbeafe", text: "#1d4ed8" },
        done: { bg: "#dcfce7", text: "#15803d" },
        skipped: { bg: "#e0f2fe", text: "#0369a1" },
        error: { bg: "#fef9c3", text: "#92400e" },
      } as const
    )[status] ?? { bg: "#f3f4f6", text: "#9ca3af" };

  const activePdfIdx =
    phase === "extracting"
      ? files.findIndex((f, i) => isPdf(f) && fileStates[i]?.status === "extracting")
      : -1;

  const cardStyle: CSSProperties = {
    background: "#fff",
    border: "0.5px solid #e5e7eb",
    borderRadius: 12,
    padding: "18px 22px",
    marginBottom: 14,
  };
  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    border: "0.5px solid #d1d5db",
    borderRadius: 8,
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
  };
  const ghostBtnStyle: CSSProperties = {
    padding: "10px 18px",
    borderRadius: 8,
    border: "0.5px solid #d1d5db",
    background: "#fff",
    color: "#374151",
    fontSize: 13,
    cursor: "pointer",
  };
  const primaryBtnStyle = (on: boolean): CSSProperties => ({
    flex: 1,
    padding: "10px 0",
    borderRadius: 8,
    border: "none",
    fontSize: 14,
    fontWeight: 500,
    cursor: on ? "pointer" : "default",
    background: on ? "#1d4ed8" : "#e5e7eb",
    color: on ? "#fff" : "#9ca3af",
    transition: "background .15s",
  });

  const pdfCount = files.filter(isPdf).length;
  const imageCount = files.filter((f) => !isPdf(f)).length;

  return (
    <div
      style={{
        maxWidth: "100%",
        margin: "0 auto",
        fontFamily: "system-ui,-apple-system,sans-serif",
      }}
    >
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}`}</style>

      <div style={cardStyle}>
        <label style={{ fontSize: 12, fontWeight: 500, color: "#6b7280", display: "block", marginBottom: 6 }}>
          项目题目（用于判断用途相关性）
        </label>
        <input
          style={inputStyle}
          placeholder="例：基于大语言模型的智能代码审查系统研究"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isRunning}
        />
      </div>

      <div style={cardStyle}>
        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => !isRunning && fileInput.current?.click()}
          style={{
            border: "1.5px dashed #d1d5db",
            borderRadius: 10,
            padding: "22px 20px",
            textAlign: "center",
            cursor: isRunning ? "default" : "pointer",
            background: "#fafafa",
            marginBottom: files.length ? 14 : 0,
          }}
        >
          <div style={{ fontSize: 26, marginBottom: 6 }}>📁</div>
          <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>点击或拖拽上传（PDF / JPG / PNG / WEBP）</p>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#9ca3af" }}>
            PDF 使用 PyMuPDF / PDF.js 本地提取文字（扫描页自动 OCR）；图片直接审核 · 单文件最大 {MAX_MB}MB
          </p>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            style={{ display: "none" }}
            onChange={(e) => addFiles(e.target.files ?? [])}
          />
        </div>

        {files.map((f, i) => {
          const st = fileStates[i] ?? { status: "pending" as const, label: "" };
          const active = isRunning && st.status === "extracting";
          const pc = pillColor(st.status);
          return (
            <div
              key={f.name + i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 10px",
                borderRadius: 8,
                border: `0.5px solid ${active ? "#93c5fd" : "#e5e7eb"}`,
                background: active ? "#eff6ff" : "#fff",
                marginBottom: 6,
                transition: "all .2s",
              }}
            >
              <span style={{ fontSize: 15 }}>{isPdf(f) ? "📄" : "🖼️"}</span>
              <span
                style={{
                  flex: 1,
                  fontSize: 12,
                  color: "#374151",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {f.name}
              </span>
              <span style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap" }}>
                {(f.size / 1024).toFixed(0)}KB
              </span>
              {st.label ? (
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 20,
                    fontWeight: 500,
                    background: pc.bg,
                    color: pc.text,
                    whiteSpace: "nowrap",
                  }}
                >
                  {st.label}
                </span>
              ) : null}
              {!isRunning && st.status === "pending" ? (
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#9ca3af",
                    fontSize: 18,
                    lineHeight: 1,
                    padding: 0,
                  }}
                >
                  ×
                </button>
              ) : null}
            </div>
          );
        })}

        {files.length > 0 && !isRunning ? (
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "#9ca3af", textAlign: "right" }}>
            {pdfCount > 0 && `PDF ${pdfCount} 份（将提取文字）`}
            {pdfCount > 0 && imageCount > 0 && " · "}
            {imageCount > 0 && `图片 ${imageCount} 张（直接审核）`}
          </p>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <button
          type="button"
          onClick={run}
          disabled={!files.length || isRunning}
          style={primaryBtnStyle(files.length > 0 && !isRunning)}
        >
          {phase === "extracting"
            ? `提取文字中… (${fileStates.filter((st) => st.status === "done" || st.status === "skipped").length}/${files.length})`
            : phase === "auditing"
              ? "生成报告中…"
              : "开始审核"}
        </button>
        {isRunning || phase === "done" || phase === "error" ? (
          <button type="button" onClick={reset} style={ghostBtnStyle}>
            重置
          </button>
        ) : null}
      </div>

      {isRunning ? (
        <div style={{ ...cardStyle, background: "#f0f9ff", borderColor: "#bae6fd" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#0ea5e9",
                animation: "pulse 1.5s infinite",
              }}
            />
            <span style={{ fontSize: 13, fontWeight: 500, color: "#0c4a6e" }}>
              {phase === "auditing"
                ? `正在生成审核报告（含 ${imageCount} 张图片直接输入）…`
                : activePdfIdx >= 0
                  ? `正在提取 PDF 文字：${files[activePdfIdx]?.name}`
                  : "处理中…"}
            </span>
          </div>
          <div style={{ height: 3, background: "#e0f2fe", borderRadius: 4, overflow: "hidden", marginBottom: 10 }}>
            <div
              style={{
                height: "100%",
                borderRadius: 4,
                background: "#0ea5e9",
                transition: "width .4s ease",
                width:
                  phase === "auditing"
                    ? "100%"
                    : `${(fileStates.filter((st) => st.status === "done" || st.status === "skipped").length / files.length) * 100}%`,
              }}
            />
          </div>
          {phase === "extracting" && curStream ? (
            <pre
              style={{
                fontSize: 11,
                color: "#374151",
                background: "#fff",
                border: "0.5px solid #e0f2fe",
                borderRadius: 6,
                padding: "7px 10px",
                maxHeight: 100,
                overflow: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                margin: 0,
              }}
            >
              {curStream.slice(-500)}
            </pre>
          ) : null}
          {phase === "auditing" ? (
            <p style={{ fontSize: 11, color: "#0369a1", margin: 0 }}>
              模型正在视觉读取图片并结合 PDF 文字内容综合分析…
            </p>
          ) : null}
        </div>
      ) : null}

      {report ? (
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#111827" }}>审核报告</h2>
            <button
              type="button"
              style={ghostBtnStyle}
              onClick={() => {
                const a = document.createElement("a");
                a.href = URL.createObjectURL(new Blob([report], { type: "text/markdown;charset=utf-8" }));
                a.download = `报销审核_${new Date().toLocaleDateString("zh-CN")}.md`;
                a.click();
              }}
            >
              下载 .md
            </button>
          </div>
          <MD text={report} />
        </div>
      ) : null}

      {phase === "error" ? (
        <div style={{ ...cardStyle, background: "#fef2f2", borderColor: "#fecaca" }}>
          <p style={{ margin: 0, fontSize: 13, color: "#dc2626" }}>❌ {errMsg}</p>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#9ca3af" }}>
            请检查 `.env.local` 中的 `ZHIPU_API_KEY` 及 `/api/audit` 路由是否正常。
          </p>
        </div>
      ) : null}
    </div>
  );
}
