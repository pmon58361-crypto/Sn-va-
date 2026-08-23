"use client";

import { useMemo, useState } from "react";
import type { AnalyticsDaily, EventTotals } from "@/lib/queries";

type TabId = "overview" | "reach" | "engagement" | "audience";

const TABS: {
  id: TabId;
  label: string;
  title: string;
  fields: (keyof EventTotals)[];
}[] = [
  {
    id: "overview",
    label: "Overview",
    title: "Interactions with your posts",
    fields: ["likes", "comments", "applications"],
  },
  { id: "reach", label: "Reach", title: "Saves", fields: ["bookmarks"] },
  {
    id: "engagement",
    label: "Engagement",
    title: "Comments and applications",
    fields: ["comments", "applications"],
  },
  { id: "audience", label: "Audience", title: "New followers", fields: ["followers"] },
];

function seriesValue(d: AnalyticsDaily, fields: (keyof EventTotals)[]) {
  return fields.reduce((sum, f) => sum + d[f], 0);
}

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0)
    return <span className="text-[13px] text-ink-faint">no activity yet</span>;
  if (previous === 0)
    return <span className="text-[13px] font-medium text-accent">new</span>;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0)
    return <span className="text-[13px] text-ink-faint">same as before</span>;
  return (
    <span className={`text-[13px] font-medium ${pct > 0 ? "text-accent" : "text-warm"}`}>
      {pct > 0 ? "+" : ""}
      {pct}%
    </span>
  );
}

function AreaChart({
  points,
}: {
  points: { label: string; value: number }[];
}) {
  const W = 1000;
  const H = 260;
  const PAD_L = 10;
  const PAD_R = 10;
  const PAD_T = 14;
  const PAD_B = 26;

  const max = Math.max(...points.map((p) => p.value), 1);
  const niceMax = Math.pow(10, Math.ceil(Math.log10(max)));
  const yMax = max / niceMax > 0.5 ? niceMax : niceMax / 2;

  const x = (i: number) =>
    PAD_L + (i / Math.max(1, points.length - 1)) * (W - PAD_L - PAD_R);
  const y = (v: number) => PAD_T + (1 - v / yMax) * (H - PAD_T - PAD_B);

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(" ");
  const areaPath =
    points.length > 1
      ? `${linePath} L${x(points.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`
      : "";

  const tickEvery = Math.max(1, Math.ceil(points.length / 6));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Activity chart">
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {[0, yMax].map((v) => (
        <g key={v}>
          <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth="1" />
          <text x={PAD_L + 2} y={y(v) - 5} fontSize="13" fill="rgb(var(--ink-faint-rgb))">
            {v}
          </text>
        </g>
      ))}

      {points.map((p, i) =>
        i % tickEvery === 0 || i === points.length - 1 ? (
          <text
            key={p.label + i}
            x={x(i)}
            y={H - 6}
            fontSize="13"
            fill="rgb(var(--ink-faint-rgb))"
            textAnchor={i === 0 ? "start" : i >= points.length - tickEvery ? "end" : "middle"}
          >
            {fmtDate(p.label)}
          </text>
        ) : null
      )}

      {areaPath && <path d={areaPath} fill="url(#areaFill)" />}
      <path
        d={linePath}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CreatorAnalytics({
  daily,
  totals,
  prevTotals,
  last48h,
}: {
  daily: AnalyticsDaily[];
  totals: EventTotals;
  prevTotals: EventTotals;
  last48h: EventTotals;
}) {
  const [tab, setTab] = useState<TabId>("overview");
  const active = TABS.find((t) => t.id === tab)!;

  const points = useMemo(
    () => daily.map((d) => ({ label: d.date, value: seriesValue(d, active.fields) })),
    [daily, active]
  );

  const total = active.fields.reduce((s, f) => s + totals[f], 0);
  const prevTotal = active.fields.reduce((s, f) => s + prevTotals[f], 0);

  const realtimeRows: { label: string; value: number }[] = [
    { label: "Likes", value: last48h.likes },
    { label: "Comments", value: last48h.comments },
    { label: "Applications", value: last48h.applications },
    { label: "Saves", value: last48h.bookmarks },
    { label: "New followers", value: last48h.followers },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
      <section>
        {/* Metric tabs */}
        <div role="tablist" aria-label="Metrics" className="flex gap-5 border-b border-line">
          {TABS.map((t) => {
            const isActive = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setTab(t.id)}
                className={`-mb-px border-b-2 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "border-accent font-semibold text-ink"
                    : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <h2 className="mt-5 text-sm text-ink-muted">{active.title}</h2>
        <div className="mt-1 flex items-baseline gap-2.5">
          <span className="text-3xl font-bold tabular-nums tracking-tight text-ink">
            {total.toLocaleString()}
          </span>
          <Delta current={total} previous={prevTotal} />
        </div>

        <div className="mt-3">
          {total === 0 ? (
            <div className="grid place-items-center border-b border-line py-16 text-center">
              <p className="text-sm text-ink-muted">Nothing happened in this period.</p>
              <p className="mt-1 text-[13px] text-ink-faint">
                Likes, comments and saves show up here once they happen.
              </p>
            </div>
          ) : (
            <AreaChart points={points} />
          )}
        </div>
      </section>

      <aside className="lg:border-l lg:border-line lg:pl-6">
        <h3 className="text-sm font-semibold text-ink">Last 48 hours</h3>
        <dl className="mt-3">
          {realtimeRows.map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between border-b border-line py-2 last:border-b-0"
            >
              <dt className="text-[13px] text-ink-muted">{r.label}</dt>
              <dd className="text-[13px] font-semibold tabular-nums text-ink">{r.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-ink-faint">
          Recounted from the database each time you open this page.
        </p>
      </aside>
    </div>
  );
}
