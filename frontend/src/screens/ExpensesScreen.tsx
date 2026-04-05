import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { expensesApi } from '../api/expenses'
import type { ExpenseOut } from '../api/types'
import ExpenseList from '../components/shared/ExpenseList'
import SearchBar from '../components/shared/SearchBar'
import FilterChips from '../components/shared/FilterChips'
import EmptyState from '../components/shared/EmptyState'
import TaggingSheet from '../components/expenses/TaggingSheet'
import FullScreenSpinner from '../components/shared/FullScreenSpinner'

type Filter = 'all' | 'untagged' | 'routine' | 'in-collection' | 'this-month'

const FILTER_CHIPS = [
  { value: 'all' as Filter, label: 'All' },
  { value: 'untagged' as Filter, label: 'Untagged' },
  { value: 'routine' as Filter, label: 'Routine' },
  { value: 'in-collection' as Filter, label: 'In collection' },
  { value: 'this-month' as Filter, label: 'This month' },
]

function buildFilters(filter: Filter) {
  const now = new Date()
  switch (filter) {
    case 'untagged': return { untagged: true }
    case 'routine': return { collection_id: 'none' }
    case 'in-collection': return { collection_id: 'has' } // handled below
    case 'this-month': return {
      start_date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
      end_date: now.toISOString().slice(0, 10),
    }
    default: return {}
  }
}

export default function ExpensesScreen() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [taggingExpenses, setTaggingExpenses] = useState<ExpenseOut[] | null>(null)

  const filters = {
    ...buildFilters(filter),
    limit: 200,
    sort: '-date' as const,
  }

  const queryKey = ['expenses', filters]
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => expensesApi.list(filters),
  })

  const allExpenses = data?.items ?? []

  const displayed = search.trim()
    ? allExpenses.filter(e => {
        const q = search.toLowerCase()
        return (
          (e.merchant.alias ?? e.merchant.canonical_name).toLowerCase().includes(q) ||
          e.tags.some(t => t.name.toLowerCase().includes(q)) ||
          e.merchant_tags.some(t => t.name.toLowerCase().includes(q))
        )
      })
    : allExpenses

  function handleTap(expense: ExpenseOut) {
    if (isMultiSelectMode) {
      toggleSelect(expense.id)
    } else {
      setTaggingExpenses([expense])
    }
  }

  function handleLongPress(expense: ExpenseOut) {
    if (!isMultiSelectMode) {
      setIsMultiSelectMode(true)
      setSelectedIds(new Set([expense.id]))
    }
  }

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      if (next.size === 0) setIsMultiSelectMode(false)
      return next
    })
  }, [])

  function exitMultiSelect() {
    setIsMultiSelectMode(false)
    setSelectedIds(new Set())
  }

  function openBulkTag() {
    const selected = allExpenses.filter(e => selectedIds.has(e.id))
    setTaggingExpenses(selected)
  }

  const bulkMerchantIds = new Set(
    taggingExpenses?.map(e => e.merchant.id) ?? []
  )
  const bulkSingleMerchant = bulkMerchantIds.size === 1 && taggingExpenses
    ? taggingExpenses[0].merchant
    : null

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="bg-white px-4 pt-6 pb-3">
        {isMultiSelectMode ? (
          <div className="flex items-center justify-between">
            <button type="button" onClick={exitMultiSelect} className="text-sm text-zinc-600">
              Cancel
            </button>
            <span className="text-sm font-semibold text-zinc-900">
              {selectedIds.size} selected
            </span>
            <button
              type="button"
              onClick={openBulkTag}
              disabled={selectedIds.size === 0}
              className="text-sm font-semibold text-violet-700 disabled:opacity-40"
            >
              Tag
            </button>
          </div>
        ) : (
          <h1 className="text-xl font-bold text-zinc-900">Expenses</h1>
        )}
      </header>

      {/* Search + filters */}
      {!isMultiSelectMode && (
        <div className="bg-white px-4 pb-3 flex flex-col gap-2">
          <SearchBar value={search} onChange={setSearch} placeholder="Search expenses…" />
          <FilterChips chips={FILTER_CHIPS} active={filter} onChange={setFilter} />
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <FullScreenSpinner />
        ) : displayed.length > 0 ? (
          <ExpenseList
            expenses={displayed}
            selectedIds={selectedIds}
            isMultiSelectMode={isMultiSelectMode}
            onTap={handleTap}
            onLongPress={handleLongPress}
          />
        ) : (
          <EmptyState
            message="No expenses"
            detail={search ? 'Try a different search' : undefined}
          />
        )}
      </div>

      {/* Tagging sheet */}
      {taggingExpenses && (
        <TaggingSheet
          expenseIds={taggingExpenses.map(e => e.id)}
          merchant={bulkSingleMerchant ?? (taggingExpenses.length === 1 ? taggingExpenses[0].merchant : null)}
          existingTags={taggingExpenses.length === 1 ? taggingExpenses[0].tags : []}
          existingCollection={taggingExpenses.length === 1 ? taggingExpenses[0].collection : null}
          onClose={() => setTaggingExpenses(null)}
          onSaved={() => {
            setTaggingExpenses(null)
            exitMultiSelect()
            queryClient.invalidateQueries({ queryKey: ['expenses'] })
          }}
        />
      )}
    </div>
  )
}
