import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { collectionsApi } from '../api/collections'
import { expensesApi } from '../api/expenses'
import type { ExpenseOut } from '../api/types'
import BackHeader from '../components/shared/BackHeader'
import ExpenseList from '../components/shared/ExpenseList'
import EmptyState from '../components/shared/EmptyState'
import TaggingSheet from '../components/expenses/TaggingSheet'

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

export default function CollectionDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [taggingExpense, setTaggingExpense] = useState<ExpenseOut | null>(null)

  const { data: detail } = useQuery({
    queryKey: ['collections', id],
    queryFn: () => collectionsApi.get(id!),
    enabled: !!id,
  })

  const { data: expenses } = useQuery({
    queryKey: ['expenses', { collection_id: id }],
    queryFn: () => expensesApi.list({ collection_id: id, sort: '-date', limit: 200 }),
    enabled: !!id,
  })

  const items = expenses?.items ?? []
  const maxTagTotal = Math.max(...(detail?.stats.by_tag.map(t => t.total) ?? [1]), 1)

  return (
    <div className="flex h-full flex-col bg-zinc-50">
      <BackHeader title={detail?.name ?? 'Collection'} />

      <div className="flex-1 overflow-y-auto">
        {/* Stats */}
        {detail && (
          <div className="px-4 py-4 flex flex-col gap-4">
            <div className="flex gap-3">
              <div className="flex-1 rounded-2xl bg-white p-4">
                <p className="text-xs text-zinc-400">Total</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-zinc-900">
                  {fmtCurrency(detail.stats.total_personal)}
                </p>
              </div>
              <div className="flex-1 rounded-2xl bg-white p-4">
                <p className="text-xs text-zinc-400">Expenses</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-zinc-900">
                  {detail.stats.expense_count}
                </p>
              </div>
            </div>

            {detail.stats.by_tag.length > 0 && (
              <div className="rounded-2xl bg-white p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">By tag</p>
                <div className="flex flex-col gap-3">
                  {detail.stats.by_tag.map(t => (
                    <div key={t.tag} className="flex flex-col gap-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-zinc-800">{t.tag}</span>
                        <span className="tabular-nums text-zinc-600">{fmtCurrency(t.total)}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-2 rounded-full bg-violet-500"
                          style={{ width: `${(t.total / maxTagTotal) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Expenses */}
        <div className="px-0">
          {items.length > 0 ? (
            <ExpenseList
              expenses={items}
              selectedIds={new Set()}
              isMultiSelectMode={false}
              onTap={e => setTaggingExpense(e)}
              onLongPress={() => {}}
            />
          ) : (
            <EmptyState message="No expenses in this collection" />
          )}
        </div>
      </div>

      {taggingExpense && (
        <TaggingSheet
          expenseIds={[taggingExpense.id]}
          merchant={taggingExpense.merchant}
          existingTags={taggingExpense.tags}
          existingCollection={taggingExpense.collection}
          onClose={() => setTaggingExpense(null)}
          onSaved={() => {
            setTaggingExpense(null)
            queryClient.invalidateQueries({ queryKey: ['expenses', { collection_id: id }] })
            queryClient.invalidateQueries({ queryKey: ['collections', id] })
          }}
        />
      )}
    </div>
  )
}
