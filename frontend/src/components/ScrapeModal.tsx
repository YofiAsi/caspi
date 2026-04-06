import { useState } from 'react'
import { MonthPickerField } from './MonthPickerField'
import {
  countMonthsFromYearMonthToNow,
  currentYearMonth,
  monthBounds,
  parseYearMonth,
  yearMonthMonthsAgo,
} from '../utils/monthBounds'
import type { ScrapeParams } from '../hooks/useScrapeSync'

interface Props {
  onClose: () => void
  onStart: (params: ScrapeParams) => void
}

type Mode = 'quick' | 'month' | 'range'

export function ScrapeModal({ onClose, onStart }: Props) {
  const [mode, setMode] = useState<Mode>('quick')
  const [syncMonth, setSyncMonth] = useState(currentYearMonth)
  const [rangeFromMonth, setRangeFromMonth] = useState(() => yearMonthMonthsAgo(12))

  const rangeMonthCount = countMonthsFromYearMonthToNow(rangeFromMonth)

  const handleStart = () => {
    if (mode === 'quick') {
      onStart({ mode: 'quick', startDate: '' })
      return
    }

    if (mode === 'range') {
      const { year, month } = parseYearMonth(rangeFromMonth)
      const { start } = monthBounds(year, month)
      onStart({ mode: 'range', startDate: start })
      return
    }

    const { year, month } = parseYearMonth(syncMonth)
    const { start, end } = monthBounds(year, month)
    onStart({ mode: 'month', startDate: start, endDate: end })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4">
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border-subtle">
          <h2 className="text-base font-semibold text-fg">Sync Transactions</h2>
          <button
            onClick={onClose}
            className="text-fg-subtle hover:text-fg-muted transition-colors p-1 rounded-lg hover:bg-hover-surface"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <div className="flex rounded-lg border border-border overflow-hidden text-xs sm:text-sm">
            <button
              type="button"
              onClick={() => setMode('quick')}
              className={`flex-1 py-2 font-medium transition-colors ${
                mode === 'quick'
                  ? 'bg-accent-soft text-accent-soft-fg'
                  : 'text-fg-muted hover:bg-hover-surface'
              }`}
            >
              Quick
            </button>
            <button
              type="button"
              onClick={() => setMode('month')}
              className={`flex-1 py-2 font-medium transition-colors border-l border-border ${
                mode === 'month'
                  ? 'bg-accent-soft text-accent-soft-fg'
                  : 'text-fg-muted hover:bg-hover-surface'
              }`}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setMode('range')}
              className={`flex-1 py-2 font-medium transition-colors border-l border-border ${
                mode === 'range'
                  ? 'bg-accent-soft text-accent-soft-fg'
                  : 'text-fg-muted hover:bg-hover-surface'
              }`}
            >
              Full
            </button>
          </div>

          {mode === 'quick' ? (
            <p className="text-sm text-fg-muted">
              Fetches transactions from the last 7 days. Use this for your daily sync.
            </p>
          ) : mode === 'month' ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-fg-muted">
                Imports transactions for one calendar month. Pick the month below, then start sync.
              </p>
              <label className="text-xs font-medium text-fg-muted" htmlFor="sync-month-field">
                Month
              </label>
              <MonthPickerField
                id="sync-month-field"
                value={syncMonth}
                onChange={setSyncMonth}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-fg-muted">
                Imports every calendar month from the month you choose through the current month.
                Existing transactions are skipped when they match a prior import.
              </p>
              <label className="text-xs font-medium text-fg-muted" htmlFor="range-from-month-field">
                From month
              </label>
              <MonthPickerField
                id="range-from-month-field"
                value={rangeFromMonth}
                onChange={setRangeFromMonth}
              />
              <p className="text-xs text-fg-muted">
                {rangeMonthCount} month{rangeMonthCount === 1 ? '' : 's'} will be scraped.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleStart}
            className="mt-1 w-full py-2.5 rounded-xl bg-accent text-on-primary text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            {mode === 'quick'
              ? 'Sync Last 7 Days'
              : mode === 'month'
                ? 'Sync month'
                : 'Start full sync'}
          </button>
        </div>
      </div>
    </div>
  )
}
