import { useEffect, useRef, useState } from 'react'
import type { TagItem } from '../../types'

interface Props {
  tags: TagItem[]
  value: string | null
  onChange: (tagId: string | null) => void
  id?: string
}

export function TagFilterSelect({ tags, value, onChange }: Props) {
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (searching) inputRef.current?.focus()
  }, [searching])

  const closeSearch = () => {
    setSearching(false)
    setQuery('')
  }

  const handleSelect = (tagId: string | null) => {
    onChange(tagId === value ? null : tagId)
    if (tagId !== null) closeSearch()
  }

  const visibleTags = query.trim()
    ? tags.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()))
    : tags

  if (searching) {
    return (
      <div>
        <div className="flex items-center gap-2 -mx-4 px-4">
          <div className="flex-1 flex items-center gap-2 h-9 px-3 rounded-full border border-accent bg-surface ring-2 ring-accent/20">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5 shrink-0 text-fg-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && closeSearch()}
              placeholder="Search tags…"
              className="flex-1 bg-transparent text-sm text-fg placeholder:text-fg-subtle outline-none min-w-0"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="shrink-0 text-fg-subtle hover:text-fg transition-colors"
                aria-label="Clear"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={closeSearch}
            className="shrink-0 text-sm font-medium text-fg-muted hover:text-fg transition-colors"
          >
            Cancel
          </button>
        </div>

        {visibleTags.length > 0 ? (
          <ul className="mt-2 rounded-xl border border-border bg-surface shadow-md overflow-hidden">
            <li>
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-hover-surface ${
                  value === null ? 'text-accent font-semibold' : 'text-fg'
                }`}
              >
                All payments
              </button>
            </li>
            {visibleTags.map((tag) => (
              <li key={tag.id} className="border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => handleSelect(tag.id)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-hover-surface ${
                    value === tag.id ? 'text-accent font-semibold' : 'text-fg'
                  }`}
                >
                  {tag.name}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-fg-subtle text-center py-3">No tags match "{query}"</p>
        )}
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      role="group"
      aria-label="Filter by tag"
    >
      <button
        type="button"
        onClick={() => setSearching(true)}
        className="shrink-0 flex items-center justify-center h-7 w-7 rounded-full text-fg-subtle hover:text-fg hover:bg-hover-surface transition-colors"
        aria-label="Search tags"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <circle cx="11" cy="11" r="8" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
          value === null
            ? 'bg-accent text-white font-semibold'
            : 'border border-border bg-surface text-fg-secondary hover:bg-hover-surface'
        }`}
      >
        All
      </button>
      {tags.map((tag) => (
        <button
          key={tag.id}
          type="button"
          onClick={() => onChange(tag.id === value ? null : tag.id)}
          className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
            value === tag.id
              ? 'bg-accent text-white font-semibold'
              : 'border border-border bg-surface text-fg-secondary hover:bg-hover-surface'
          }`}
        >
          {tag.name}
        </button>
      ))}
    </div>
  )
}
