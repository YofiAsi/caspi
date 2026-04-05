import { useRef } from 'react'
import type { ExpenseOut, TagOut } from '../../api/types'
import AmountDisplay from './AmountDisplay'
import TagChip from './TagChip'
import CollectionBadge from './CollectionBadge'

interface Props {
  expense: ExpenseOut
  isSelected: boolean
  isMultiSelectMode: boolean
  onTap: () => void
  onLongPress: () => void
}

function mergeTags(expenseTags: TagOut[], merchantTags: TagOut[]): TagOut[] {
  const seen = new Set<string>()
  const result: TagOut[] = []
  for (const t of [...expenseTags, ...merchantTags]) {
    if (!seen.has(t.id)) {
      seen.add(t.id)
      result.push(t)
    }
  }
  return result
}

export default function ExpenseListItem({ expense, isSelected, isMultiSelectMode, onTap, onLongPress }: Props) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)

  const tags = mergeTags(expense.tags, expense.merchant_tags)
  const isRefund = expense.full_amount < 0
  const displayName = expense.merchant.alias ?? expense.merchant.canonical_name

  function handlePointerDown() {
    didLongPress.current = false
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true
      onLongPress()
    }, 500)
  }

  function handlePointerUp() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  function handleClick() {
    if (!didLongPress.current) onTap()
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onTap() }}
      className={`flex min-h-[60px] items-center gap-3 px-4 py-3 active:bg-zinc-50 ${
        isSelected ? 'bg-violet-50' : 'bg-white'
      }`}
    >
      {/* Checkbox / select indicator */}
      {isMultiSelectMode && (
        <div
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            isSelected ? 'border-violet-600 bg-violet-600' : 'border-zinc-300 bg-white'
          }`}
        >
          {isSelected && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 6l3 3 5-5" />
            </svg>
          )}
        </div>
      )}

      {/* Left: merchant + tags */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-zinc-900">{displayName}</span>
          {isRefund && (
            <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
              Refund
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {tags.length > 0 ? (
            tags.map(t => <TagChip key={t.id} name={t.name} />)
          ) : (
            <TagChip name="Untagged" variant="muted" />
          )}
          {expense.collection && <CollectionBadge name={expense.collection.name} />}
        </div>
      </div>

      {/* Right: amount */}
      <AmountDisplay
        personal={expense.personal_amount}
        full={expense.full_amount}
        currency={expense.currency}
      />
    </div>
  )
}
