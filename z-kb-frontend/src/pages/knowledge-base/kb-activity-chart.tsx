import React, { useId, useMemo } from 'react';
import type { KbActivityDay } from '@/services/kbActivity';

export const ACTIVITY_WEEKS = 24;

const WIDTH = 96;
const HEIGHT = 26;
const PAD_X = 1;
const PAD_Y = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

function pad(value: number) {
  return value < 10 ? `0${value}` : String(value);
}

function toKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
}

export interface ActivityWeek {
  start: string;
  count: number;
}

export interface ActivitySeries {
  buckets: ActivityWeek[];
  total: number;
  max: number;
}

/**
 * 把按天的操作次数按周（周日起）汇总，窗口终点为今天所在周；
 * 窗口外的日期与未来日期都不计入。
 */
export function buildSeries(
  days: KbActivityDay[] | undefined,
  weeks: number,
): ActivitySeries {
  const counts = new Map<string, number>();
  for (const day of days || []) {
    const count = Number(day.count) || 0;
    if (day.date && count > 0) {
      counts.set(day.date, count);
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastSunday = new Date(today.getTime() - today.getDay() * DAY_MS);
  const firstSunday = new Date(
    lastSunday.getTime() - (weeks - 1) * 7 * DAY_MS,
  );

  const buckets: ActivityWeek[] = [];
  let total = 0;
  for (let week = 0; week < weeks; week += 1) {
    const start = new Date(firstSunday.getTime() + week * 7 * DAY_MS);
    let count = 0;
    for (let offset = 0; offset < 7; offset += 1) {
      const date = new Date(start.getTime() + offset * DAY_MS);
      if (date.getTime() > today.getTime()) {
        break;
      }
      count += counts.get(toKey(date)) || 0;
    }
    buckets.push({ start: toKey(start), count });
    total += count;
  }
  const max = buckets.reduce((acc, bucket) => Math.max(acc, bucket.count), 0);
  return { buckets, total, max };
}

interface Point {
  x: number;
  y: number;
}

function toPoints(series: ActivitySeries): Point[] {
  const step = (WIDTH - PAD_X * 2) / Math.max(series.buckets.length - 1, 1);
  const inner = HEIGHT - PAD_Y * 2;
  return series.buckets.map((bucket, index) => ({
    x: PAD_X + index * step,
    y:
      HEIGHT -
      PAD_Y -
      (series.max > 0 ? (bucket.count / series.max) * inner : 0),
  }));
}

function smoothPath(points: Point[]) {
  if (points.length === 0) {
    return '';
  }
  if (points.length === 1) {
    return `M${points[0].x},${points[0].y}`;
  }
  const clampY = (value: number) =>
    Math.min(HEIGHT - PAD_Y, Math.max(PAD_Y, value));
  let path = `M${points[0].x},${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const prev = points[index - 1] || points[index];
    const from = points[index];
    const to = points[index + 1];
    const next = points[index + 2] || to;
    const c1x = from.x + (to.x - prev.x) / 6;
    const c1y = clampY(from.y + (to.y - prev.y) / 6);
    const c2x = to.x - (next.x - from.x) / 6;
    const c2y = clampY(to.y - (next.y - from.y) / 6);
    path += ` C${c1x},${c1y} ${c2x},${c2y} ${to.x},${to.y}`;
  }
  return path;
}

function shortDay(key: string) {
  return key.slice(5);
}

interface KbActivityChartProps {
  days?: KbActivityDay[];
  pending?: boolean;
  /** 活跃度接口失败时不再用「0 次」冒充无操作 */
  unavailable?: boolean;
  weeks?: number;
}

export default function KbActivityChart({
  days,
  pending = false,
  unavailable = false,
  weeks = ACTIVITY_WEEKS,
}: KbActivityChartProps) {
  const series = useMemo(() => buildSeries(days, weeks), [days, weeks]);
  const gradientId = `kb-act-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const label = unavailable
    ? '活跃度数据暂不可用'
    : pending
      ? '正在加载活跃度'
      : `近 ${weeks} 周共 ${series.total} 次操作`;
  const meta = unavailable ? '—' : pending ? '…' : `${series.total} 次`;
  const points = toPoints(series);
  const line = smoothPath(points);
  const step = (WIDTH - PAD_X * 2) / Math.max(series.buckets.length - 1, 1);
  const empty = unavailable || series.max === 0;

  return (
    <span
      className={`kb-chart${empty ? ' is-empty' : ''}${pending ? ' pending' : ''}`}
      title={label}
    >
      <svg
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={label}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3bb273" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3bb273" stopOpacity="0" />
          </linearGradient>
        </defs>
        {empty ? null : (
          <path
            className="area"
            fill={`url(#${gradientId})`}
            d={`${line} L${points[points.length - 1].x},${HEIGHT} L${
              points[0].x
            },${HEIGHT} Z`}
          />
        )}
        <path className="line" d={line} />
        {empty ? null : (
          <circle
            className="dot"
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r={1.6}
          />
        )}
        {series.buckets.map((bucket, index) => (
          <rect
            key={bucket.start}
            className="hit"
            x={PAD_X + index * step - step / 2}
            y={0}
            width={step}
            height={HEIGHT}
          >
            <title>{`${shortDay(bucket.start)} 起 · ${
              bucket.count > 0 ? `${bucket.count} 次操作` : '无操作'
            }`}</title>
          </rect>
        ))}
      </svg>
      <span className="kb-chart-meta">{meta}</span>
    </span>
  );
}
