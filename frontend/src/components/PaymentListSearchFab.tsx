import { useCallback, useEffect, useState } from 'react'

const DEBOUNCE_MS = 250

interface Props {
  searchQ: string | undefined
  onSearchQChange: (q: string | undefined) => void
}

export function PaymentListSearchFab({ searchQ, onSearchQChange }: Props) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState(() => searchQ ?? '')

  useEffect(() => {
    if (open) {
      setInput(searchQ ?? '')
    }
  }, [open, searchQ])

  useEffect(() => {
    const qTrim = input.trim()
    const nextQ = qTrim || undefined
    const t = window.setTimeout(() => {
      onSearchQChange(nextQ)
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [input, onSearchQChange])

  const clear = useCallback(() => {
    setInput('')
    onSearchQChange(undefined)
  }, [onSearchQChange])

  const panelId = 'payment-list-search-panel'

  return (
    <div className="fixed bottom-6 left-6 z-30 flex flex-col items-start gap-2 pointer-events-none [&>*]:pointer-events-auto">
      {open ? (
        <div
          id={panelId}
          className="w-[min(100vw-3rem,18rem)] rounded-xl border border-border bg-surface p-3 shadow-lg transition-opacity duration-200"
        >
          <label htmlFor="payment-list-search-q" className="block text-xs font-medium text-fg-muted mb-1.5">
            Filter by name or tags
          </label>
          <div className="flex gap-2">
            <input
              id="payment-list-search-q"
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search…"
              autoComplete="off"
              className="flex-1 min-w-0 text-sm border border-border rounded-lg px-2.5 py-2 bg-input-bg text-fg focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {input.trim() ? (
              <button
                type="button"
                onClick={clear}
                className="shrink-0 text-xs font-medium text-fg-muted hover:text-fg px-2 py-2"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-on-primary shadow-lg hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-canvas transition-colors"
        title={open ? 'Close search' : 'Search and filter list'}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6"
          aria-hidden
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </button>
    </div>
  )
}
