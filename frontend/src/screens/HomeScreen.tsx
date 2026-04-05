import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '../api/analytics'
import { expensesApi } from '../api/expenses'
import type { ExpenseOut } from '../api/types'
import ExpenseList from '../components/shared/ExpenseList'
import EmptyState from '../components/shared/EmptyState'
import TaggingSheet from '../components/expenses/TaggingSheet'

function currentMonthRange() {
  const now = new Date()
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const end = now.toISOString().slice(0, 10)
  return { start, end }
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

export default function HomeScreen() {
  const { start, end } = currentMonthRange()
  const [taggingExpense, setTaggingExpense] = useState<ExpenseOut | null>(null)

  const { data: monthly } = useQuery({
    queryKey: ['analytics', 'routine', 'monthly', start, end],
    queryFn: () => analyticsApi.routineMonthly(start, end),
  })

  const { data: untagged } = useQuery({
    queryKey: ['expenses', { untagged: true, limit: 10 }],
    queryFn: () => expensesApi.list({ untagged: true, limit: 10 }),
  })

  const { data: recent } = useQuery({
    queryKey: ['expenses', { limit: 20, sort: '-date' }],
    queryFn: () => expensesApi.list({ limit: 20, sort: '-date' }),
  })

  const currentMonth = monthly?.months[0]
  const untaggedItems = untagged?.items ?? []
  const recentItems = recent?.items ?? []

  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <header className="bg-white px-4 pt-6 pb-4">
        <h1 className="text-xl font-bold text-zinc-900">Caspi</h1>
        <p className="text-sm text-zinc-500">
          {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>
      </header>

      {/* Monthly summary card */}
      {currentMonth && (
        <div className="mx-4 mb-4 rounded-2xl bg-zinc-900 p-5 text-white">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">This month</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">
            {fmtCurrency(currentMonth.total_personal)}
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            {currentMonth.expense_count} expense{currentMonth.expense_count !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Needs attention */}
      {untaggedItems.length > 0 && (
        <section className="mb-4">
          <div className="mb-2 flex items-center justify-between px-4">
            <h2 className="text-sm font-semibold text-zinc-900">Needs attention</h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              {untagged?.total ?? 0} untagged
            </span>
          </div>
          <div className="divide-y divide-zinc-100 rounded-2xl bg-white mx-4 overflow-hidden">
            <ExpenseList
              expenses={untaggedItems}
              selectedIds={new Set()}
              isMultiSelectMode={false}
              onTap={e => setTaggingExpense(e)}
              onLongPress={() => {}}
            />
          </div>
        </section>
      )}

      {/* Recent expenses */}
      <section>
        <h2 className="mb-2 px-4 text-sm font-semibold text-zinc-900">Recent</h2>
        {recentItems.length > 0 ? (
          <ExpenseList
            expenses={recentItems}
            selectedIds={new Set()}
            isMultiSelectMode={false}
            onTap={e => setTaggingExpense(e)}
            onLongPress={() => {}}
          />
        ) : (
          <EmptyState message="No expenses yet" />
        )}
      </section>

      {taggingExpense && (
        <TaggingSheet
          expenseIds={[taggingExpense.id]}
          merchant={taggingExpense.merchant}
          existingTags={taggingExpense.tags}
          existingCollection={taggingExpense.collection}
          onClose={() => setTaggingExpense(null)}
          onSaved={() => setTaggingExpense(null)}
        />
      )}
    </div>
  )
}
