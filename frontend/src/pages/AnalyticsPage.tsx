import { useCallback, useMemo, useState } from 'react'
import { useInfiniteQuery, useQuery, keepPreviousData } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CollapsingHeader } from '../components/CollapsingHeader'
import { api } from '../api/client'
import { formatCurrency } from '../utils/currency'
import { formatCollectionDateRange } from '../utils/collectionDateRange'
import { AnalysisPaymentList } from '../components/analysis/AnalysisPaymentList'
import { SpendBarChart, type BarPeriodRow } from '../components/analysis/MonthlySpendBarChart'
import { TagCombinationPieChart, type SliceSelection } from '../components/analysis/TagCombinationPieChart'
import { TagFilterSelect } from '../components/analysis/TagFilterSelect'
import { PaymentDetailsPanel } from '../components/PaymentDetailsPanel'
import type { AnalyticsGranularity, Payment, PaymentFilters, PaymentListCursor, PaymentListSort } from '../types'
import { periodBounds, formatPeriodLabel, formatPeriodAxisLabel } from '../utils/periodBounds'

const PAGE_SIZE = 50

type Tab = 'routine' | 'collections'
type SortField = 'date' | 'price' | 'name'
type SortDir = 'asc' | 'desc'

const SORT_FIELDS: { value: SortField; label: string }[] = [
  { value: 'date', label: 'Time' },
  { value: 'price', label: 'Price' },
  { value: 'name', label: 'Name' },
]

const GRANULARITY_OPTIONS: { value: AnalyticsGranularity; label: string }[] = [
  { value: 'weekly', label: 'W' },
  { value: 'monthly', label: 'M' },
  { value: 'quarterly', label: 'Q' },
  { value: 'yearly', label: 'Y' },
  { value: 'lifetime', label: 'All' },
]

const BAR_SLOT_WIDTHS: Record<string, number> = {
  weekly: 40,
  monthly: 52,
  quarterly: 72,
  yearly: 88,
}

function toPaymentSort(field: SortField, dir: SortDir): PaymentListSort {
  if (field === 'date') return dir === 'asc' ? 'date_asc' : 'date_desc'
  if (field === 'price') return dir === 'asc' ? 'amount_asc' : 'amount_desc'
  return dir === 'asc' ? 'merchant_asc' : 'merchant_desc'
}

function buildListFilters(
  selectedTagId: string | null,
  selectedPeriod: string | null,
  granularity: AnalyticsGranularity,
  slice: SliceSelection,
  sort: PaymentListSort,
): PaymentFilters | null {
  if (granularity !== 'lifetime' && !selectedPeriod) return null
  const base: PaymentFilters = { currency: 'ILS', sort, includeTotals: true }
  if (granularity !== 'lifetime' && selectedPeriod) {
    const { dateFrom, dateTo } = periodBounds(selectedPeriod, granularity as Exclude<AnalyticsGranularity, 'lifetime'>)
    base.dateFrom = dateFrom
    base.dateTo = dateTo
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

/* ── Routine Sub-view ── */
function RoutineView({ scrollRoot }: { scrollRoot: HTMLDivElement | null }) {
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null)
  const [granularity, setGranularity] = useState<AnalyticsGranularity>('monthly')
  const [manualPeriod, setManualPeriod] = useState<string | null>(null)
  const [sliceSelection, setSliceSelection] = useState<SliceSelection>(null)
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const sort = toPaymentSort(sortField, sortDir)
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)

  const handleTagChange = (id: string | null) => { setSelectedTagId(id); setManualPeriod(null); setSliceSelection(null) }
  const handleGranularityChange = (g: AnalyticsGranularity) => { setGranularity(g); setManualPeriod(null); setSliceSelection(null) }

  const { data: tagsData } = useQuery({ queryKey: ['tags'], queryFn: () => api.tags.list(), staleTime: 120_000 })

  // Summary query (for top tags, totals in lifetime view)
  const { data: summary, isPending: summaryPending, isFetching: summaryFetching } = useQuery({
    queryKey: ['payments', 'summary', { tagId: selectedTagId }],
    queryFn: () => api.payments.summary(selectedTagId ? { includeTags: [selectedTagId] } : undefined),
    placeholderData: keepPreviousData,
  })

  // Timeseries query (not used for lifetime)
  const tsGranularity = granularity !== 'lifetime' ? granularity : null
  const { data: tsData, isPending: tsPending } = useQuery({
    queryKey: ['payments', 'timeseries', tsGranularity, selectedTagId],
    queryFn: () => api.payments.timeseries(
      tsGranularity! as 'weekly' | 'monthly' | 'quarterly' | 'yearly',
      selectedTagId ? { includeTags: [selectedTagId], currency: 'ILS' } : { currency: 'ILS' },
    ),
    enabled: tsGranularity !== null,
    placeholderData: keepPreviousData,
  })

  const barData: BarPeriodRow[] = useMemo(() => {
    if (!tsData?.rows) return []
    return tsData.rows
      .filter((r) => Number(r.sum_effective) > 0)
      .map((r) => ({
        periodKey: r.period_start,
        label: formatPeriodAxisLabel(r.period_start, granularity as Exclude<AnalyticsGranularity, 'lifetime'>),
        total: Number(r.sum_effective),
      }))
  }, [tsData, granularity])

  const defaultPeriod = useMemo(() => {
    if (!barData.length) return null
    return barData[barData.length - 1]?.periodKey ?? null
  }, [barData])

  const selectedPeriod = granularity === 'lifetime' ? null : (manualPeriod ?? defaultPeriod)

  const listFilters = useMemo(() => buildListFilters(selectedTagId, selectedPeriod, granularity, sliceSelection, sort), [selectedTagId, selectedPeriod, granularity, sliceSelection, sort])

  const { data: listData, isPending: listPending, isError: listError, isFetching: listFetching, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['payments', 'analysis', listFilters, sort],
    queryFn: ({ pageParam }) => api.payments.listPage(listFilters!, { limit: PAGE_SIZE, cursor: pageParam ?? undefined }),
    initialPageParam: null as PaymentListCursor | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: listFilters != null,
    placeholderData: keepPreviousData,
  })

  const payments = useMemo(() => listData?.pages.flatMap((p) => p.items) ?? [], [listData])
  const filterTotals = listData?.pages[0]?.filter_totals

  // Tag slices query
  const { data: slicesData } = useQuery({
    queryKey: ['payments', 'periodSlices', selectedPeriod, granularity, selectedTagId],
    queryFn: () => {
      if (!selectedTagId) throw new Error('unreachable')
      if (granularity === 'lifetime') {
        return api.payments.periodTagSlices({ dateFrom: '2000-01-01', dateTo: '2099-12-31', filterTagId: selectedTagId })
      }
      const bounds = periodBounds(selectedPeriod!, granularity as Exclude<AnalyticsGranularity, 'lifetime'>)
      return api.payments.periodTagSlices({ dateFrom: bounds.dateFrom, dateTo: bounds.dateTo, filterTagId: selectedTagId })
    },
    enabled: Boolean(selectedTagId && (selectedPeriod || granularity === 'lifetime')),
    placeholderData: keepPreviousData,
  })

  const isLoading = summaryPending || (granularity !== 'lifetime' && tsPending)
  const noIlsData = !isLoading && granularity !== 'lifetime' && barData.length === 0
  const panelOpen = selectedPayment !== null
  const hasPieSlices = Boolean(selectedTagId && (selectedPeriod || granularity === 'lifetime') && slicesData && slicesData.slices.length > 0)

  const currentPeriodRow = barData.find((r) => r.periodKey === selectedPeriod)

  // Lifetime totals
  const ilsTotal = useMemo(() => {
    const t = summary?.totals_by_currency?.find((c) => c.currency === 'ILS')
    return t ? Number(t.sum_effective) : 0
  }, [summary])

  // Top tags
  const topTags = useMemo(() => {
    const tags = (summary?.by_tag ?? [])
      .filter((t) => t.currency === 'ILS')
      .sort((a, b) => Number(b.sum_effective) - Number(a.sum_effective))
      .slice(0, 5)
    const max = tags.length > 0 ? Number(tags[0].sum_effective) : 1
    return tags.map((t) => ({ ...t, pct: (Number(t.sum_effective) / max) * 100 }))
  }, [summary?.by_tag])

  const periodLabel = granularity === 'lifetime'
    ? 'All time'
    : selectedPeriod
      ? formatPeriodLabel(selectedPeriod, granularity)
      : ''

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className={`flex-1 min-h-0 flex flex-col transition-[padding] duration-200 ${panelOpen ? 'md:pr-[352px]' : ''}`}>
        <div className="px-[18px] py-4 space-y-4">
          <TagFilterSelect id="analysis-tag" tags={tagsData?.tags ?? []} value={selectedTagId} onChange={handleTagChange} />

          {/* Granularity selector */}
          <div className="flex gap-1">
            {GRANULARITY_OPTIONS.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => handleGranularityChange(g.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  granularity === g.value ? 'bg-accent-soft text-accent-soft-fg' : 'text-fg-muted hover:bg-hover-surface'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          {isLoading && !summary ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 rounded-full border-2 border-ring border-t-transparent animate-spin" />
            </div>
          ) : (
            <>
              {/* Stats card */}
              {granularity === 'lifetime' ? (
                <div className={`transition-opacity duration-200 ${summaryFetching ? 'opacity-60' : ''}`}>
                  <div className="bg-surface rounded-[18px] p-4" style={{ border: '0.5px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-[10px] font-bold text-fg-subtle uppercase tracking-wider">All time</p>
                    <p className="text-[24px] font-[800] text-fg tracking-tight mt-1 leading-none">{formatCurrency(ilsTotal, 'ILS')}</p>
                    <p className="text-[11px] text-fg-muted mt-1">{summary?.payment_count ?? 0} expenses</p>
                  </div>
                </div>
              ) : selectedPeriod ? (
                <div className={`transition-opacity duration-200 ${(summaryFetching || listFetching) && !listPending ? 'opacity-60' : ''}`}>
                  <div className="bg-surface rounded-[18px] p-4" style={{ border: '0.5px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-[10px] font-bold text-fg-subtle uppercase tracking-wider">{periodLabel}</p>
                    <p className="text-[24px] font-[800] text-fg tracking-tight mt-1 leading-none">{formatCurrency(currentPeriodRow?.total ?? 0, 'ILS')}</p>
                    <p className="text-[11px] text-fg-muted mt-1">{filterTotals?.payment_count ?? 0} expenses</p>
                  </div>
                </div>
              ) : null}

              {/* Bar chart (hidden for lifetime) */}
              {granularity !== 'lifetime' && (
                noIlsData ? (
                  <p className="text-sm text-fg-subtle text-center py-8">No spending data found.</p>
                ) : barData.length > 0 ? (
                  <div className="bg-surface rounded-[18px] p-4" style={{ border: '0.5px solid rgba(255,255,255,0.06)' }}>
                    <SpendBarChart
                      rows={barData}
                      selectedPeriodKey={selectedPeriod}
                      onSelectPeriod={(key) => { setManualPeriod(key); setSliceSelection(null) }}
                      barSlotWidth={BAR_SLOT_WIDTHS[granularity] ?? 52}
                      barSize={granularity === 'weekly' ? 22 : 28}
                    />
                  </div>
                ) : null
              )}

              {/* Top tags */}
              {topTags.length > 0 && (
                <>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] font-bold text-fg-subtle uppercase tracking-wider">
                      Top tags
                    </span>
                  </div>
                  <div className="bg-surface rounded-[20px] overflow-hidden" style={{ border: '0.5px solid rgba(255,255,255,0.1)' }}>
                    {topTags.map((t) => (
                      <div key={t.tag_id} className="px-4 py-3" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[13px] font-semibold text-fg">{t.tag}</span>
                          <span className="text-[13px] font-bold text-fg">{formatCurrency(Number(t.sum_effective), 'ILS')}</span>
                        </div>
                        <div className="h-[3px] bg-muted rounded-full">
                          <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${t.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* Pie chart */}
          {!isLoading && selectedTagId && (selectedPeriod || granularity === 'lifetime') && slicesData && slicesData.slices.length === 0 ? (
            <p className="text-sm text-fg-subtle">No payments for this tag in the selected period.</p>
          ) : hasPieSlices ? (
            <div className="w-full min-w-0">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-[11px] font-bold text-fg-subtle uppercase tracking-wider">
                  Tag combinations {periodLabel ? `\u00B7 ${periodLabel}` : ''}
                </h3>
                {sliceSelection && (
                  <button type="button" onClick={() => setSliceSelection(null)} className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-accent-soft text-accent-soft-fg hover:opacity-80">
                    Filter active
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
              {slicesData ? <TagCombinationPieChart slices={slicesData.slices} selection={sliceSelection} onSelect={setSliceSelection} /> : null}
            </div>
          ) : null}

          {/* Payments list */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <h2 className="text-sm font-semibold text-fg">Payments</h2>
              <div className="flex items-center gap-1">
                {SORT_FIELDS.map((f) => (
                  <button key={f.value} type="button" onClick={() => setSortField(f.value)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${sortField === f.value ? 'bg-accent-soft text-accent-soft-fg' : 'text-fg-muted hover:bg-hover-surface'}`}>
                    {f.label}
                  </button>
                ))}
                <button type="button" onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  className="ml-1 flex items-center justify-center h-7 w-7 rounded-lg text-fg-muted hover:bg-hover-surface">
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform duration-200 ${sortDir === 'asc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>
            {!listFilters ? (
              <p className="text-sm text-fg-subtle py-8 text-center">{isLoading ? 'Loading...' : 'No spending data found yet.'}</p>
            ) : (
              <AnalysisPaymentList
                payments={payments}
                isPending={listPending}
                isError={listError}
                isFetching={listFetching}
                hasNextPage={Boolean(hasNextPage)}
                isFetchingNextPage={isFetchingNextPage}
                fetchNextPage={fetchNextPage}
                scrollRoot={scrollRoot}
                selectedPaymentId={selectedPayment?.payment_id ?? null}
                onSelectPayment={setSelectedPayment}
              />
            )}
          </div>
        </div>
      </div>
      {selectedPayment ? (
        <PaymentDetailsPanel payment={selectedPayment} onClose={() => setSelectedPayment(null)} onPaymentUpdate={(p) => setSelectedPayment(p)} />
      ) : null}
    </div>
  )
}

/* ── Collections Sub-view ── */
function CollectionsView() {
  const { data: collections = [], isPending, isError } = useQuery({
    queryKey: ['collections'],
    queryFn: () => api.collections.list(),
  })

  const sorted = useMemo(() => [...collections].sort((a, b) => Number(b.sum_effective) - Number(a.sum_effective)), [collections])
  const maxSum = sorted[0] ? Number(sorted[0].sum_effective) : 1

  return (
    <div className="px-[18px] py-4 space-y-4">
      {isPending ? (
        <div className="flex justify-center py-12"><div className="h-6 w-6 rounded-full border-2 border-ring border-t-transparent animate-spin" /></div>
      ) : isError ? (
        <p className="text-sm text-danger-text text-center py-12">Failed to load collections.</p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-fg-subtle text-center py-12">No collections yet.</p>
      ) : (
        <>
          {/* Section header */}
          <div className="pt-0.5">
            <span className="text-[11px] font-bold text-fg-subtle uppercase tracking-wider">Your collections</span>
          </div>

          {/* Collection cards */}
          {sorted.map((c) => (
            <Link
              key={c.id}
              to={`/collections/${c.id}`}
              className="block bg-surface rounded-[18px] p-4 transition-colors hover:border-border-2"
              style={{ border: '0.5px solid rgba(255,255,255,0.06)' }}
            >
              <div className="flex justify-between items-start">
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-fg tracking-tight">{c.name}</p>
                  <p className="text-[11px] text-fg-muted mt-1">
                    {formatCollectionDateRange(c.first_payment_date, c.last_payment_date)} &middot; {c.payment_count} expense{c.payment_count !== 1 ? 's' : ''}
                  </p>
                </div>
                <p className="text-[17px] font-[800] text-fg tracking-tight shrink-0 ml-3">
                  {formatCurrency(Number(c.sum_effective), 'ILS')}
                </p>
              </div>
              <div className="h-[2px] bg-muted rounded-full mt-3.5">
                <div className="h-full bg-accent rounded-full opacity-60 transition-all duration-500" style={{ width: `${(Number(c.sum_effective) / maxSum) * 100}%` }} />
              </div>
            </Link>
          ))}
        </>
      )}
    </div>
  )
}

/* ── Main Analytics Page ── */
export function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('routine')
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null)
  const setScrollRef = useCallback((el: HTMLDivElement | null) => { setScrollEl(el) }, [])

  const analyticsHeader = (
    <>
      <div className="px-5 pt-5">
        <h1 className="text-[28px] font-[800] text-fg tracking-tight">Analytics</h1>
      </div>
      <div className="mx-[18px] mt-3.5 mb-1 bg-surface rounded-[14px] p-[3px] flex" style={{ border: '0.5px solid rgba(255,255,255,0.1)' }}>
        {(['routine', 'collections'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 text-center py-2 text-[13px] font-semibold rounded-[12px] transition-all capitalize ${
              tab === t ? 'bg-muted text-fg' : 'text-fg-muted'
            }`}
            style={tab === t ? { border: '0.5px solid rgba(255,255,255,0.1)' } : undefined}
          >
            {t}
          </button>
        ))}
      </div>
    </>
  )

  return (
    <div className="h-full min-h-0 flex flex-col animate-fadeUp">
      <CollapsingHeader header={analyticsHeader} className="flex-1" scrollRef={setScrollRef}>
        <div key={tab} className="animate-fadeIn">
          {tab === 'routine' ? <RoutineView scrollRoot={scrollEl} /> : <CollectionsView />}
        </div>
      </CollapsingHeader>
    </div>
  )
}
