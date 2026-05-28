"use client";

import { useCallback, useEffect, useState } from "react";
import type { MaterialCacheInfo } from "@/lib/report-material-status";

type MaterialItem = {
  index: number;
  name: string;
  type: string;
  isPdf: boolean;
  isImage: boolean;
  previewUrl: string;
};

type Props = {
  reportId: string;
  initialCache?: MaterialCacheInfo;
};

function formatTtl(sec: number) {
  if (sec <= 0) return "已过期";
  if (sec < 60) return `${sec} 秒`;
  if (sec < 3600) return `${Math.ceil(sec / 60)} 分钟`;
  return `${(sec / 3600).toFixed(1)} 小时`;
}

export function ReportMaterialsPanel({ reportId, initialCache }: Props) {
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [cache, setCache] = useState<MaterialCacheInfo | null>(initialCache ?? null);
  const [message, setMessage] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/${reportId}/materials`);
      const data = (await res.json()) as {
        ok: boolean;
        available?: boolean;
        materials?: MaterialItem[];
        materialCache?: MaterialCacheInfo;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? "无法加载凭证");
      }
      setMaterials(data.materials ?? []);
      if (data.materialCache) setCache(data.materialCache);
      setMessage(data.message ?? "");
      if ((data.materials?.length ?? 0) > 0) {
        setActiveIndex(0);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "加载失败");
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!cache?.available) return;
    const timer = window.setInterval(() => {
      setCache((prev) => {
        if (!prev?.available) return prev;
        const next = prev.ttlSecondsLeft - 1;
        if (next <= 0) {
          return { ...prev, available: false, ttlSecondsLeft: 0 };
        }
        return { ...prev, ttlSecondsLeft: next };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cache?.available]);

  const active = materials[activeIndex];

  if (loading) {
    return (
      <div className="sysu-card mt-6 px-6 py-5 text-sm text-slate-500">正在加载申报凭证…</div>
    );
  }

  return (
    <div className="sysu-card mt-6 px-6 py-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-slate-950">申报凭证预览</h3>
        {cache?.available ? (
          <p className="text-xs text-slate-500">
            暂存剩余 {formatTtl(cache.ttlSecondsLeft)}（查看时自动顺延）
          </p>
        ) : (
          <p className="text-xs text-amber-700">暂存已过期或未上传</p>
        )}
      </div>

      {materials.length === 0 ? (
        <p className="mt-4 text-sm leading-7 text-slate-600">
          {message ||
            "当前无法预览原始凭证。常见原因：提交后超过暂存时间、服务器重启（PM2），或提交时未带附件。请让学生重新提交，或在过期前完成 AI 初审。"}
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {materials.map((m) => (
              <button
                key={m.index}
                type="button"
                onClick={() => setActiveIndex(m.index)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  activeIndex === m.index
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>

          {active && (
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              {active.isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={active.previewUrl}
                  alt={active.name}
                  className="max-h-[min(70vh,520px)] w-full object-contain"
                />
              ) : active.isPdf ? (
                <iframe
                  title={active.name}
                  src={active.previewUrl}
                  className="h-[min(70vh,520px)] w-full bg-white"
                />
              ) : (
                <div className="px-4 py-8 text-center text-sm text-slate-600">
                  <a
                    href={active.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-slate-900 underline"
                  >
                    下载 / 打开 {active.name}
                  </a>
                </div>
              )}
            </div>
          )}

          <p className="mt-3 text-xs text-slate-500">
            教师与学生（本人申报）均可查看。凭证仅存于服务器内存，不落库；如需长期保留请后续接入对象存储。
          </p>
        </>
      )}
    </div>
  );
}
