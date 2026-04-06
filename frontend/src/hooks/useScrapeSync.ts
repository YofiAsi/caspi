import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'

/* ── Types ── */

export type Mode = 'quick' | 'month' | 'range'
type Phase = 'idle' | 'running' | 'done' | 'error'

export interface MonthResult {
  month: string
  payment_count?: number
  error?: string
  error_code?: string
}

export interface Progress {
  current: number
  total: number
  month: string
}

export type BankWait =
  | { kind: 'rate_limit'; waitMs: number; attempt?: number; month?: string }
  | { kind: 'session_recycle'; recyclesRemaining?: number }

export interface Summary {
  total_payments: number
  months_scraped: number
  months_failed: number
}

export interface ScrapeState {
  phase: Phase
  mode: Mode | null
  progress: Progress | null
  bankWait: BankWait | null
  results: MonthResult[]
  summary: Summary | null
  errorMsg: string | null
}

export interface ScrapeParams {
  mode: Mode
  startDate: string
  endDate?: string
}

type BulkSseEvent =
  | { type: 'start'; total: number }
  | { type: 'cooldown'; seconds: number; next_month: string }
  | { type: 'progress'; current: number; total: number; month: string }
  | { type: 'month_done'; month: string; payment_count?: number }
  | { type: 'rate_limit'; wait_ms: number; attempt?: number; month?: string }
  | { type: 'session_recycle'; recycles_remaining?: number }
  | { type: 'month_error'; month: string; error: string; error_code?: string }
  | { type: 'done'; total_payments: number; months_scraped: number; months_failed: number }

/* ── Helpers ── */

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

export function monthErrorLabel(r: MonthResult): string {
  if (r.error_code === 'AUTOMATION_BLOCKED') return 'Blocked (try later)'
  if (r.error_code === 'RateLimited' || r.error_code === 'RATE_LIMITED') return 'Rate limited (try later)'
  if (r.error?.includes('rate-limited') || r.error?.includes('blocked automated access')) return 'Blocked (try later)'
  return 'Failed'
}

export function bankWaitLabel(w: BankWait): string {
  if (w.kind === 'session_recycle') {
    const n = w.recyclesRemaining
    return n != null ? `Reconnecting session (${n} recycle${n === 1 ? '' : 's'} left)` : 'Reconnecting session\u2026'
  }
  const sec = Math.max(1, Math.ceil(w.waitMs / 1000))
  const att = w.attempt != null ? ` \u00b7 retry ${w.attempt}` : ''
  const m = w.month ? ` \u00b7 ${w.month}` : ''
  return `Bank rate limit \u2014 waiting ~${sec}s${att}${m}`
}

/* ── Hook ── */

export function useScrapeSync(onComplete: () => void) {
  const [state, setState] = useState<ScrapeState>({
    phase: 'idle',
    mode: null,
    progress: null,
    bankWait: null,
    results: [],
    summary: null,
    errorMsg: null,
  })
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  const start = useCallback((params: ScrapeParams) => {
    setState({
      phase: 'running',
      mode: params.mode,
      progress: null,
      bankWait: null,
      results: [],
      summary: null,
      errorMsg: null,
    })

    if (params.mode === 'quick') {
      api.scrape
        .quick(sevenDaysAgo())
        .then((result) => {
          setState((s) => ({
            ...s,
            summary: { total_payments: result.payment_count, months_scraped: 1, months_failed: 0 },
            phase: 'done',
          }))
          onComplete()
        })
        .catch((e) => {
          setState((s) => ({ ...s, errorMsg: String(e), phase: 'error' }))
        })
      return
    }

    const controller = new AbortController()
    abortRef.current = controller

    const urlParams = new URLSearchParams({ start_date: params.startDate })
    if (params.endDate) urlParams.set('end_date', params.endDate)

    consumeIsracardBulkSse(urlParams, controller.signal, (event) => {
      if (event.type === 'start') {
        setState((s) => ({ ...s, progress: { current: 0, total: event.total, month: '' } }))
      } else if (event.type === 'cooldown') {
        setState((s) => ({ ...s, bankWait: { kind: 'rate_limit', waitMs: event.seconds * 1000, month: event.next_month } }))
      } else if (event.type === 'progress') {
        setState((s) => ({ ...s, bankWait: null, progress: { current: event.current, total: event.total, month: event.month } }))
      } else if (event.type === 'rate_limit') {
        setState((s) => ({ ...s, bankWait: { kind: 'rate_limit', waitMs: event.wait_ms, attempt: event.attempt, month: event.month } }))
      } else if (event.type === 'session_recycle') {
        setState((s) => ({ ...s, bankWait: { kind: 'session_recycle', recyclesRemaining: event.recycles_remaining } }))
      } else if (event.type === 'month_done') {
        setState((s) => ({ ...s, results: [...s.results, { month: event.month, payment_count: event.payment_count }] }))
      } else if (event.type === 'month_error') {
        setState((s) => ({ ...s, results: [...s.results, { month: event.month, error: event.error, error_code: event.error_code }] }))
      } else if (event.type === 'done') {
        setState((s) => ({
          ...s,
          bankWait: null,
          summary: { total_payments: event.total_payments, months_scraped: event.months_scraped, months_failed: event.months_failed },
          phase: 'done',
        }))
        onComplete()
      }
    }).catch((e: unknown) => {
      if (e instanceof Error && e.name === 'AbortError') {
        setState((s) => ({ ...s, phase: 'idle', mode: null }))
        return
      }
      setState((s) => ({ ...s, errorMsg: String(e), phase: 'error' }))
    })
  }, [onComplete])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  const dismiss = useCallback(() => {
    setState({ phase: 'idle', mode: null, progress: null, bankWait: null, results: [], summary: null, errorMsg: null })
  }, [])

  return { state, start, cancel, dismiss }
}
