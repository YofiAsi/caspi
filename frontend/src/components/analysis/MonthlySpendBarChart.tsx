import { useEffect, useRef } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { parseYearMonth } from '../../utils/monthBounds'

function formatMonthAxisCompact(ym: string) {
  const { year, month } = parseYearMonth(ym)
  const currentYear = new Date().getFullYear()
  const date = new Date(year, month - 1, 1)
  const monthLabel = new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(date)
  if (year !== currentYear) {
    return `${monthLabel} '${String(year).slice(-2)}`
  }
  return monthLabel
}

export interface BarMonthRow {
  ym: string
  year: number
  month: number
  total: number
}

interface Props {
  rows: BarMonthRow[]
  selectedYm: string | null
  onSelectMonth: (ym: string) => void
}

function formatBarAmount(v: number) {
  return v.toLocaleString('en-IL', { maximumFractionDigits: 0 })
}

export function MonthlySpendBarChart({ rows, selectedYm, onSelectMonth }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const data = rows.map((r) => ({
    ...r,
    label: formatMonthAxisCompact(r.ym),
  }))

  // Use 64px per bar so all labels always fit without skipping
  const barWidth = 64

  useEffect(() => {
    const el = scrollRef.current
    if (!el || rows.length === 0) return
    const scrollToEnd = () => {
      el.scrollLeft = el.scrollWidth - el.clientWidth
    }
    scrollToEnd()
    const id = requestAnimationFrame(() => requestAnimationFrame(scrollToEnd))
    return () => cancelAnimationFrame(id)
  }, [rows])

  return (
    <div className="w-full min-w-0">
      <div className="relative min-w-0">
        <span
          className="pointer-events-none absolute right-3 top-1 z-20 flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface/95 text-sm font-semibold text-fg-muted shadow-sm backdrop-blur-sm"
          aria-hidden
        >
          ₪
        </span>
        <div ref={scrollRef} className="overflow-x-auto pb-2 -mx-1 px-1">
          <div style={{ width: Math.max(480, rows.length * barWidth), height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 28, right: 8, left: 4, bottom: 4 }}
              >
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'var(--color-fg-muted, #888)' }}
                  interval={0}
                  height={32}
                />
                <YAxis hide domain={[0, 'auto']} />
                <Bar
                  dataKey="total"
                  radius={[5, 5, 0, 0]}
                  className="cursor-pointer outline-none"
                  activeBar={false}
                  isAnimationActive={false}
                  onClick={(row: (typeof data)[0]) => onSelectMonth(row.ym)}
                >
                  <LabelList
                    dataKey="total"
                    position="top"
                    offset={5}
                    formatter={(v: number) => formatBarAmount(v)}
                    style={{
                      fontSize: 10,
                      fill: 'var(--color-fg-muted, #888)',
                      fontWeight: 500,
                    }}
                  />
                  {data.map((row) => (
                    <Cell
                      key={row.ym}
                      fill={
                        row.ym === selectedYm
                          ? 'var(--color-accent, #6366f1)'
                          : 'color-mix(in srgb, var(--color-accent, #6366f1) 35%, transparent)'
                      }
                      stroke={row.ym === selectedYm ? 'var(--color-accent, #6366f1)' : 'transparent'}
                      strokeWidth={row.ym === selectedYm ? 2 : 0}
                      className="outline-none"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
