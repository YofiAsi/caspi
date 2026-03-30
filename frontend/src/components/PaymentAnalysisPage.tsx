import * as Tabs from '@radix-ui/react-tabs'
import type { MutableRefObject } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { useAnalysisPresets } from '../hooks/useAnalysisPresets'
import type { AnalysisPreset } from '../lib/analysisPresetsStorage'
import { getCurrentMonthValue, getMonthBounds } from '../lib/monthBounds'
import type { PaymentFilters, TagSummaryRow } from '../types'
import { TagChip } from './TagChip'

type TagSortKey = 'tag' | 'sum' | 'count'
type SortDir = 'asc' | 'desc'

function parseSum(s: string): number {
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

function formatMoney(amount: string, currency: string): string {
  const n = parseSum(amount)
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(n)
  } catch {
    return `${n.toFixed(2)} ${currency}`
  }
}

function emptyFilters(bounds: Pick<PaymentFilters, 'dateFrom' | 'dateTo'>): PaymentFilters {
  return {
    dateFrom: bounds.dateFrom,
    dateTo: bounds.dateTo,
    taggedOnly: false,
  }
}

function AnalysisPresetBody({
  preset,
  draftMirrorRef,
  appliedMirrorRef,
}: {
  preset: AnalysisPreset
  draftMirrorRef: MutableRefObject<PaymentFilters | null>
  appliedMirrorRef: MutableRefObject<PaymentFilters | null>
}) {
  const [draft, setDraft] = useState<PaymentFilters>(() => ({ ...preset.filters }))
  const [applied, setApplied] = useState<PaymentFilters>(() => ({ ...preset.filters }))
  const [includeInput, setIncludeInput] = useState(() => (preset.filters.includeTags ?? []).join(', '))
  const [excludeInput, setExcludeInput] = useState(() => (preset.filters.excludeTags ?? []).join(', '))
  const [tagSortKey, setTagSortKey] = useState<TagSortKey>('sum')
  const [tagSortDir, setTagSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    draftMirrorRef.current = draft
    appliedMirrorRef.current = applied
  }, [draft, applied, draftMirrorRef, appliedMirrorRef])

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['payments', 'summary', applied],
    queryFn: () => api.payments.summary(applied),
    staleTime: 30_000,
  })

  const tagsQuery = useQuery({
    queryKey: ['tags'],
    queryFn: () => api.tags.list(),
    staleTime: 120_000,
  })

  const applyTagInputsToDraft = () => {
    const includeTags = includeInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
    const excludeTags = excludeInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
    setDraft((prev) => ({
      ...prev,
      includeTags: includeTags.length > 0 ? includeTags : undefined,
      excludeTags: excludeTags.length > 0 ? excludeTags : undefined,
    }))
  }

  const handleApply = () => {
    const includeTags = includeInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
    const excludeTags = excludeInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
    const next: PaymentFilters = {
      ...draft,
      includeTags: includeTags.length > 0 ? includeTags : undefined,
      excludeTags: excludeTags.length > 0 ? excludeTags : undefined,
    }
    setDraft(next)
    setApplied(next)
  }

  const handleResetToMonth = () => {
    const base = emptyFilters(getMonthBounds(getCurrentMonthValue()))
    setDraft(base)
    setApplied(base)
    setIncludeInput('')
    setExcludeInput('')
  }

  const byTagRows = data?.by_tag
  const sortedByTag = useMemo(() => {
    if (!byTagRows?.length) return []
    const rows = [...byTagRows]
    const dir = tagSortDir === 'asc' ? 1 : -1
    rows.sort((a, b) => {
      if (tagSortKey === 'tag') {
        return a.tag.localeCompare(b.tag) * dir
      }
      if (tagSortKey === 'count') {
        const c = (a.payment_count - b.payment_count) * dir
        return c !== 0 ? c : a.tag.localeCompare(b.tag)
      }
      const diff = (parseSum(a.sum_effective) - parseSum(b.sum_effective)) * dir
      return diff !== 0 ? diff : a.tag.localeCompare(b.tag)
    })
    return rows
  }, [byTagRows, tagSortKey, tagSortDir])

  const toggleTagSort = (key: TagSortKey) => {
    if (tagSortKey === key) {
      setTagSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setTagSortKey(key)
      setTagSortDir(key === 'tag' ? 'asc' : 'desc')
    }
  }

  const primaryTotal = data?.totals_by_currency[0]
  const datalistId = `analysis-tags-${preset.id}`

  return (
    <div className="shrink-0 rounded-2xl border border-border bg-surface shadow-sm overflow-hidden flex flex-col mb-4">
      <div className="px-4 py-3 border-b border-border space-y-3 bg-muted">
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">From</label>
            <input
              type="date"
              value={draft.dateFrom ?? ''}
              onChange={(e) => setDraft((p) => ({ ...p, dateFrom: e.target.value || undefined }))}
              className="text-xs border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring bg-input-bg text-fg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">To</label>
            <input
              type="date"
              value={draft.dateTo ?? ''}
              onChange={(e) => setDraft((p) => ({ ...p, dateTo: e.target.value || undefined }))}
              className="text-xs border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring bg-input-bg text-fg"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-fg-secondary cursor-pointer pb-0.5">
            <input
              type="checkbox"
              checked={!!draft.taggedOnly}
              onChange={(e) => setDraft((p) => ({ ...p, taggedOnly: e.target.checked }))}
              className="rounded border-checkbox-border text-accent focus:ring-ring"
            />
            Only tagged payments
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-fg-muted mb-1">Include tags (all required)</label>
            <input
              type="text"
              list={datalistId}
              value={includeInput}
              onChange={(e) => setIncludeInput(e.target.value)}
              onBlur={applyTagInputsToDraft}
              placeholder="food, travel"
              className="w-full text-xs border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring bg-input-bg text-fg"
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-fg-muted mb-1">Exclude tags</label>
            <input
              type="text"
              list={datalistId}
              value={excludeInput}
              onChange={(e) => setExcludeInput(e.target.value)}
              onBlur={applyTagInputsToDraft}
              placeholder="work"
              className="w-full text-xs border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring bg-input-bg text-fg"
            />
          </div>
        </div>
        <datalist id={datalistId}>
          {(tagsQuery.data?.tags ?? []).map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleApply}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-accent text-on-primary hover:bg-accent-hover"
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={handleResetToMonth}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border text-fg-secondary hover:bg-hover-surface"
          >
            Reset to this month
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 max-h-[calc(100vh-280px)]">
        {isLoading && <p className="text-sm text-fg-muted">Loading summary…</p>}
        {isError && (
          <p className="text-sm text-danger-text">{error instanceof Error ? error.message : 'Failed to load summary'}</p>
        )}
        {data && !isLoading && (
          <>
            <div className="flex flex-wrap gap-4">
              <div className="rounded-xl border border-border bg-surface px-4 py-3 min-w-[140px]">
                <p className="text-xs text-fg-muted">Payments</p>
                <p className="text-xl font-semibold text-fg">{data.payment_count}</p>
              </div>
              {primaryTotal && (
                <div className="rounded-xl border border-border bg-surface px-4 py-3 min-w-[180px]">
                  <p className="text-xs text-fg-muted">Total ({primaryTotal.currency})</p>
                  <p className="text-xl font-semibold text-fg">
                    {formatMoney(primaryTotal.sum_effective, primaryTotal.currency)}
                  </p>
                </div>
              )}
            </div>

            {data.totals_by_currency.length > 1 && (
              <section>
                <h3 className="text-sm font-semibold text-fg-secondary mb-2">By currency</h3>
                <ul className="text-sm text-fg-secondary space-y-1">
                  {data.totals_by_currency.map((t) => (
                    <li key={t.currency}>
                      {t.currency}: {formatMoney(t.sum_effective, t.currency)} effective,{' '}
                      {formatMoney(t.sum_amount, t.currency)} amount
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {data.untagged_by_currency.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-fg-secondary mb-2">Untagged</h3>
                <ul className="text-sm text-fg-secondary space-y-1">
                  {data.untagged_by_currency.map((u) => (
                    <li key={u.currency}>
                      {u.currency}: {u.payment_count} payments, {formatMoney(u.sum_effective, u.currency)}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h3 className="text-sm font-semibold text-fg-secondary mb-1">By tag</h3>
              <p className="text-xs text-fg-muted mb-2">
                Payments with multiple tags count toward each tag; column sums can exceed the overall total.
              </p>
              {sortedByTag.length === 0 ? (
                <p className="text-sm text-fg-muted">No tagged payments in this range.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted text-fg-muted">
                      <tr>
                        <th className="px-3 py-2">
                          <button type="button" className="font-medium hover:text-accent" onClick={() => toggleTagSort('tag')}>
                            Tag {tagSortKey === 'tag' ? (tagSortDir === 'asc' ? '↑' : '↓') : ''}
                          </button>
                        </th>
                        <th className="px-3 py-2">Currency</th>
                        <th className="px-3 py-2 text-right">
                          <button type="button" className="font-medium hover:text-accent" onClick={() => toggleTagSort('sum')}>
                            Sum {tagSortKey === 'sum' ? (tagSortDir === 'asc' ? '↑' : '↓') : ''}
                          </button>
                        </th>
                        <th className="px-3 py-2 text-right">
                          <button type="button" className="font-medium hover:text-accent" onClick={() => toggleTagSort('count')}>
                            Count {tagSortKey === 'count' ? (tagSortDir === 'asc' ? '↑' : '↓') : ''}
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {sortedByTag.map((row: TagSummaryRow) => (
                        <tr key={`${row.tag}-${row.currency}`} className="bg-surface">
                          <td className="px-3 py-2">
                            <TagChip tag={row.tag} className="px-2 py-0.5 text-xs" />
                          </td>
                          <td className="px-3 py-2 text-fg-muted">{row.currency}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatMoney(row.sum_effective, row.currency)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.payment_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold text-fg-secondary mb-2">By payment type</h3>
              {data.by_payment_type.length === 0 ? (
                <p className="text-sm text-fg-muted">None</p>
              ) : (
                <ul className="text-sm text-fg-secondary space-y-1">
                  {data.by_payment_type.map((r) => (
                    <li key={`${r.payment_type}-${r.currency}`}>
                      {r.payment_type} ({r.currency}): {r.payment_count} · {formatMoney(r.sum_effective, r.currency)}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold text-fg-secondary mb-2">Top merchants</h3>
              {data.top_merchants.length === 0 ? (
                <p className="text-sm text-fg-muted">None</p>
              ) : (
                <ul className="text-sm text-fg-secondary space-y-1">
                  {data.top_merchants.map((r, i) => (
                    <li key={`${r.display_name}-${r.currency}-${i}`}>
                      {r.display_name} ({r.currency}): {r.payment_count} · {formatMoney(r.sum_effective, r.currency)}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold text-fg-secondary mb-2">By month</h3>
              {data.by_month.length === 0 ? (
                <p className="text-sm text-fg-muted">None</p>
              ) : (
                <ul className="text-sm text-fg-secondary space-y-2">
                  {data.by_month.map((m) => {
                    const maxSum = Math.max(...data.by_month.map((x) => parseSum(x.sum_effective)), 1)
                    const w = (parseSum(m.sum_effective) / maxSum) * 100
                    return (
                      <li key={`${m.year}-${m.month}-${m.currency}`}>
                        <div className="flex justify-between gap-2 mb-0.5">
                          <span>
                            {m.year}-{String(m.month).padStart(2, '0')} ({m.currency})
                          </span>
                          <span className="tabular-nums text-fg-muted">
                            {m.payment_count} · {formatMoney(m.sum_effective, m.currency)}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-track overflow-hidden">
                          <div className="h-full rounded-full bg-accent-bar" style={{ width: `${w}%` }} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}

export function PaymentAnalysisPage() {
  const { presets, updatePresetFilters, addPreset, renamePreset, deletePreset } = useAnalysisPresets()
  const [searchParams, setSearchParams] = useSearchParams()
  const draftMirrorRef = useRef<PaymentFilters | null>(null)
  const appliedMirrorRef = useRef<PaymentFilters | null>(null)

  const activeId = useMemo(() => {
    const viewParam = searchParams.get('view')
    if (viewParam && presets.some((p) => p.id === viewParam)) return viewParam
    return presets[0]?.id ?? ''
  }, [searchParams, presets])

  useEffect(() => {
    if (!activeId) return
    if (searchParams.get('view') !== activeId) {
      setSearchParams({ view: activeId }, { replace: true })
    }
  }, [activeId, searchParams, setSearchParams])

  const activePreset = presets.find((p) => p.id === activeId)

  const handleSavePreset = () => {
    if (!activeId) return
    const d = draftMirrorRef.current
    if (d) updatePresetFilters(activeId, d)
  }

  const handleNewView = () => {
    const f = appliedMirrorRef.current ?? activePreset?.filters
    if (!f) return
    const id = addPreset(f)
    setSearchParams({ view: id }, { replace: true })
  }

  const handleRename = () => {
    if (!activePreset) return
    const name = window.prompt('View name', activePreset.name)
    if (name !== null) renamePreset(activeId, name)
  }

  const handleDelete = () => {
    if (presets.length <= 1) return
    const remaining = presets.filter((p) => p.id !== activeId)
    const nextId = remaining[0]?.id
    deletePreset(activeId)
    if (nextId) setSearchParams({ view: nextId }, { replace: true })
  }

  const onTabChange = (value: string) => {
    setSearchParams({ view: value }, { replace: true })
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-y-auto bg-canvas">
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-6 flex flex-col min-h-0">
        <h1 className="text-lg font-semibold text-fg mb-4">Analysis</h1>
        <Tabs.Root value={activeId} onValueChange={onTabChange} className="flex flex-col flex-1 min-h-0">
          <div className="flex flex-wrap items-center gap-2 gap-y-2 mb-4">
            <Tabs.List className="flex flex-wrap gap-1 min-w-0 border border-border rounded-xl p-1 bg-surface">
              {presets.map((p) => (
                <Tabs.Trigger
                  key={p.id}
                  value={p.id}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg text-fg-muted data-[state=active]:bg-accent-nav data-[state=active]:text-accent-nav-fg data-[state=active]:shadow-sm hover:bg-hover-surface outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {p.name}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={handleNewView}
                className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border bg-surface text-fg-secondary hover:bg-hover-surface"
              >
                + New view
              </button>
              <button
                type="button"
                onClick={handleRename}
                disabled={!activePreset}
                className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border bg-surface text-fg-secondary hover:bg-hover-surface disabled:opacity-50"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={presets.length <= 1}
                className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border bg-surface text-danger-text hover:bg-danger-bg disabled:opacity-50"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={handleSavePreset}
                disabled={!activeId}
                className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-accent text-on-primary hover:bg-accent-hover disabled:opacity-50"
              >
                Save view
              </button>
            </div>
          </div>

          <Tabs.Content value={activeId} className="flex-1 min-h-0 outline-none flex flex-col data-[state=inactive]:hidden">
            {activePreset ? (
              <AnalysisPresetBody
                key={activePreset.id}
                preset={activePreset}
                draftMirrorRef={draftMirrorRef}
                appliedMirrorRef={appliedMirrorRef}
              />
            ) : null}
          </Tabs.Content>
        </Tabs.Root>
      </main>
    </div>
  )
}
