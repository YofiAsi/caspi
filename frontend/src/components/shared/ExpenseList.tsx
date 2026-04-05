import type { ExpenseOut } from '../../api/types'
import ExpenseListItem from './ExpenseListItem'

interface Props {
  expenses: ExpenseOut[]
  selectedIds: Set<string>
  isMultiSelectMode: boolean
  onTap: (expense: ExpenseOut) => void
  onLongPress: (expense: ExpenseOut) => void
}

function groupByDate(expenses: ExpenseOut[]): [string, ExpenseOut[]][] {
  const map = new Map<string, ExpenseOut[]>()
  for (const e of expenses) {
    const group = map.get(e.date) ?? []
    group.push(e)
    map.set(e.date, group)
  }
  return Array.from(map.entries())
}

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function ExpenseList({ expenses, selectedIds, isMultiSelectMode, onTap, onLongPress }: Props) {
  const groups = groupByDate(expenses)

  return (
    <div>
      {groups.map(([date, items]) => (
        <div key={date}>
          <div className="sticky top-0 z-10 border-b border-zinc-100 bg-zinc-50 px-4 py-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {formatDateHeader(date)}
            </span>
          </div>
          <div className="divide-y divide-zinc-100">
            {items.map(e => (
              <ExpenseListItem
                key={e.id}
                expense={e}
                isSelected={selectedIds.has(e.id)}
                isMultiSelectMode={isMultiSelectMode}
                onTap={() => onTap(e)}
                onLongPress={() => onLongPress(e)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
