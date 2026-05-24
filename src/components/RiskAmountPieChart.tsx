"use client";

import { useMemo } from "react";
import {
  breakdownToSegments,
  computeAmountBreakdown,
  formatYuan,
  type AmountBreakdown,
  type AmountSegment,
} from "@/lib/risk-amount-breakdown";
import type { RiskRow } from "@/lib/site-data";

type Props = {
  declaredAmount: string;
  riskRows: RiskRow[];
  riskScore: number;
  markdown?: string;
  breakdown?: AmountBreakdown;
  className?: string;
};

const CX = 120;
const CY = 105;
const R = 78;
const DEPTH = 16;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  if (end - start >= 359.99) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`;
  }
  const s = polar(cx, cy, r, end);
  const e = polar(cx, cy, r, start);
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y} Z`;
}

function PieSlice3D({
  startAngle,
  endAngle,
  color,
  colorSide,
}: {
  startAngle: number;
  endAngle: number;
  color: string;
  colorSide: string;
}) {
  const sidePath = arcPath(CX, CY + DEPTH, R, startAngle, endAngle);
  const topPath = arcPath(CX, CY, R, startAngle, endAngle);

  return (
    <g>
      <path d={sidePath} fill={colorSide} stroke={colorSide} strokeWidth={0.4} />
      <path d={topPath} fill={color} stroke={color} strokeWidth={0.5} />
    </g>
  );
}

function buildSlices(segments: AmountSegment[]) {
  const total = segments.reduce((s, seg) => s + seg.amount, 0);
  let cursor = 0;
  return segments.map((seg, index) => {
    const isLast = index === segments.length - 1;
    const sweep = total > 0 ? (isLast ? 360 - cursor : (seg.amount / total) * 360) : 0;
    const slice = { segment: seg, start: cursor, end: cursor + sweep };
    cursor += sweep;
    return slice;
  });
}

function labelPosition(start: number, end: number, radius: number) {
  const mid = (start + end) / 2;
  const p = polar(CX, CY, radius, mid);
  return { x: p.x, y: p.y, mid };
}

export function RiskAmountPieChart({
  declaredAmount,
  riskRows,
  riskScore,
  markdown,
  breakdown: breakdownProp,
  className = "",
}: Props) {
  const breakdown = useMemo(
    () =>
      breakdownProp ??
      computeAmountBreakdown({
        declaredAmount,
        riskRows,
        riskScore,
        markdown,
      }),
    [breakdownProp, declaredAmount, riskRows, riskScore, markdown],
  );

  const segments = useMemo(() => breakdownToSegments(breakdown), [breakdown]);
  const slices = useMemo(() => buildSlices(segments), [segments]);

  if (segments.length === 0) {
    return (
      <div className={`report-print-block sysu-card px-7 py-8 ${className}`}>
        <p className="text-sm font-medium text-slate-700">金额风险占比</p>
        <p className="mt-4 text-sm text-slate-500">暂无可用金额分布数据</p>
      </div>
    );
  }

  return (
    <div className={`report-print-block sysu-card px-7 py-8 ${className}`}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">金额风险占比</p>
          <p className="mt-1 text-xs text-slate-500">
            立体饼图 · 申报总额 {formatYuan(breakdown.total)}
            {breakdown.expenseCount > 0
              ? ` · 去重后 ${breakdown.expenseCount} 笔支出${
                  breakdown.rawRowCount > breakdown.expenseCount
                    ? `（风险表 ${breakdown.rawRowCount} 行，同金额已合并）`
                    : ""
                }`
              : ""}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-8 lg:flex-row lg:items-center lg:justify-center lg:gap-12">
        <div
          className="flex w-full max-w-md justify-center"
          style={{ perspective: "640px" }}
        >
          <div
            className="relative"
            style={{ transform: "rotateX(48deg)", transformStyle: "preserve-3d" }}
          >
            <svg
              viewBox="0 0 240 200"
              className="h-[220px] w-full max-w-[280px] drop-shadow-lg"
              role="img"
              aria-label="金额风险占比饼图"
            >
              <ellipse cx={CX} cy={CY + DEPTH + 12} rx={R + 6} ry={18} fill="rgba(15,23,42,0.12)" />
              {slices.map(({ segment, start, end }) =>
                end - start < 0.2 ? null : (
                  <PieSlice3D
                    key={segment.tier}
                    startAngle={start}
                    endAngle={end}
                    color={segment.color}
                    colorSide={segment.colorSide}
                  />
                ),
              )}
              {slices.map(({ segment, start, end }) => {
                if (end - start < 18 || segment.percent < 6) return null;
                const { x, y } = labelPosition(start, end, R * 0.58);
                return (
                  <text
                    key={`${segment.tier}-pct`}
                    x={x}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#fff"
                    fontSize={11}
                    fontWeight={700}
                    style={{ textShadow: "0 1px 2px rgba(0,0,0,0.45)" }}
                  >
                    {segment.percent}%
                  </text>
                );
              })}
            </svg>
          </div>
        </div>

        <ul className="grid w-full max-w-md gap-3 sm:grid-cols-2 lg:max-w-lg lg:grid-cols-1">
          {segments.map((seg) => (
            <li
              key={seg.tier}
              className="flex items-center justify-between gap-4 rounded-md border border-slate-100 bg-slate-50/80 px-4 py-3"
            >
              <span className="flex items-center gap-2.5 text-sm text-slate-800">
                <span
                  className="inline-block h-4 w-4 shrink-0 rounded-sm shadow-sm"
                  style={{ backgroundColor: seg.color }}
                />
                {seg.label}
              </span>
              <span className="text-right text-sm font-semibold tabular-nums text-slate-900">
                {seg.percent}%
                <span className="ml-2 text-xs font-normal text-slate-500">{formatYuan(seg.amount)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
