import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatYearMonthLabel } from '../../utils/monthBounds'

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

export function MonthlySpendBarChart({ rows, selectedYm, onSelectMonth }: Props) {
  const data = rows.map((r) => ({
    ...r,
    label: formatYearMonthLabel(r.ym, 'en-GB'),
  }))

  return (
    <div className="w-full min-w-0">
      <p className="text-xs font-medium text-fg-muted mb-2">Spend by month (ILS)</p>
      <div className="overflow-x-auto pb-2 -mx-1 px-1">
        <div style={{ width: Math.max(480, rows.length * 56), height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border-subtle" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'var(--color-fg-muted, #888)' }}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={70}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--color-fg-muted, #888)' }}
                width={44}
              />
              <Tooltip
                formatter={(v: number) => [`${v.toFixed(2)} ILS`, 'Total']}
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.label ?? ''
                }
                contentStyle={{
                  background: 'var(--color-surface, #fff)',
                  border: '1px solid var(--color-border, #ccc)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="total"
                radius={[4, 4, 0, 0]}
                className="cursor-pointer"
                onClick={(row: (typeof data)[0]) => onSelectMonth(row.ym)}
              >
                {data.map((row) => (
                  <Cell
                    key={row.ym}
                    fill={
                      row.ym === selectedYm
                        ? 'var(--color-accent, #6366f1)'
                        : 'color-mix(in srgb, var(--color-accent, #6366f1) 45%, transparent)'
                    }
                    className="outline-none"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
