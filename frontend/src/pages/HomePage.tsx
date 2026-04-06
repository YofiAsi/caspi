import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { CollapsingHeader } from '../components/CollapsingHeader'
import { PaymentCard } from '../components/PaymentCard'
import { api } from '../api/client'
import { formatCurrency } from '../utils/currency'

function getCurrentMonthBounds() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  return { start, end }
}

function readFullscreenElement(): Element | null {
  const d = document as Document & { webkitFullscreenElement?: Element | null }
  return document.fullscreenElement ?? d.webkitFullscreenElement ?? null
}

async function requestDocumentFullscreen(): Promise<void> {
  const el = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => void
  }
  if (typeof el.requestFullscreen === 'function') {
    await el.requestFullscreen()
    return
  }
  if (typeof el.webkitRequestFullscreen === 'function') {
    el.webkitRequestFullscreen()
  }
}

export function HomePage() {
  const navigate = useNavigate()
  const [isFullscreen, setIsFullscreen] = useState(() => readFullscreenElement() !== null)

  useEffect(() => {
    const sync = () => setIsFullscreen(readFullscreenElement() !== null)
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('webkitfullscreenchange', sync)
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      document.removeEventListener('webkitfullscreenchange', sync)
    }
  }, [])

  const enterFullscreen = useCallback(() => {
    void (async () => {
      try {
        if (!readFullscreenElement()) await requestDocumentFullscreen()
      } catch {
        /* unsupported or blocked */
      }
    })()
  }, [])

  const { start, end } = getCurrentMonthBounds()

  const { data: summary } = useQuery({
    queryKey: ['payments', 'summary', 'home'],
    queryFn: () => api.payments.summary({ dateFrom: start, dateTo: end, currency: 'ILS' }),
  })

  const { data: recentData } = useQuery({
    queryKey: ['payments', 'recent-home'],
    queryFn: () => api.payments.listPage({ sort: 'date_desc' }, { limit: 10 }),
  })

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => api.tags.list(),
    staleTime: 120_000,
  })

  const tagLabels = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of tagsData?.tags ?? []) m.set(t.id, t.name)
    return m
  }, [tagsData])

  const recentPayments = recentData?.items ?? []
  const untaggedPayments = recentPayments.filter(
    (p) => p.payment_tags.length === 0 && p.merchant_tags.length === 0,
  )
  const taggedRecent = recentPayments.slice(0, 5)

  const currentTotal = summary?.totals_by_currency?.find((t) => t.currency === 'ILS')
  const currentSum = Number(currentTotal?.sum_effective ?? 0)
  const paymentCount = summary?.payment_count ?? 0

  const untaggedCount = summary?.untagged_by_currency?.reduce((n, u) => n + u.payment_count, 0) ?? 0

  const now = new Date()
  const monthLabel = now.toLocaleDateString('en-US', { month: 'long' })

  const brandHeader = (
    <div className="px-5 pt-5 pb-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <img src="/favicon.png" alt="" className="h-9 w-9 rounded-[13px] shrink-0" width={36} height={36} />
          <p className="text-[34px] font-[800] text-fg tracking-tight leading-tight">Caspi</p>
        </div>
        {!isFullscreen ? (
          <button
            type="button"
            onClick={enterFullscreen}
            className="shrink-0 flex items-center justify-center h-10 w-10 rounded-[13px] text-fg-muted hover:bg-hover-surface active:bg-active-surface transition-colors"
            style={{ border: '0.5px solid rgba(255,255,255,0.1)' }}
            aria-label="Enter fullscreen"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  )

  return (
    <CollapsingHeader header={brandHeader} disableCollapse className="flex-1 min-h-0 animate-fadeUp">
      <div className="px-5 pt-2 pb-4">

        {/* Hero month card */}
        <div
          className="mt-5 bg-accent rounded-[24px] p-5 relative overflow-hidden cursor-pointer"
          onClick={() => navigate('/analytics')}
        >
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/[0.08]" />
          <div className="absolute -bottom-12 left-5 w-30 h-30 rounded-full bg-black/[0.06]" />
          <div className="relative">
            <p className="text-[11px] font-bold text-on-primary/50 uppercase tracking-wider">
              {monthLabel}
            </p>
            <p className="text-[40px] font-[900] text-on-primary tracking-tight leading-none mt-1">
              {formatCurrency(currentSum, 'ILS')}
            </p>
            <p className="text-[12px] text-on-primary/50 font-medium mt-0.5">
              {paymentCount} expenses this month
            </p>
            {untaggedCount > 0 ? (
              <div className="flex gap-2 mt-3.5 flex-wrap">
                <span className="bg-on-primary/10 rounded-full px-2.5 py-1 text-[11px] font-bold text-on-primary/70">
                  {untaggedCount} untagged
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Needs attention */}
      {untaggedPayments.length > 0 && (
        <>
          <div className="flex justify-between items-center px-5 pt-5 pb-2.5">
            <span className="text-[11px] font-bold text-fg-subtle uppercase tracking-wider">Needs attention</span>
            <span className="text-[13px] text-accent font-medium cursor-pointer" onClick={() => navigate('/expenses')}>See all</span>
          </div>
          <div className="mx-[18px] bg-surface rounded-[20px] overflow-hidden" style={{ border: '0.5px solid rgba(255,255,255,0.1)' }}>
            {untaggedPayments.slice(0, 3).map((p) => (
              <PaymentCard
                key={p.payment_id}
                payment={p}
                tagLabels={tagLabels}
                onClick={() => navigate('/expenses')}
              />
            ))}
          </div>
        </>
      )}

      {/* Recent */}
      <div className="flex justify-between items-center px-5 pt-5 pb-2.5">
        <span className="text-[11px] font-bold text-fg-subtle uppercase tracking-wider">Recent</span>
        <span className="text-[13px] text-accent font-medium cursor-pointer" onClick={() => navigate('/expenses')}>See all</span>
      </div>
      <div className="mx-[18px] mb-5 bg-surface rounded-[20px] overflow-hidden" style={{ border: '0.5px solid rgba(255,255,255,0.1)' }}>
        {taggedRecent.map((p) => (
          <PaymentCard
            key={p.payment_id}
            payment={p}
            tagLabels={tagLabels}
            onClick={() => navigate('/expenses')}
          />
        ))}
      </div>
    </CollapsingHeader>
  )
}
