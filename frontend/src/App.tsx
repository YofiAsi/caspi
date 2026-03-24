import { useMemo, useState } from 'react'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { PaymentList } from './components/PaymentList'
import { PaymentDetailsPanel } from './components/PaymentDetailsPanel'
import { BulkActionsPanel } from './components/BulkActionsPanel'
import { ScrapeModal } from './components/ScrapeModal'
import type { Payment, PaymentFilters } from './types'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

function formatLocalIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getMonthBounds(monthValue: string | null): Pick<PaymentFilters, 'dateFrom' | 'dateTo'> {
  if (!monthValue) return {}
  const [yearStr, monthStr] = monthValue.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  if (!year || !month) return {}
  const from = new Date(year, month - 1, 1)
  const to = new Date(year, month, 0)
  return { dateFrom: formatLocalIsoDate(from), dateTo: formatLocalIsoDate(to) }
}

function AppInner() {
  const now = useMemo(() => new Date(), [])
  const initialMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [month, setMonth] = useState<string | null>(initialMonth)
  const [filters, setFilters] = useState<PaymentFilters>(() => ({
    ...getMonthBounds(initialMonth),
  }))
  const [selectedPayments, setSelectedPayments] = useState<Payment[]>([])
  const [showScrapeModal, setShowScrapeModal] = useState(false)
  const queryClient = useQueryClient()

  const handleMonthChange = (value: string) => {
    if (!value) return
    setMonth(value)
    setFilters((prev) => ({
      ...prev,
      ...getMonthBounds(value),
    }))
  }

  const shiftMonth = (delta: number) => {
    let base: Date
    if (month) {
      const [yStr, mStr] = month.split('-')
      const y = Number(yStr)
      const m = Number(mStr)
      base = y && m ? new Date(y, m - 1, 1) : new Date()
    } else {
      base = new Date()
    }
    base.setMonth(base.getMonth() + delta)
    const next = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`
    handleMonthChange(next)
  }

  const selectedPaymentIds = useMemo(
    () => new Set(selectedPayments.map((p) => p.payment_id)),
    [selectedPayments],
  )
  const panelOpen = selectedPayments.length > 0

  return (
    <>
      <div className={`h-screen flex flex-col bg-gray-50 transition-[padding] duration-200 ${panelOpen ? 'md:pr-[352px]' : ''}`}>
        <header className="shrink-0 bg-white border-b border-gray-200 px-4 sm:px-6 flex items-center justify-between gap-4" style={{ height: '73px' }}>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Caspi</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => shiftMonth(-1)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                aria-label="Previous month"
              >
                ‹
              </button>
              <input
                type="month"
                value={month ?? ''}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              />
              <button
                onClick={() => shiftMonth(1)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                aria-label="Next month"
              >
                ›
              </button>
            </div>
            <button
              onClick={() => setShowScrapeModal(true)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Sync transactions"
              title="Sync transactions"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-hidden max-w-5xl w-full mx-auto bg-white sm:my-4 sm:rounded-2xl sm:shadow-sm sm:border sm:border-gray-200 flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <PaymentList
              filters={filters}
              selectedPaymentIds={selectedPaymentIds}
              onSelectionChange={setSelectedPayments}
            />
          </div>
        </main>
        {selectedPayments.length === 1 ? (
          <PaymentDetailsPanel
            payment={selectedPayments[0]}
            onClose={() => setSelectedPayments([])}
            onPaymentUpdate={(p) => setSelectedPayments([p])}
          />
        ) : selectedPayments.length > 1 ? (
          <BulkActionsPanel
            payments={selectedPayments}
            onClearSelection={() => setSelectedPayments([])}
          />
        ) : null}
      </div>
      {showScrapeModal && (
        <ScrapeModal
          onClose={() => setShowScrapeModal(false)}
          onSyncComplete={() => queryClient.invalidateQueries({ queryKey: ['payments'] })}
        />
      )}
    </>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
    </QueryClientProvider>
  )
}
