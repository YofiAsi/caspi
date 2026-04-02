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
  if (v >= 1000) return `₪${(v / 1000).toLocaleString('en-IL', { maximumFractionDigits: 1 })}K`
  return `₪${v.toLocaleString('en-IL', { maximumFractionDigits: 0 })}`
}

export function MonthlySpendBarChart({ rows, selectedYm, onSelectMonth }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const data = rows.map((r) => ({
    ...r,
    label: formatMonthAxisCompact(r.ym),
  }))

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
        <div ref={scrollRef} className="overflow-x-auto pb-2 -mx-1 px-1">
          <div style={{ width: Math.max(480, rows.length * barWidth), height: 220 }}>
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
                    content={(props) => {
                      const { x, y, width, value } = props as { x: number; y: number; width: number; value: number }
                      return (
                        <text
                          key={`${x}-${y}`}
                          x={x + width / 2}
                          y={y - 5}
                          textAnchor="middle"
                          fontSize={10}
                          fontWeight={400}
                          fill="var(--color-fg-muted, #888)"
                        >
                          {formatBarAmount(value)}
                        </text>
                      )
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
