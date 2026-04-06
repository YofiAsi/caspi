import { useMemo, useState, useCallback } from 'react'
import type { Payment, PaymentFilters } from '../types'
import { CollapsingHeader } from '../components/CollapsingHeader'
import { PaymentList } from '../components/PaymentList'
import { PaymentDetailsPanel } from '../components/PaymentDetailsPanel'
import { BulkActionsPanel } from '../components/BulkActionsPanel'

type FilterPill = 'all' | 'untagged' | 'routine' | 'this_month'

const PILLS: { key: FilterPill; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'untagged', label: 'Untagged' },
  { key: 'routine', label: 'Routine' },
  { key: 'this_month', label: 'This month' },
]

function buildFilters(pill: FilterPill, search: string): PaymentFilters {
  const filters: PaymentFilters = {}
  if (search.trim()) {
    filters.q = search.trim()
  }
  if (pill === 'untagged') {
    filters.taggedOnly = false
  } else if (pill === 'routine') {
    // No direct filter for payment_type in PaymentFilters; show all for now
  } else if (pill === 'this_month') {
    const now = new Date()
    filters.dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    filters.dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  }
  return filters
}

export function ExpensesPage() {
  const [activePill, setActivePill] = useState<FilterPill>('all')
  const [search, setSearch] = useState('')
  const [listScrollEl, setListScrollEl] = useState<HTMLDivElement | null>(null)
  const [selectedPayments, setSelectedPayments] = useState<Payment[]>([])

  const filters = useMemo(() => buildFilters(activePill, search), [activePill, search])
  const selectedPaymentIds = useMemo(
    () => new Set(selectedPayments.map((p) => p.payment_id)),
    [selectedPayments],
  )
  const panelOpen = selectedPayments.length > 0

  const setScrollRef = useCallback((el: HTMLDivElement | null) => {
    setListScrollEl(el)
  }, [])

  const headerContent = (
    <>
      <div className="px-5 pt-5 pb-0">
        <h1 className="text-[28px] font-[800] text-fg tracking-tight">Expenses</h1>
      </div>
      <div className="mx-[18px] mt-3.5 mb-3 bg-surface rounded-[14px] flex items-center px-3.5 py-2.5 gap-2.5" style={{ border: '0.5px solid rgba(255,255,255,0.1)' }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" className="text-fg-subtle" /><path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-fg-subtle" /></svg>
        <input
          type="text"
          placeholder="Search merchants, tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-[14px] text-fg placeholder:text-fg-subtle outline-none"
        />
      </div>
      <div className="flex gap-2 px-[18px] pb-3.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {PILLS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActivePill(key)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
              activePill === key
                ? 'bg-accent-soft text-accent-soft-fg'
                : 'bg-surface text-fg-muted'
            }`}
            style={{ border: activePill === key ? '0.5px solid rgba(212,168,83,0.3)' : '0.5px solid rgba(255,255,255,0.1)' }}
          >
            {label}
          </button>
        ))}
      </div>
    </>
  )

  return (
    <div className="h-full min-h-0 flex flex-col animate-fadeUp">
      <div className={`flex-1 min-h-0 flex flex-col transition-[padding] duration-200 ${panelOpen ? 'md:pr-[352px]' : ''}`}>
        <CollapsingHeader header={headerContent} className="flex-1" scrollRef={setScrollRef}>
          <PaymentList
            filters={filters}
            scrollRoot={listScrollEl}
            selectedPaymentIds={selectedPaymentIds}
            onSelectionChange={setSelectedPayments}
            grouped
          />
        </CollapsingHeader>
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
