import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { formatCollectionDateRange } from '../utils/collectionDateRange'

type SortMode = 'spend' | 'name'
type NameDir = 'asc' | 'desc'

export function CollectionsPage() {
  const [sortMode, setSortMode] = useState<SortMode>('spend')
  const [nameDir, setNameDir] = useState<NameDir>('asc')

  const { data: collections = [], isPending, isError } = useQuery({
    queryKey: ['collections'],
    queryFn: () => api.collections.list(),
  })

  const sorted = useMemo(() => {
    const list = [...collections]
    if (sortMode === 'spend') {
      list.sort((a, b) => Number(b.sum_effective) - Number(a.sum_effective))
    } else {
      const m = nameDir === 'asc' ? 1 : -1
      list.sort((a, b) => m * a.name.localeCompare(b.name))
    }
    return list
  }, [collections, sortMode, nameDir])

  return (
    <div className="h-full min-h-0 flex flex-col">
      <main className="flex-1 overflow-hidden max-w-5xl w-full mx-auto bg-surface sm:my-4 sm:rounded-2xl sm:shadow-md sm:shadow-black/5 dark:sm:shadow-black/20 sm:border sm:border-border flex flex-col">
        <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-fg-muted uppercase tracking-wide">Sort</span>
            <button
              type="button"
              onClick={() => setSortMode('spend')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                sortMode === 'spend'
                  ? 'bg-accent-soft text-accent-soft-fg'
                  : 'text-fg-muted hover:bg-hover-surface'
              }`}
            >
              Total spend
            </button>
            <button
              type="button"
              onClick={() => setSortMode('name')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                sortMode === 'name'
                  ? 'bg-accent-soft text-accent-soft-fg'
                  : 'text-fg-muted hover:bg-hover-surface'
              }`}
            >
              Name
            </button>
            {sortMode === 'name' ? (
              <button
                type="button"
                onClick={() => setNameDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                className="ml-1 flex items-center justify-center h-7 w-7 rounded-lg text-fg-muted hover:bg-hover-surface transition-colors"
                aria-label={nameDir === 'asc' ? 'Ascending' : 'Descending'}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-4 w-4 transition-transform duration-200 ${nameDir === 'asc' ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            ) : null}
          </div>

          {isPending ? (
            <div className="flex justify-center py-16">
              <div className="h-6 w-6 rounded-full border-2 border-ring border-t-transparent animate-spin" />
            </div>
          ) : isError ? (
            <p className="text-sm text-danger-text text-center py-12">Failed to load collections.</p>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-fg-subtle text-center py-12">No collections yet.</p>
          ) : (
            <ul className="divide-y divide-border-subtle rounded-xl border border-border-subtle overflow-hidden">
              {sorted.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/collections/${c.id}`}
                    className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-4 py-3 hover:bg-hover-surface transition-colors"
                  >
                    <span className="font-semibold text-fg flex-1 min-w-0 truncate">{c.name}</span>
                    <span className="text-sm text-fg-secondary shrink-0">
                      {formatCollectionDateRange(c.first_payment_date, c.last_payment_date)}
                    </span>
                    <span className="text-sm font-medium text-fg shrink-0">
                      ₪{Number(c.sum_effective).toLocaleString('en-IL', { maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-xs text-fg-muted shrink-0">
                      {c.payment_count} payment{c.payment_count === 1 ? '' : 's'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}
