import { useMemo, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { AuthGate, type AuthContext } from './components/AuthGate'
import { PaymentList } from './components/PaymentList'
import { PaymentDetailsPanel } from './components/PaymentDetailsPanel'
import { BulkActionsPanel } from './components/BulkActionsPanel'
import { PaymentAnalysisPage } from './components/PaymentAnalysisPage'
import { getMonthBounds } from './lib/monthBounds'
import type { Payment, PaymentFilters } from './types'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

function HomePage() {
  const now = useMemo(() => new Date(), [])
  const initialMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [month, setMonth] = useState<string | null>(initialMonth)
  const [filters, setFilters] = useState<PaymentFilters>(() => ({
    ...getMonthBounds(initialMonth),
  }))
  const [selectedPayments, setSelectedPayments] = useState<Payment[]>([])

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
    <div className="h-full min-h-0 flex flex-col">
      <div
        className={`flex-1 min-h-0 flex flex-col transition-[padding] duration-200 ${panelOpen ? 'md:pr-[352px]' : ''}`}
      >
        <main className="flex-1 overflow-hidden max-w-5xl w-full mx-auto bg-white sm:my-4 sm:rounded-2xl sm:shadow-sm sm:border sm:border-gray-200 flex flex-col">
          <div className="shrink-0 flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50/80">
            <span className="text-xs font-medium text-gray-600 mr-1">Period</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
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
                type="button"
                onClick={() => shiftMonth(1)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                aria-label="Next month"
              >
                ›
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            <PaymentList
              filters={filters}
              selectedPaymentIds={selectedPaymentIds}
              onSelectionChange={setSelectedPayments}
            />
          </div>
        </main>
      </div>
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
  )
}

function AppRoutes({ auth }: { auth: AuthContext }) {
  return (
    <Routes>
      <Route element={<AppLayout auth={auth} />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/analysis" element={<PaymentAnalysisPage />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthGate>{(auth) => <AppRoutes auth={auth} />}</AuthGate>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
