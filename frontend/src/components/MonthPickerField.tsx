import * as Popover from '@radix-ui/react-popover'
import { useState } from 'react'
import { formatYearMonthLabel, parseYearMonth } from '../utils/monthBounds'

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const MIN_YEAR = 2000

interface Props {
  value: string
  onChange: (yearMonth: string) => void
  id?: string
}

function todayMax(): { year: number; month: number } {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

export function MonthPickerField({ value, onChange, id }: Props) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(() => parseYearMonth(value).year)

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) setViewYear(parseYearMonth(value).year)
  }

  const { year: maxY, month: maxM } = todayMax()
  const canPrevYear = viewYear > MIN_YEAR
  const canNextYear = viewYear < maxY

  const selectMonth = (month: number) => {
    const ym = `${viewYear}-${String(month).padStart(2, '0')}`
    onChange(ym)
    setOpen(false)
  }

  const monthDisabled = (month: number) => viewYear > maxY || (viewYear === maxY && month > maxM)
  const { year: valueYear, month: valueMonth } = parseYearMonth(value)

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          id={id}
          className="w-full flex items-center justify-between gap-2 border border-border rounded-lg px-3 py-2 text-sm text-left text-fg bg-input-bg hover:bg-hover-surface focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <span>{formatYearMonthLabel(value)}</span>
          <span className="text-fg-subtle shrink-0" aria-hidden>
            ▾
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-[100] w-[280px] rounded-xl border border-border bg-surface p-3 shadow-lg outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          sideOffset={6}
          align="start"
          collisionPadding={16}
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <button
              type="button"
              disabled={!canPrevYear}
              onClick={() => setViewYear((y) => y - 1)}
              className="rounded-lg px-2 py-1 text-sm text-fg-muted hover:bg-hover-surface disabled:opacity-30 disabled:pointer-events-none"
              aria-label="Previous year"
            >
              ‹
            </button>
            <span className="text-sm font-semibold text-fg tabular-nums">{viewYear}</span>
            <button
              type="button"
              disabled={!canNextYear}
              onClick={() => setViewYear((y) => y + 1)}
              className="rounded-lg px-2 py-1 text-sm text-fg-muted hover:bg-hover-surface disabled:opacity-30 disabled:pointer-events-none"
              aria-label="Next year"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {MONTH_SHORT.map((label, i) => {
              const m = i + 1
              const disabled = monthDisabled(m)
              const selected = valueYear === viewYear && valueMonth === m
              return (
                <button
                  key={label}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectMonth(m)}
                  className={`rounded-lg py-2 text-xs font-medium transition-colors ${
                    selected
                      ? 'bg-accent text-on-primary'
                      : disabled
                        ? 'text-disabled-fg cursor-not-allowed'
                        : 'text-fg-secondary hover:bg-accent-soft hover:text-accent-soft-fg'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
