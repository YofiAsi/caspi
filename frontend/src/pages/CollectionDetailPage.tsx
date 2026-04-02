import { useEffect, useMemo, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { AnalysisPaymentList } from '../components/analysis/AnalysisPaymentList'
import {
  CollectionTimeBarChart,
  type SparseTimeseriesRow,
} from '../components/analysis/CollectionTimeBarChart'
import { periodRangeFilter, type TimeGranularity } from '../utils/collectionPeriodFilter'
import {
  TagCombinationPieChart,
  type SliceSelection,
} from '../components/analysis/TagCombinationPieChart'
import { PaymentDetailsPanel } from '../components/PaymentDetailsPanel'
import { api } from '../api/client'
import type { MonthTagSliceRow, Payment, PaymentFilters, PaymentListCursor, PaymentListSort } from '../types'
import { formatCollectionDateRange } from '../utils/collectionDateRange'

const PAGE_SIZE = 50

type SortField = 'date' | 'price' | 'name'
type SortDir = 'asc' | 'desc'

const SORT_FIELDS: { value: SortField; label: string }[] = [
  { value: 'date', label: 'Time' },
  { value: 'price', label: 'Price' },
  { value: 'name', label: 'Name' },
]

function toPaymentSort(field: SortField, dir: SortDir): PaymentListSort {
  if (field === 'date') return dir === 'asc' ? 'date_asc' : 'date_desc'
  if (field === 'price') return dir === 'asc' ? 'amount_asc' : 'amount_desc'
  return dir === 'asc' ? 'merchant_asc' : 'merchant_desc'
}

function buildPaymentFilters(
  collectionId: string,
  period: { dateFrom: string; dateTo: string } | null,
  slice: SliceSelection,
  explicitSlices: MonthTagSliceRow[],
  sort: PaymentListSort,
): PaymentFilters {
  const base: PaymentFilters = {
    collectionId,
    currency: 'ILS',
    sort,
    includeTotals: true,
  }
  if (period) {
    base.dateFrom = period.dateFrom
    base.dateTo = period.dateTo
  }
  if (!slice) return base
  if (slice.kind === 'exact') {
    base.applyTagCombo = true
    base.mergedTagIds = [...slice.otherTagIds].sort()
    return base
  }
  base.applyTagComboOther = true
  base.tagComboExcludes = explicitSlices.map((s) => [...s.other_tag_ids].sort())
  return base
}

export function CollectionDetailPage() {
  const { collectionId = '' } = useParams<{ collectionId: string }>()
  const [granularity, setGranularity] = useState<TimeGranularity>('monthly')
  const [selectedPeriodStart, setSelectedPeriodStart] = useState<string | null>(null)
  const [sliceSelection, setSliceSelection] = useState<SliceSelection>(null)
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const sort = toPaymentSort(sortField, sortDir)
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [listScrollEl, setListScrollEl] = useState<HTMLDivElement | null>(null)

  const { data: collections = [] } = useQuery({
    queryKey: ['collections'],
    queryFn: () => api.collections.list(),
  })

  const meta = useMemo(
    () => collections.find((c) => c.id === collectionId),
    [collections, collectionId],
  )

  useEffect(() => {
    if (meta?.name) {
      document.title = `${meta.name} · Caspi`
    }
    return () => {
      document.title = 'Caspi'
    }
  }, [meta?.name])

  const { data: tsData, isPending: tsPending } = useQuery({
    queryKey: ['collections', collectionId, 'timeseries', granularity],
    queryFn: () => api.collections.timeseries(collectionId, granularity),
    enabled: Boolean(collectionId),
  })

  const sparseRows: SparseTimeseriesRow[] = useMemo(
    () =>
      (tsData?.rows ?? []).map((r) => ({
        period_start: r.period_start,
        sum_effective: Number(r.sum_effective),
        payment_count: r.payment_count,
      })),
    [tsData],
  )

  const { data: slicesData } = useQuery({
    queryKey: ['collections', collectionId, 'tag-slices'],
    queryFn: () => api.collections.tagSlices(collectionId),
    enabled: Boolean(collectionId),
  })

  const periodFilter = useMemo(() => {
    if (!selectedPeriodStart) return null
    return periodRangeFilter(selectedPeriodStart, granularity)
  }, [selectedPeriodStart, granularity])

  const explicitSlices = useMemo(
    () => (slicesData?.slices ?? []).filter((s) => !s.is_other),
    [slicesData],
  )

  const listFilters: PaymentFilters | null = useMemo(() => {
    if (!collectionId) return null
    return buildPaymentFilters(collectionId, periodFilter, sliceSelection, explicitSlices, sort)
  }, [collectionId, periodFilter, sliceSelection, explicitSlices, sort])

  const {
    data: listData,
    isPending: listPending,
    isError: listError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['payments', 'collection', collectionId, listFilters],
    queryFn: ({ pageParam }) =>
      api.payments.listPage(listFilters!, {
        limit: PAGE_SIZE,
        cursor: pageParam ?? undefined,
      }),
    initialPageParam: null as PaymentListCursor | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: listFilters != null,
  })

  const payments = useMemo(() => listData?.pages.flatMap((p) => p.items) ?? [], [listData])
  const filterTotals = listData?.pages[0]?.filter_totals
  const panelOpen = selectedPayment !== null
  const hasPieSlices = Boolean(slicesData && slicesData.slices.length > 0)
  const filterActive = Boolean(periodFilter || sliceSelection)
  const otherSelectDisabled = explicitSlices.length === 0

  const handleGranularityChange = (g: TimeGranularity) => {
    setGranularity(g)
    setSelectedPeriodStart(null)
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div
        className={`flex-1 min-h-0 flex flex-col transition-[padding] duration-200 ${panelOpen ? 'md:pr-[352px]' : ''}`}
      >
        <main className="flex-1 overflow-hidden max-w-5xl w-full mx-auto bg-surface sm:my-4 sm:rounded-2xl sm:shadow-sm sm:border sm:border-border flex flex-col">
          <div ref={setListScrollEl} className="flex-1 overflow-y-auto min-h-0 px-4 py-4 pb-8 space-y-5">
            {!meta ? (
              <div className="flex justify-center py-12">
                <div className="h-6 w-6 rounded-full border-2 border-ring border-t-transparent animate-spin" />
              </div>
            ) : (
              <header className="space-y-1">
                <h1 className="text-lg font-bold text-fg">{meta.name}</h1>
                <p className="text-sm text-fg-secondary">
                  {formatCollectionDateRange(meta.first_payment_date, meta.last_payment_date)}
                </p>
                <p className="text-sm text-fg-secondary">
                  ₪{Number(meta.sum_effective).toLocaleString('en-IL', { maximumFractionDigits: 0 })} ·{' '}
                  {meta.payment_count} payment{meta.payment_count === 1 ? '' : 's'}
                </p>
              </header>
            )}

            {filterActive && filterTotals ? (
              <div className="rounded-xl border border-border-subtle bg-hover-surface/40 px-3 py-2 text-sm text-fg-secondary flex flex-wrap items-center gap-2">
                <span>
                  Showing {filterTotals.payment_count} payment
                  {filterTotals.payment_count === 1 ? '' : 's'} · ₪
                  {Number(filterTotals.sum_effective).toLocaleString('en-IL', {
                    maximumFractionDigits: 0,
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPeriodStart(null)
                    setSliceSelection(null)
                  }}
                  className="text-xs font-medium px-2 py-0.5 rounded-full bg-accent-soft text-accent-soft-fg hover:opacity-80"
                >
                  Clear filters
                </button>
              </div>
            ) : null}

            {tsPending ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 rounded-full border-2 border-ring border-t-transparent animate-spin" />
              </div>
            ) : (
              <CollectionTimeBarChart
                rows={sparseRows}
                granularity={granularity}
                onGranularityChange={handleGranularityChange}
                selectedPeriodStart={selectedPeriodStart}
                onSelectBar={setSelectedPeriodStart}
              />
            )}

            {hasPieSlices ? (
              <div className="w-full min-w-0">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wide">
                    Tag combinations
                  </h3>
                  {sliceSelection ? (
                    <button
                      type="button"
                      onClick={() => setSliceSelection(null)}
                      className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-accent-soft text-accent-soft-fg hover:opacity-80 transition-opacity"
                    >
                      Filter active
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        aria-hidden
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  ) : null}
                </div>
                <TagCombinationPieChart
                  slices={slicesData!.slices}
                  selection={sliceSelection}
                  onSelect={(next) => {
                    if (next?.kind === 'other' && otherSelectDisabled) return
                    setSliceSelection(next)
                  }}
                />
              </div>
            ) : null}

            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <h2 className="text-sm font-semibold text-fg">Payments</h2>
                <div className="flex items-center gap-1 flex-wrap justify-end">
                  {SORT_FIELDS.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setSortField(f.value)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        sortField === f.value
                          ? 'bg-accent-soft text-accent-soft-fg'
                          : 'text-fg-muted hover:bg-hover-surface'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                    className="ml-1 flex items-center justify-center h-7 w-7 rounded-lg text-fg-muted hover:bg-hover-surface transition-colors"
                    aria-label={sortDir === 'asc' ? 'Ascending' : 'Descending'}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className={`h-4 w-4 transition-transform duration-200 ${sortDir === 'asc' ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>
              {!listFilters ? (
                <p className="text-sm text-fg-subtle py-8 text-center">Loading…</p>
              ) : (
                <AnalysisPaymentList
                  payments={payments}
                  isPending={listPending}
                  isError={listError}
                  hasNextPage={Boolean(hasNextPage)}
                  isFetchingNextPage={isFetchingNextPage}
                  fetchNextPage={fetchNextPage}
                  scrollRoot={listScrollEl}
                  selectedPaymentId={selectedPayment?.payment_id ?? null}
                  onSelectPayment={setSelectedPayment}
                />
              )}
            </div>
          </div>
        </main>
      </div>
      {selectedPayment ? (
        <PaymentDetailsPanel
          payment={selectedPayment}
          onClose={() => setSelectedPayment(null)}
          onPaymentUpdate={(p) => setSelectedPayment(p)}
        />
      ) : null}
    </div>
  )
}
