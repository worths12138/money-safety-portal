"use client";

import { useEffect, useState } from "react";
import { auditRules } from "@/lib/site-data";

type RulesForm = {
  allowedCategories: string;
  amountLimit: string;
  deadline: string;
  specialMaterials: string;
};

const initialForm: RulesForm = {
  allowedCategories: auditRules[0].value,
  amountLimit: auditRules[1].value,
  deadline: auditRules[2].value,
  specialMaterials: auditRules[3].value,
};

export default function RulesPage() {
  const [form, setForm] = useState<RulesForm>(initialForm);
  const [message, setMessage] = useState("等待保存");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/rules")
      .then((response) => response.json())
      .then((payload: { ok: boolean; rules?: { allowedCategories: string[]; amountLimit: string; deadline: string; specialMaterials: string[] } }) => {
        if (!payload.ok || !payload.rules) {
          return;
        }
        setForm({
          allowedCategories: payload.rules.allowedCategories.join(" / "),
          amountLimit: payload.rules.amountLimit,
          deadline: payload.rules.deadline,
          specialMaterials: payload.rules.specialMaterials.join(" / "),
        });
      })
      .catch(() => undefined);
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage("正在保存规则...");

    try {
      const response = await fetch("/api/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowedCategories: form.allowedCategories.split("/").map((item) => item.trim()).filter(Boolean),
          amountLimit: form.amountLimit,
          deadline: form.deadline,
          specialMaterials: form.specialMaterials.split("/").map((item) => item.trim()).filter(Boolean),
        }),
      });

      const payload = (await response.json()) as { ok: boolean; message?: string };
      setMessage(payload.ok ? payload.message ?? "规则已保存" : payload.message ?? "保存失败");
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
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">报销规则配置</h2>
        <p className="mt-2 text-sm text-slate-500">维护学院定制规则，比如可报销类别、金额上限、DDL 和特殊材料要求。保存接口已经预留。</p>

        <div className="mt-6 grid gap-4">
          <RuleInput label="可报销类别" value={form.allowedCategories} onChange={(value) => setForm((current) => ({ ...current, allowedCategories: value }))} placeholder="实验耗材 / 设备采购 / 差旅交通" />
          <RuleInput label="金额上限" value={form.amountLimit} onChange={(value) => setForm((current) => ({ ...current, amountLimit: value }))} placeholder="单笔 ¥10,000" />
          <RuleInput label="DDL" value={form.deadline} onChange={(value) => setForm((current) => ({ ...current, deadline: value }))} placeholder="2026-06-10 18:00" />
          <RuleInput label="特殊材料要求" value={form.specialMaterials} onChange={(value) => setForm((current) => ({ ...current, specialMaterials: value }))} placeholder="比价单 / 签章清单 / 会议纪要" />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={handleSave} disabled={saving} className="border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? "保存中..." : "保存规则"}
          </button>
          <p className="min-h-6 text-sm text-slate-500">{message}</p>
        </div>
      </section>

      <aside className="space-y-6">
        <div className="sysu-card p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">当前规则预览</p>
          <div className="mt-4 space-y-3">
            {auditRules.map((item) => (
              <div key={item.id} className="rounded-md border border-slate-200 bg-white px-4 py-3">
                <p className="text-sm font-medium text-slate-500">{item.title}</p>
                <p className="mt-1 font-semibold text-slate-950">{item.value}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="sysu-card p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Agent 接口</p>
          <p className="mt-4 text-sm leading-6 text-slate-500">后端接入后，可让 /api/agent/review 读取这些规则并返回自动审查结果。当前页面只是先把接口和参数位置留好。</p>
        </div>
      </aside>
    </div>
  );
}

function RuleInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}
