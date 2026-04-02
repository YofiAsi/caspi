import { useMemo, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { AuthGate, type AuthContext } from './components/AuthGate'
import { PaymentList } from './components/PaymentList'
import { PaymentDetailsPanel } from './components/PaymentDetailsPanel'
import { BulkActionsPanel } from './components/BulkActionsPanel'
import { CollectionDetailPage } from './pages/CollectionDetailPage'
import { CollectionsPage } from './pages/CollectionsPage'
import { MonthlyBreakdownPage } from './pages/MonthlyBreakdownPage'
import { SettingsPage } from './pages/SettingsPage'
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
  const [listScrollEl, setListScrollEl] = useState<HTMLDivElement | null>(null)
  const [listTopYear, setListTopYear] = useState<number | null>(null)
  const listFilters = useMemo<PaymentFilters>(() => ({}), [])
  const [selectedPayments, setSelectedPayments] = useState<Payment[]>([])

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
        <main className="flex-1 overflow-hidden max-w-5xl w-full mx-auto bg-surface sm:my-4 sm:rounded-2xl sm:shadow-sm sm:border sm:border-border flex flex-col">
          <div className="relative flex-1 min-h-0 flex flex-col">
            {listTopYear !== null && listTopYear < new Date().getFullYear() ? (
              <div
                className="pointer-events-none absolute top-3 left-0 right-0 z-10 flex justify-center"
                aria-hidden
              >
                <span className="rounded-full border border-border-subtle bg-surface px-3 py-1 text-sm font-semibold text-fg-secondary shadow-sm">
                  {listTopYear}
                </span>
              </div>
            ) : null}
            <div ref={setListScrollEl} className="flex-1 overflow-y-auto min-h-0">
              <PaymentList
                filters={listFilters}
                scrollRoot={listScrollEl}
                selectedPaymentIds={selectedPaymentIds}
                onSelectionChange={setSelectedPayments}
                onTopVisibleYearChange={setListTopYear}
              />
            </div>
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
        <Route path="/analysis" element={<MonthlyBreakdownPage />} />
        <Route path="/collections" element={<CollectionsPage />} />
        <Route path="/collections/:collectionId" element={<CollectionDetailPage />} />
        <Route path="/settings" element={<SettingsPage auth={auth} />} />
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
