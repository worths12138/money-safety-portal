"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { adminQueue, operationLogs } from "@/lib/site-data";

type QueueStatus = "待审核" | "通过" | "驳回";

export default function AdminPage() {
  const [riskFilter, setRiskFilter] = useState<"全部" | "低" | "中" | "高">("全部");
  const [queue, setQueue] = useState(adminQueue);
  const [logs, setLogs] = useState(operationLogs);

  const filteredQueue = useMemo(() => {
    return queue.filter((item) => {
      if (riskFilter === "全部") return true;
      if (riskFilter === "低") return item.risk < 40;
      if (riskFilter === "中") return item.risk >= 40 && item.risk < 70;
      return item.risk >= 70;
    });
  }, [queue, riskFilter]);

  function updateStatus(id: string, status: QueueStatus) {
    setQueue((current) => current.map((item) => (item.id === id ? { ...item, status } : item)));
    setLogs((current) => [
      {
        id: `log-${Date.now()}`,
        actor: "当前用户",
        action: status === "通过" ? "一键通过" : "一键驳回",
        target: id,
        time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      },
      ...current,
    ]);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <section className="sysu-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-700">/admin</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">合规风控运营台</h2>
            <p className="mt-2 text-sm text-slate-500">按风险分级筛选申报，批量复核，一键通过或驳回，并记录处置日志。</p>
          </div>
          <Link href="/admin/rules" className="border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50">
            打开规则配置
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {(["全部", "低", "中", "高"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setRiskFilter(item)}
              className={`rounded-md border px-4 py-2 text-sm font-medium transition ${riskFilter === item ? "border-slate-300 bg-white text-slate-900" : "border-slate-200 bg-white text-slate-600 hover:text-slate-900"}`}
            >
              {item} 风险
            </button>
          ))}
        </div>

        <div className="sysu-card mt-6 overflow-hidden">
          <div className="grid grid-cols-[1.4fr_0.7fr_0.7fr_0.8fr_1fr] gap-4 border-b border-slate-200 px-5 py-4 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            <span>项目</span>
            <span>风险</span>
            <span>状态</span>
            <span>提交时间</span>
            <span>操作</span>
          </div>
          <div className="divide-y divide-slate-100 bg-white">
            {filteredQueue.map((item) => (
              <div key={item.id} className="grid grid-cols-[1.4fr_0.7fr_0.7fr_0.8fr_1fr] gap-4 px-5 py-4 text-sm">
                <div>
                  <p className="font-semibold text-slate-950">{item.projectName}</p>
                  <p className="mt-1 text-slate-500">{item.owner}</p>
                  <p className="mt-1 text-slate-400">{item.category}</p>
                </div>
                <div className="flex items-start">
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    {item.risk}
                  </span>
                </div>
                <div className="font-medium text-slate-700">{item.status}</div>
                <div className="text-slate-500">{item.submittedAt}</div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => updateStatus(item.id, "通过")} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-slate-50">通过</button>
                  <button onClick={() => updateStatus(item.id, "驳回")} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-slate-50">驳回</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <aside className="space-y-6">
        <div className="sysu-card p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">批处理面板</p>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-500">
            <p>高风险内容会优先出现，帮助老师和财务人员快速定位。</p>
            <p>当前版本使用本地状态模拟一键审批，后端接入后可直接改成真实提交。</p>
            <p>操作日志会保留最近动作，便于追踪谁在什么时间做了处理。</p>
          </div>
        </div>

        <div className="sysu-card p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">操作日志</p>
          <div className="mt-4 space-y-3">
            {logs.map((item) => (
              <div key={item.id} className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                <div className="flex items-center justify-between gap-2">
                  <strong>{item.actor}</strong>
                  <span className="text-slate-400">{item.time}</span>
                </div>
                <p className="mt-1">{item.action} · {item.target}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
