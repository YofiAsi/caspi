import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { MonthTagSliceRow } from '../../types'

export type SliceSelection =
  | null
  | { kind: 'exact'; otherTagIds: string[] }
  | { kind: 'other' }

function rowToSelection(row: MonthTagSliceRow): SliceSelection {
  if (row.is_other) return { kind: 'other' }
  return { kind: 'exact', otherTagIds: [...row.other_tag_ids].sort() }
}

function selectionKey(s: SliceSelection): string | null {
  if (!s) return null
  if (s.kind === 'other') return '__other__'
  return s.otherTagIds.join(',')
}

const COLORS = [
  'var(--color-accent, #6366f1)',
  '#22c55e',
  '#f97316',
  '#eab308',
  '#ec4899',
  '#06b6d4',
  'var(--color-fg-muted, #888)',
]

interface Props {
  slices: MonthTagSliceRow[]
  selection: SliceSelection
  onSelect: (next: SliceSelection) => void
}

export function TagCombinationPieChart({ slices, selection, onSelect }: Props) {
  const cur = selectionKey(selection)
  const data = slices.map((s, i) => ({
    name: s.label,
    value: Number(s.sum_effective),
    row: s,
    color: COLORS[i % COLORS.length],
  }))

  return (
    <div className="flex items-center gap-3 w-full min-w-0">
      <div className="h-[180px] w-[180px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={46}
              outerRadius={78}
              paddingAngle={2}
              onClick={(entry) => {
                const row = (entry as { row?: MonthTagSliceRow }).row
                if (!row) return
                const next = rowToSelection(row)
                const nk = selectionKey(next)
                if (nk === cur) onSelect(null)
                else onSelect(next)
              }}
            >
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={d.color}
                  stroke={
                    selectionKey(rowToSelection(d.row)) === cur
                      ? 'var(--color-fg, #111)'
                      : 'transparent'
                  }
                  strokeWidth={selectionKey(rowToSelection(d.row)) === cur ? 2 : 0}
                  className="cursor-pointer outline-none"
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number, _n: string, item: { payload?: { name: string } }) => [
                `₪${v.toLocaleString('en-IL', { maximumFractionDigits: 0 })}`,
                item.payload?.name ?? '',
              ]}
              contentStyle={{
                background: 'var(--color-surface, #fff)',
                border: '1px solid var(--color-border, #ccc)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex-1 min-w-0 space-y-0.5 text-xs text-fg-secondary">
        {slices.map((s, i) => {
          const pct = (Number(s.fraction) * 100).toFixed(1)
          const sel = selectionKey(rowToSelection(s)) === cur
          const color = COLORS[i % COLORS.length]
          return (
            <li
              key={`${s.label}-${s.other_tag_ids.join('-')}`}
              className={`flex items-center gap-2 cursor-pointer rounded-lg px-2 py-2 transition-colors hover:bg-hover-surface ${
                sel ? 'font-semibold text-fg bg-accent-soft/40 border-l-2 border-accent' : ''
              }`}
              onClick={() => {
                const next = rowToSelection(s)
                const nk = selectionKey(next)
                if (nk === cur) onSelect(null)
                else onSelect(next)
              }}
            >
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
              <span className="flex-1 truncate">{s.label}</span>
              <span className="text-fg-muted font-normal shrink-0">{pct}%</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
