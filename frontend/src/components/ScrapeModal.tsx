import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { MonthPickerField } from './MonthPickerField'
import {
  countMonthsFromYearMonthToNow,
  currentYearMonth,
  formatYearMonthLabel,
  monthBounds,
  parseYearMonth,
  yearMonthMonthsAgo,
} from '../utils/monthBounds'

interface Props {
  onClose: () => void
  onSyncComplete: () => void
}

type Mode = 'quick' | 'month' | 'range'
type Phase = 'idle' | 'running' | 'done' | 'error'

interface MonthResult {
  month: string
  payment_count?: number
  error?: string
  error_code?: string
}

function monthErrorLabel(r: MonthResult): string {
  if (r.error_code === 'AUTOMATION_BLOCKED') {
    return 'Blocked (try later)'
  }
  if (
    r.error?.includes('rate-limited') ||
    r.error?.includes('blocked automated access')
  ) {
    return 'Blocked (try later)'
  }
  return 'Failed'
}

interface Progress {
  current: number
  total: number
  month: string
}

interface Cooldown {
  seconds: number
  nextMonth: string
}

interface Summary {
  total_payments: number
  months_scraped: number
  months_failed: number
}

type BulkSseEvent =
  | { type: 'start'; total: number }
  | { type: 'cooldown'; seconds: number; next_month: string }
  | { type: 'progress'; current: number; total: number; month: string }
  | { type: 'month_done'; month: string; payment_count?: number }
  | { type: 'month_error'; month: string; error: string; error_code?: string }
  | { type: 'done'; total_payments: number; months_scraped: number; months_failed: number }

function sevenDaysAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}

async function consumeIsracardBulkSse(
  params: URLSearchParams,
  signal: AbortSignal,
  onEvent: (event: BulkSseEvent) => void,
): Promise<void> {
  const res = await fetch(`/api/scrape/isracard/bulk?${params}`, {
    method: 'POST',
    credentials: 'include',
    signal,
  })

  if (!res.ok) {
    throw new Error(await res.text())
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      const line = part.split('\n').find((l) => l.startsWith('data: '))
      if (!line) continue
      const event = JSON.parse(line.slice(6)) as BulkSseEvent
      onEvent(event)
    }
  }
}

export function ScrapeModal({ onClose, onSyncComplete }: Props) {
  const [mode, setMode] = useState<Mode>('quick')
  const [syncMonth, setSyncMonth] = useState(currentYearMonth)
  const [rangeFromMonth, setRangeFromMonth] = useState(() => yearMonthMonthsAgo(12))
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState<Progress | null>(null)
  const [cooldown, setCooldown] = useState<Cooldown | null>(null)
  const [results, setResults] = useState<MonthResult[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const resultsEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    resultsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [results])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const handleQuickSync = async () => {
    setPhase('running')
    setErrorMsg(null)
    setSummary(null)
    try {
      const result = await api.scrape.quick(sevenDaysAgo())
      setSummary({ total_payments: result.payment_count, months_scraped: 1, months_failed: 0 })
      setPhase('done')
      onSyncComplete()
    } catch (e) {
      setErrorMsg(String(e))
      setPhase('error')
    }
  }

  const runBulkSync = async (params: URLSearchParams) => {
    setPhase('running')
    setResults([])
    setSummary(null)
    setErrorMsg(null)
    setProgress(null)
    setCooldown(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      await consumeIsracardBulkSse(params, controller.signal, (event) => {
        if (event.type === 'start') {
          setProgress({ current: 0, total: event.total, month: '' })
        } else if (event.type === 'cooldown') {
          setCooldown({ seconds: event.seconds, nextMonth: event.next_month })
        } else if (event.type === 'progress') {
          setCooldown(null)
          setProgress({
            current: event.current,
            total: event.total,
            month: event.month,
          })
        } else if (event.type === 'month_done') {
          setResults((prev) => [
            ...prev,
            { month: event.month, payment_count: event.payment_count },
          ])
        } else if (event.type === 'month_error') {
          setResults((prev) => [
            ...prev,
            {
              month: event.month,
              error: event.error,
              error_code: event.error_code,
            },
          ])
        } else if (event.type === 'done') {
          setSummary({
            total_payments: event.total_payments,
            months_scraped: event.months_scraped,
            months_failed: event.months_failed,
          })
          setPhase('done')
          onSyncComplete()
        }
      })
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return
      setErrorMsg(String(e))
      setPhase('error')
    }
  }

  const handleStart = () => {
    if (mode === 'quick') {
      void handleQuickSync()
      return
    }

    if (mode === 'range') {
      const span = countMonthsFromYearMonthToNow(rangeFromMonth)
      if (span > 12) {
        const ok = window.confirm(
          `Import ${span} months from ${formatYearMonthLabel(rangeFromMonth)} through the current month? There is a short pause between each month (it lengthens if a request fails or Isracard blocks access).`,
        )
        if (!ok) return
      }
      const { year, month } = parseYearMonth(rangeFromMonth)
      const { start } = monthBounds(year, month)
      const params = new URLSearchParams({ start_date: start })
      void runBulkSync(params)
      return
    }

    const { year, month } = parseYearMonth(syncMonth)
    const { start, end } = monthBounds(year, month)
    const params = new URLSearchParams({ start_date: start, end_date: end })
    void runBulkSync(params)
  }

  const completedCount = progress?.current ?? 0
  const totalCount = progress?.total ?? 0
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const rangeMonthCount = countMonthsFromYearMonthToNow(rangeFromMonth)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Sync Transactions</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          {phase === 'idle' && (
            <>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs sm:text-sm">
                <button
                  type="button"
                  onClick={() => setMode('quick')}
                  className={`flex-1 py-2 font-medium transition-colors ${
                    mode === 'quick'
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  Quick
                </button>
                <button
                  type="button"
                  onClick={() => setMode('month')}
                  className={`flex-1 py-2 font-medium transition-colors border-l border-gray-200 ${
                    mode === 'month'
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  Month
                </button>
                <button
                  type="button"
                  onClick={() => setMode('range')}
                  className={`flex-1 py-2 font-medium transition-colors border-l border-gray-200 ${
                    mode === 'range'
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  Full
                </button>
              </div>

              {mode === 'quick' ? (
                <p className="text-sm text-gray-500">
                  Fetches transactions from the last 7 days. Use this for your daily sync.
                </p>
              ) : mode === 'month' ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-gray-500">
                    Imports transactions for one calendar month. Pick the month below, then start sync.
                  </p>
                  <label className="text-xs font-medium text-gray-600" htmlFor="sync-month-field">
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
                  <p className="text-sm text-gray-500">
                    Imports every calendar month from the month you choose through the current month.
                    Existing transactions are skipped when they match a prior import.
                  </p>
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    Pauses between months start short and shrink after successful imports; they grow again
                    if the bank rate-limits or a month fails. Retry later if you see blocks.
                  </p>
                  <label className="text-xs font-medium text-gray-600" htmlFor="range-from-month-field">
                    From month
                  </label>
                  <MonthPickerField
                    id="range-from-month-field"
                    value={rangeFromMonth}
                    onChange={setRangeFromMonth}
                  />
                  <p className="text-xs text-gray-500">
                    {rangeMonthCount} month{rangeMonthCount === 1 ? '' : 's'} will be scraped
                    {rangeMonthCount > 12 ? ' (confirmation required)' : ''}.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleStart}
                className="mt-1 w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                {mode === 'quick'
                  ? 'Sync Last 7 Days'
                  : mode === 'month'
                    ? 'Sync month'
                    : 'Start full sync'}
              </button>
            </>
          )}

          {phase === 'running' && mode === 'quick' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="h-8 w-8 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
              <p className="text-sm text-gray-500">Syncing last 7 days…</p>
            </div>
          )}

          {phase === 'running' && (mode === 'month' || mode === 'range') && (
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center text-xs">
                {cooldown ? (
                  <span className="text-amber-600 font-medium">
                    ⏳ Cooldown {cooldown.seconds}s — next: {cooldown.nextMonth}
                  </span>
                ) : (
                  <span className="text-indigo-600 font-medium flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                    {progress?.month ? `Scraping ${progress.month}` : 'Starting…'}
                  </span>
                )}
                <span className="text-gray-400">
                  {completedCount} / {totalCount}
                </span>
              </div>

              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    cooldown ? 'bg-amber-400' : 'bg-indigo-500'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              {results.length > 0 && (
                <div className="max-h-52 overflow-y-auto flex flex-col gap-1 text-xs">
                  {results.map((r) => (
                    <div
                      key={r.month}
                      className={`flex items-center justify-between px-3 py-1.5 rounded-lg ${
                        r.error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      <span className="font-mono">{r.month}</span>
                      {r.error ? (
                        <span className="text-red-500 truncate max-w-[200px]" title={r.error}>
                          {monthErrorLabel(r)}
                        </span>
                      ) : (
                        <span>{r.payment_count} txns ✓</span>
                      )}
                    </div>
                  ))}
                  <div ref={resultsEndRef} />
                </div>
              )}
            </div>
          )}

          {phase === 'done' && summary && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-4 py-3 rounded-xl text-sm font-medium">
                <span>✓</span>
                <span>Sync complete</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-gray-50 rounded-xl py-3 px-2">
                  <div className="text-lg font-bold text-gray-900">{summary.total_payments}</div>
                  <div className="text-gray-500 mt-0.5">transactions</div>
                </div>
                <div className="bg-gray-50 rounded-xl py-3 px-2">
                  <div className="text-lg font-bold text-gray-900">{summary.months_scraped}</div>
                  <div className="text-gray-500 mt-0.5">months</div>
                </div>
                <div className={`rounded-xl py-3 px-2 ${summary.months_failed > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <div className={`text-lg font-bold ${summary.months_failed > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {summary.months_failed}
                  </div>
                  <div className={`mt-0.5 ${summary.months_failed > 0 ? 'text-red-500' : 'text-gray-500'}`}>
                    failed
                  </div>
                </div>
              </div>
              {(mode === 'month' || mode === 'range') && results.length > 0 && (
                <div className="max-h-40 overflow-y-auto flex flex-col gap-1 text-xs">
                  {results.map((r) => (
                    <div
                      key={r.month}
                      className={`flex items-center justify-between px-3 py-1.5 rounded-lg ${
                        r.error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      <span className="font-mono">{r.month}</span>
                      {r.error ? (
                        <span className="truncate max-w-[200px]" title={r.error}>
                          {monthErrorLabel(r)}
                        </span>
                      ) : (
                        <span>{r.payment_count} txns</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Done
              </button>
            </div>
          )}

          {phase === 'error' && (
            <div className="flex flex-col gap-3">
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm">
                {errorMsg || 'An unexpected error occurred.'}
              </div>
              <button
                type="button"
                onClick={() => setPhase('idle')}
                className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
