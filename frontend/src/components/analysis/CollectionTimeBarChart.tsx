import { useEffect, useMemo, useRef } from 'react'
import type { TimeGranularity } from '../../utils/collectionPeriodFilter'

export interface SparseTimeseriesRow {
  period_start: string
  sum_effective: number
  payment_count: number
}

type Segment =
  | { kind: 'bar'; key: string; periodStart: string; total: number; axisLabel: string }
  | { kind: 'gap'; key: string; label: string }

function parseYMD(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return { y, m, d }
}

function addCalendarMonths(y: number, m: number, delta: number) {
  const idx = y * 12 + (m - 1) + delta
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 }
}

function gapLabelMonthly(prevStart: string, nextStart: string): string | null {
  const a = parseYMD(prevStart)
  const b = parseYMD(nextStart)
  const exp = addCalendarMonths(a.y, a.m, 1)
  const expKey = exp.y * 12 + exp.m
  const nextKey = b.y * 12 + b.m
  const sk = nextKey - expKey - 1
  if (sk < 1) return null
  return sk === 1 ? '1 month' : `${sk} months`
}

function gapLabelDaily(prevStart: string, nextStart: string): string | null {
  const t0 = new Date(prevStart + 'T12:00:00').getTime()
  const t1 = new Date(nextStart + 'T12:00:00').getTime()
  const days = Math.round((t1 - t0) / 86400000) - 1
  if (days < 1) return null
  if (days >= 14) {
    const w = Math.round(days / 7)
    return w === 1 ? '1 week' : `${w} weeks`
  }
  return days === 1 ? '1 day' : `${days} days`
}

function gapLabelWeekly(prevStart: string, nextStart: string): string | null {
  const t0 = new Date(prevStart + 'T12:00:00').getTime()
  const t1 = new Date(nextStart + 'T12:00:00').getTime()
  const w = Math.round((t1 - t0) / (7 * 86400000)) - 1
  if (w < 1) return null
  return w === 1 ? '1 week' : `${w} weeks`
}

function formatAxisLabel(periodStart: string, g: TimeGranularity): string {
  const { y, m, d } = parseYMD(periodStart)
  const cur = new Date()
  if (g === 'daily') {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(
      new Date(y, m - 1, d),
    )
  }
  if (g === 'monthly') {
    const short = new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(new Date(y, m - 1, 1))
    if (y !== cur.getFullYear()) return `${short} '${String(y).slice(-2)}`
    return short
  }
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(
    new Date(y, m - 1, d),
  )
}

function buildSegments(rows: SparseTimeseriesRow[], g: TimeGranularity): Segment[] {
  const sorted = [...rows].sort((a, b) => a.period_start.localeCompare(b.period_start))
  const out: Segment[] = []
  const gapFn =
    g === 'monthly' ? gapLabelMonthly : g === 'daily' ? gapLabelDaily : gapLabelWeekly
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i]
    out.push({
      kind: 'bar',
      key: `bar-${r.period_start}`,
      periodStart: r.period_start,
      total: r.sum_effective,
      axisLabel: formatAxisLabel(r.period_start, g),
    })
    if (i < sorted.length - 1) {
      const gl = gapFn(r.period_start, sorted[i + 1].period_start)
      if (gl)
        out.push({
          kind: 'gap',
          key: `gap-${r.period_start}-${sorted[i + 1].period_start}`,
          label: gl,
        })
    }
  }
  return out
}

interface Props {
  rows: SparseTimeseriesRow[]
  granularity: TimeGranularity
  onGranularityChange: (g: TimeGranularity) => void
  selectedPeriodStart: string | null
  onSelectBar: (periodStart: string | null) => void
}

export function CollectionTimeBarChart({
  rows,
  granularity,
  onGranularityChange,
  selectedPeriodStart,
  onSelectBar,
}: Props) {
  const segments = useMemo(() => buildSegments(rows, granularity), [rows, granularity])
  const maxTotal = useMemo(() => {
    const bars = segments.filter((s): s is Extract<Segment, { kind: 'bar' }> => s.kind === 'bar')
    return Math.max(1, ...bars.map((b) => b.total))
  }, [segments])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el || rows.length === 0) return
    const run = () => {
      el.scrollLeft = el.scrollWidth - el.clientWidth
    }
    run()
    const id = requestAnimationFrame(() => requestAnimationFrame(run))
    return () => cancelAnimationFrame(id)
  }, [rows, granularity])

  const barWidth = 56
  const gapWidth = 14

  return (
    <div className="w-full min-w-0 space-y-2">
      <div className="flex gap-1">
        {(['monthly', 'weekly', 'daily'] as const).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => onGranularityChange(g)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize ${
              granularity === g ? 'bg-accent-soft text-accent-soft-fg' : 'text-fg-muted hover:bg-hover-surface'
            }`}
          >
            {g}
          </button>
        ))}
      </div>
      {segments.length === 0 ? (
        <p className="text-sm text-fg-subtle text-center py-6">No time-series data yet.</p>
      ) : (
        <div ref={scrollRef} className="overflow-x-auto pb-2 -mx-1 px-1">
          <div
            className="flex items-end gap-0 h-[200px] min-h-[200px] pt-8"
            style={{
              width: Math.max(
                320,
                segments.reduce((w, s) => w + (s.kind === 'bar' ? barWidth : gapWidth), 0),
              ),
            }}
          >
            {segments.map((s) =>
              s.kind === 'gap' ? (
                <div
                  key={s.key}
                  className="shrink-0 flex flex-col justify-start items-center relative h-full pt-0"
                  style={{ width: gapWidth }}
                >
                  <span className="text-[10px] leading-tight text-fg-muted text-center px-0.5 pt-1 max-w-[56px]">
                    {s.label}
                  </span>
                </div>
              ) : (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => {
                    if (selectedPeriodStart === s.periodStart) onSelectBar(null)
                    else onSelectBar(s.periodStart)
                  }}
                  className={`shrink-0 flex flex-col justify-end items-stretch rounded-t-md transition-colors ${
                    selectedPeriodStart === s.periodStart
                      ? 'ring-2 ring-fg ring-offset-2 ring-offset-surface'
                      : ''
                  }`}
                  style={{ width: barWidth }}
                >
                  <div
                    className="mx-1 rounded-t-md bg-accent/90 hover:bg-accent min-h-[4px] transition-colors"
                    style={{ height: `${Math.max(8, (s.total / maxTotal) * 120)}px` }}
                  />
                  <span className="text-[10px] text-fg-muted text-center mt-1 truncate px-0.5">
                    {s.axisLabel}
                  </span>
                  <span className="text-[10px] font-medium text-fg-secondary text-center truncate">
                    {s.total >= 1000
                      ? `₪${(s.total / 1000).toLocaleString('en-IL', { maximumFractionDigits: 1 })}K`
                      : `₪${s.total.toLocaleString('en-IL', { maximumFractionDigits: 0 })}`}
                  </span>
                </button>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  )
}
