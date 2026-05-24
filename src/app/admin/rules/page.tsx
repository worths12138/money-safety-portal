"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type RulesForm = {
  allowedCategories: string;
  amountLimit: string;
  deadline: string;
  specialMaterials: string;
};

type RulesApiPayload = {
  ok: boolean;
  message?: string;
  rules?: {
    allowedCategories: string[];
    amountLimit: string;
    deadline: string;
    specialMaterials: string[];
    updatedAt?: string;
    storage?: "database" | "memory";
  };
};

const emptyForm: RulesForm = {
  allowedCategories: "",
  amountLimit: "",
  deadline: "",
  specialMaterials: "",
};

function configToForm(rules: NonNullable<RulesApiPayload["rules"]>): RulesForm {
  return {
    allowedCategories: rules.allowedCategories.join(" / "),
    amountLimit: rules.amountLimit,
    deadline: rules.deadline,
    specialMaterials: rules.specialMaterials.join(" / "),
  };
}

export default function RulesPage() {
  const [form, setForm] = useState<RulesForm>(emptyForm);
  const [message, setMessage] = useState("正在加载规则…");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [storage, setStorage] = useState<"database" | "memory" | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const loadRules = useCallback(() => {
    setLoading(true);
    return fetch("/api/rules")
      .then((response) => response.json())
      .then((payload: RulesApiPayload) => {
        if (!payload.ok || !payload.rules) {
          setMessage(payload.message ?? "规则加载失败");
          return;
        }
        setForm(configToForm(payload.rules));
        setStorage(payload.rules.storage ?? null);
        setUpdatedAt(payload.rules.updatedAt ?? null);
        setMessage(
          payload.rules.storage === "memory"
            ? "规则已加载（未配置 Supabase，保存仅本次运行有效）。"
            : "规则已加载，保存后将作用于 Agent 与材料审核。",
        );
      })
      .catch(() => setMessage("规则加载失败，请刷新页面。"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  const previewItems = useMemo(
    () => [
      {
        title: "允许支出类别",
        value: form.allowedCategories || "—",
        detail: "不在白名单的支出须在审核报告中标注合规风险。",
      },
      {
        title: "金额上限",
        value: form.amountLimit || "—",
        detail: "超过上限的申报应提高风险等级并建议人工复核。",
      },
      {
        title: "申报截止",
        value: form.deadline || "—",
        detail: "临近或超过 DDL 的提交需在报告中说明时效风险。",
      },
      {
        title: "特殊凭证要求",
        value: form.specialMaterials || "—",
        detail: "缺少所列材料的支出项应标注材料缺失或需补证。",
      },
    ],
    [form],
  );

  async function handleSave() {
    setSaving(true);
    setMessage("正在保存规则…");

    try {
      const response = await fetch("/api/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowedCategories: form.allowedCategories
            .split("/")
            .map((item) => item.trim())
            .filter(Boolean),
          amountLimit: form.amountLimit,
          deadline: form.deadline,
          specialMaterials: form.specialMaterials
            .split("/")
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });

      const payload = (await response.json()) as RulesApiPayload;
      if (!payload.ok) {
        setMessage(payload.message ?? "保存失败");
        return;
      }

      if (payload.rules) {
        setForm(configToForm(payload.rules));
        setStorage(payload.rules.storage ?? null);
        setUpdatedAt(payload.rules.updatedAt ?? null);
      }
      setMessage(payload.message ?? "规则已保存");
    } catch {
      setMessage("保存失败，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="sysu-card p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-700">/admin/rules</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">合规规则配置</h2>
        <p className="mt-2 text-sm text-slate-500">
          维护学院合规策略：支出白名单、单笔限额、截止日与特殊凭证要求。保存后写入数据库（已配置 Supabase 时），并自动注入
          GLM-5V-Turbo 的申报风控与「AI 材料审核」。
        </p>

        <div className="mt-6 grid gap-4">
          <RuleInput
            label="允许支出类别"
            value={form.allowedCategories}
            onChange={(value) => setForm((current) => ({ ...current, allowedCategories: value }))}
            placeholder="实验耗材 / 设备采购 / 差旅交通"
            disabled={loading}
          />
          <RuleInput
            label="金额上限"
            value={form.amountLimit}
            onChange={(value) => setForm((current) => ({ ...current, amountLimit: value }))}
            placeholder="单笔 ¥10,000"
            disabled={loading}
          />
          <RuleInput
            label="DDL"
            value={form.deadline}
            onChange={(value) => setForm((current) => ({ ...current, deadline: value }))}
            placeholder="2026-06-10 18:00"
            disabled={loading}
          />
          <RuleInput
            label="特殊凭证要求"
            value={form.specialMaterials}
            onChange={(value) => setForm((current) => ({ ...current, specialMaterials: value }))}
            placeholder="比价单 / 签章清单 / 会议纪要"
            disabled={loading}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "保存中..." : "保存规则"}
          </button>
          <button
            type="button"
            onClick={() => void loadRules()}
            disabled={loading || saving}
            className="border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            重新加载
          </button>
          <p className="min-h-6 text-sm text-slate-500">{message}</p>
        </div>
      </section>

      <aside className="space-y-6">
        <div className="sysu-card p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">当前规则预览</p>
          <p className="mt-2 text-xs text-slate-400">
            {storage === "database" && updatedAt
              ? `已持久化 · 最近更新 ${new Date(updatedAt).toLocaleString("zh-CN")}`
              : storage === "memory"
                ? "仅内存模式（未配置 Supabase）"
                : "—"}
          </p>
          <div className="mt-4 space-y-3">
            {previewItems.map((item) => (
              <div key={item.title} className="rounded-md border border-slate-200 bg-white px-4 py-3">
                <p className="text-sm font-medium text-slate-500">{item.title}</p>
                <p className="mt-1 font-semibold text-slate-950">{item.value}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="sysu-card p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">生效范围</p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-600">
            <li>AI 风控预审（/preaudit）提交时的多模态 Agent 风控</li>
            <li>大创固定报销细则（发票抬头、禁止类目等）始终保留，与本页配置合并后传给模型</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

function RuleInput({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400 disabled:bg-slate-50"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    </label>
  );
}
