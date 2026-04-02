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
import { monthBounds, parseYearMonth } from '../utils/monthBounds'

const PAGE_SIZE = 50

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

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div
        className={`flex-1 min-h-0 flex flex-col transition-[padding] duration-200 ${panelOpen ? 'md:pr-[352px]' : ''}`}
      >
        <main className="flex-1 overflow-hidden max-w-5xl w-full mx-auto bg-surface sm:my-4 sm:rounded-2xl sm:shadow-sm sm:border sm:border-border flex flex-col">
          <div className="border-b border-border px-4 py-4 space-y-4 shrink-0">
            <h1 className="text-lg font-semibold text-fg">Monthly breakdown</h1>
            <div className="flex flex-wrap items-end gap-4">
              <TagFilterSelect
                id="analysis-tag"
                tags={tagsData?.tags ?? []}
                value={selectedTagId}
                onChange={handleTagChange}
              />
              <div className="flex flex-col gap-1">
                <label htmlFor="analysis-sort" className="text-xs font-medium text-fg-muted">
                  Sort payments
                </label>
                <select
                  id="analysis-sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as PaymentListSort)}
                  className="h-10 px-3 text-sm border border-border rounded-lg bg-input-bg text-fg focus:outline-none focus:ring-2 focus:ring-ring min-w-[200px]"
                >
                  <option value="date_desc">Newest first</option>
                  <option value="date_asc">Oldest first</option>
                  <option value="amount_desc">Amount high → low</option>
                  <option value="amount_asc">Amount low → high</option>
                  <option value="merchant_asc">Merchant A–Z</option>
                  <option value="merchant_desc">Merchant Z–A</option>
                </select>
              </div>
            </div>
          </div>

          <div ref={setListScrollEl} className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-6">
            {summaryPending ? (
              <div className="flex justify-center py-12">
                <div className="h-6 w-6 rounded-full border-2 border-ring border-t-transparent animate-spin" />
              </div>
            ) : noIlsData ? (
              <p className="text-sm text-fg-subtle text-center py-8">
                No ILS payment data for this tag selection yet.
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

            {!selectedTagId ? (
              <p className="text-sm text-fg-muted">
                Select a tag to see how spending splits across tag combinations for a month.
              </p>
            ) : !selectedYm ? null : slicesData && slicesData.slices.length === 0 ? (
              <p className="text-sm text-fg-subtle">No payments for this tag in the selected month.</p>
            ) : slicesData && slicesData.slices.length > 0 ? (
              <TagCombinationPieChart
                slices={slicesData.slices}
                selection={sliceSelection}
                onSelect={setSliceSelection}
              />
            ) : null}

            {selectedYm && filterTotals ? (
              <MonthSummaryStrip
                yearMonth={selectedYm}
                paymentCount={filterTotals.payment_count}
                sumEffective={Number(filterTotals.sum_effective)}
              />
            ) : null}

            <div>
              <h2 className="text-sm font-semibold text-fg mb-2">Payments</h2>
              {!listFilters ? (
                <p className="text-sm text-fg-subtle py-8 text-center">
                  {summaryPending ? 'Loading…' : 'No ILS months to list yet.'}
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
