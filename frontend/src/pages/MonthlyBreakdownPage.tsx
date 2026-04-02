import * as Popover from '@radix-ui/react-popover'
import { useMemo, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { AnalysisPaymentList } from '../components/analysis/AnalysisPaymentList'
import { MonthSummaryStrip } from '../components/analysis/MonthSummaryStrip'
import { MonthlySpendBarChart, type BarMonthRow } from '../components/analysis/MonthlySpendBarChart'
import {
  TagCombinationPieChart,
  type SliceSelection,
} from '../components/analysis/TagCombinationPieChart'
import { TagFilterSelect } from '../components/analysis/TagFilterSelect'
import { PaymentDetailsPanel } from '../components/PaymentDetailsPanel'
import { api } from '../api/client'
import type { Payment, PaymentFilters, PaymentListCursor, PaymentListSort } from '../types'
import { monthBounds, parseYearMonth, formatYearMonthLabel } from '../utils/monthBounds'

const PAGE_SIZE = 50

const SORT_OPTIONS: { value: PaymentListSort; label: string }[] = [
  { value: 'date_desc', label: 'Newest first' },
  { value: 'date_asc', label: 'Oldest first' },
  { value: 'amount_desc', label: 'Amount high → low' },
  { value: 'amount_asc', label: 'Amount low → high' },
  { value: 'merchant_asc', label: 'Merchant A–Z' },
  { value: 'merchant_desc', label: 'Merchant Z–A' },
]

function buildListFilters(
  selectedTagId: string | null,
  selectedYm: string | null,
  slice: SliceSelection,
  sort: PaymentListSort,
): PaymentFilters | null {
  if (!selectedYm) return null
  const { year, month } = parseYearMonth(selectedYm)
  const { start, end } = monthBounds(year, month)
  const base: PaymentFilters = {
    dateFrom: start,
    dateTo: end,
    currency: 'ILS',
    sort,
    includeTotals: true,
  }
  if (selectedTagId) {
    base.includeTags = [selectedTagId]
    if (slice?.kind === 'exact') {
      base.applyTagSlice = true
      base.filterTagId = selectedTagId
      base.otherTagIds = [...slice.otherTagIds].sort()
    }
  }
  return base
}

function ilsBarDataFromSummary(
  byMonth: { year: number; month: number; currency: string; sum_effective: string }[],
): BarMonthRow[] {
  const m = new Map<string, { year: number; month: number; total: number }>()
  for (const r of byMonth) {
    if (r.currency !== 'ILS') continue
    const ym = `${r.year}-${String(r.month).padStart(2, '0')}`
    const prev = m.get(ym)?.total ?? 0
    m.set(ym, {
      year: r.year,
      month: r.month,
      total: prev + Number(r.sum_effective),
    })
  }
  return [...m.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, v]) => ({ ym, year: v.year, month: v.month, total: v.total }))
}

export function MonthlyBreakdownPage() {
  const [listScrollEl, setListScrollEl] = useState<HTMLDivElement | null>(null)
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null)
  const [manualMonthYm, setManualMonthYm] = useState<string | null>(null)
  const [sliceSelection, setSliceSelection] = useState<SliceSelection>(null)
  const [sort, setSort] = useState<PaymentListSort>('date_desc')
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)

  const handleTagChange = (id: string | null) => {
    setSelectedTagId(id)
    setManualMonthYm(null)
    setSliceSelection(null)
  }

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => api.tags.list(),
    staleTime: 120_000,
  })

  const { data: summary, isPending: summaryPending } = useQuery({
    queryKey: ['payments', 'summary', { tagId: selectedTagId }],
    queryFn: () =>
      api.payments.summary(
        selectedTagId ? { includeTags: [selectedTagId] } : undefined,
      ),
  })

  const barData = useMemo(
    () => ilsBarDataFromSummary(summary?.by_month ?? []),
    [summary?.by_month],
  )

  const defaultMonthYm = useMemo(() => {
    if (!barData.length) return null
    const withSpend = barData.filter((r) => r.total > 0)
    const pick = withSpend.length ? withSpend[withSpend.length - 1] : barData[barData.length - 1]
    return pick?.ym ?? null
  }, [barData])

  const selectedYm = manualMonthYm ?? defaultMonthYm

  const listFilters = useMemo(
    () => buildListFilters(selectedTagId, selectedYm, sliceSelection, sort),
    [selectedTagId, selectedYm, sliceSelection, sort],
  )

  const {
    data: listData,
    isPending: listPending,
    isError: listError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['payments', 'analysis', listFilters, sort],
    queryFn: ({ pageParam }) =>
      api.payments.listPage(listFilters!, {
        limit: PAGE_SIZE,
        cursor: pageParam ?? undefined,
      }),
    initialPageParam: null as PaymentListCursor | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: listFilters != null,
  })

  const payments = useMemo(
    () => listData?.pages.flatMap((p) => p.items) ?? [],
    [listData],
  )

  const filterTotals = listData?.pages[0]?.filter_totals

  const ymParts = selectedYm ? parseYearMonth(selectedYm) : null
  const { data: slicesData } = useQuery({
    queryKey: ['payments', 'monthSlices', ymParts?.year, ymParts?.month, selectedTagId],
    queryFn: () =>
      api.payments.monthTagSlices({
        year: ymParts!.year,
        month: ymParts!.month,
        filterTagId: selectedTagId!,
      }),
    enabled: Boolean(selectedTagId && selectedYm && ymParts),
  })

  const noIlsData = !summaryPending && barData.length === 0
  const panelOpen = selectedPayment !== null
  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Sort'

  const hasPieSlices = Boolean(selectedTagId && selectedYm && slicesData && slicesData.slices.length > 0)

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div
        className={`flex-1 min-h-0 flex flex-col transition-[padding] duration-200 ${panelOpen ? 'md:pr-[352px]' : ''}`}
      >
        <main className="flex-1 overflow-hidden max-w-5xl w-full mx-auto bg-surface sm:my-4 sm:rounded-2xl sm:shadow-sm sm:border sm:border-border flex flex-col">
          <div ref={setListScrollEl} className="flex-1 overflow-y-auto min-h-0 px-4 py-4 pb-8 space-y-5">
            {summaryPending ? (
              <div className="flex justify-center py-12">
                <div className="h-6 w-6 rounded-full border-2 border-ring border-t-transparent animate-spin" />
              </div>
            ) : (
              <>
                {/* Tag filter chips */}
                <TagFilterSelect
                  id="analysis-tag"
                  tags={tagsData?.tags ?? []}
                  value={selectedTagId}
                  onChange={handleTagChange}
                />

                {/* Bar chart */}
                {noIlsData ? (
                  <p className="text-sm text-fg-subtle text-center py-8">
                    No spending data found for this tag selection.
                  </p>
                ) : (
                  <MonthlySpendBarChart
                    rows={barData}
                    selectedYm={selectedYm}
                    onSelectMonth={(ym) => {
                      setManualMonthYm(ym)
                      setSliceSelection(null)
                    }}
                  />
                )}
              </>
            )}

            {/* Month hero card */}
            {selectedYm && filterTotals ? (
              <MonthSummaryStrip
                yearMonth={selectedYm}
                paymentCount={filterTotals.payment_count}
                sumEffective={Number(filterTotals.sum_effective)}
              />
            ) : null}

            {/* Pie chart section */}
            {!summaryPending && selectedTagId && selectedYm && slicesData && slicesData.slices.length === 0 ? (
              <p className="text-sm text-fg-subtle">No payments for this tag in the selected month.</p>
            ) : hasPieSlices ? (
              <div className="w-full min-w-0">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wide">
                    Tag combinations · {selectedYm ? formatYearMonthLabel(selectedYm, 'en-GB') : ''}
                  </h3>
                  {sliceSelection && (
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
                  )}
                </div>
                {slicesData ? (
                  <TagCombinationPieChart
                    slices={slicesData.slices}
                    selection={sliceSelection}
                    onSelect={setSliceSelection}
                  />
                ) : null}
              </div>
            ) : null}

            {/* Payments list */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <h2 className="text-sm font-semibold text-fg">Payments</h2>
                <Popover.Root open={sortMenuOpen} onOpenChange={setSortMenuOpen}>
                  <Popover.Trigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-fg-muted hover:text-fg-secondary hover:bg-hover-surface transition-colors shrink-0"
                      aria-label="Sort payments"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                        />
                      </svg>
                      {currentSortLabel}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-3.5 w-3.5 shrink-0 transition-transform ${sortMenuOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content
                      className="z-[100] w-56 rounded-lg border border-border bg-surface p-1 shadow-lg"
                      sideOffset={6}
                      align="end"
                    >
                      <p className="px-2 py-1.5 text-xs font-medium text-fg-muted">Sort by</p>
                      <ul className="flex flex-col gap-0.5">
                        {SORT_OPTIONS.map((opt) => (
                          <li key={opt.value}>
                            <button
                              type="button"
                              onClick={() => {
                                setSort(opt.value)
                                setSortMenuOpen(false)
                              }}
                              className={`w-full text-left text-sm px-2 py-2 rounded-md transition-colors ${
                                sort === opt.value
                                  ? 'bg-accent-soft text-accent-soft-fg font-medium'
                                  : 'text-fg hover:bg-hover-surface'
                              }`}
                            >
                              {opt.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
              </div>
              {!listFilters ? (
                <p className="text-sm text-fg-subtle py-8 text-center">
                  {summaryPending ? 'Loading…' : 'No spending data found yet.'}
                </p>
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
