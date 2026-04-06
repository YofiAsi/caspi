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

export interface BarPeriodRow {
  periodKey: string
  label: string
  total: number
}

interface Props {
  rows: BarPeriodRow[]
  selectedPeriodKey: string | null
  onSelectPeriod: (key: string) => void
  barSlotWidth?: number
  barSize?: number
}

function formatBarAmount(v: number) {
  if (v >= 1000) return `${(v / 1000).toLocaleString('en-IL', { maximumFractionDigits: 1 })}K ₪`
  return `${v.toLocaleString('en-IL', { maximumFractionDigits: 0 })}₪`
}

export function SpendBarChart({ rows, selectedPeriodKey, onSelectPeriod, barSlotWidth = 52, barSize = 28 }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

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
          <div
            style={{
              width:
                rows.length === 0
                  ? 200
                  : Math.max(rows.length * barSlotWidth, 240),
              height: 220,
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows}
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
                  barSize={barSize}
                  radius={[5, 5, 0, 0]}
                  className="cursor-pointer outline-none"
                  activeBar={false}
                  isAnimationActive={false}
                  onClick={(row: BarPeriodRow) => onSelectPeriod(row.periodKey)}
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
                  {rows.map((row) => (
                    <Cell
                      key={row.periodKey}
                      fill={
                        row.periodKey === selectedPeriodKey
                          ? 'var(--color-accent, #6366f1)'
                          : 'color-mix(in srgb, var(--color-accent, #6366f1) 35%, transparent)'
                      }
                      stroke={row.periodKey === selectedPeriodKey ? 'var(--color-accent, #6366f1)' : 'transparent'}
                      strokeWidth={row.periodKey === selectedPeriodKey ? 2 : 0}
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
