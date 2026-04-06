import { createContext, useContext } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useScrapeSync, bankWaitLabel, type ScrapeParams, type ScrapeState } from '../hooks/useScrapeSync'

interface SyncContextValue {
  state: ScrapeState
  start: (params: ScrapeParams) => void
  cancel: () => void
  dismiss: () => void
}

const SyncCtx = createContext<SyncContextValue | null>(null)

export function useSyncContext() {
  const ctx = useContext(SyncCtx)
  if (!ctx) throw new Error('useSyncContext must be used within SyncProvider')
  return ctx
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const { state, start, cancel, dismiss } = useScrapeSync(() => {
    void queryClient.invalidateQueries({ queryKey: ['payments'] })
    void queryClient.invalidateQueries({ queryKey: ['payments', 'summary'] })
  })

  return <SyncCtx.Provider value={{ state, start, cancel, dismiss }}>{children}</SyncCtx.Provider>
}

export function SyncStatusBar() {
  const { state: sync, cancel, dismiss } = useSyncContext()

  if (sync.phase === 'idle') return null

  const completedCount = sync.progress?.current ?? 0
  const totalCount = sync.progress?.total ?? 0
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const xButton = (onClick: () => void, label: string) => (
    <button
      type="button"
      onClick={onClick}
      className="text-fg-subtle hover:text-fg-muted transition-colors p-1 rounded hover:bg-hover-surface"
      aria-label={label}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M2 2l8 8M10 2l-8 8" />
      </svg>
    </button>
  )

  return (
    <div
      className="fixed left-0 right-0 z-40 px-4"
      style={{ bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="max-w-lg mx-auto bg-surface rounded-2xl shadow-lg px-4 py-3 flex flex-col gap-2" style={{ border: '0.5px solid rgba(255,255,255,0.08)' }}>
        {sync.phase === 'running' && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium flex items-center gap-1.5">
                {sync.mode === 'quick' ? (
                  <span className="text-accent flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-accent animate-pulse" />
                    Syncing last 7 days…
                  </span>
                ) : sync.bankWait ? (
                  <span className="text-warning-fg">{bankWaitLabel(sync.bankWait)}</span>
                ) : (
                  <span className="text-accent flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-accent animate-pulse" />
                    {sync.progress?.month ? `Scraping ${sync.progress.month}` : 'Starting…'}
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                {sync.mode !== 'quick' && totalCount > 0 && (
                  <span className="text-xs text-fg-subtle">{completedCount}/{totalCount}</span>
                )}
                {xButton(cancel, 'Cancel sync')}
              </div>
            </div>
            {sync.mode !== 'quick' && totalCount > 0 && (
              <div className="h-1.5 bg-track rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    sync.bankWait ? 'bg-warning-fg opacity-90' : 'bg-accent-bar'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
          </>
        )}

        {sync.phase === 'done' && sync.summary && (
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-success-fg flex items-center gap-1.5">
              <span>✓</span>
              Synced {sync.summary.total_payments} transaction{sync.summary.total_payments === 1 ? '' : 's'}
              {sync.summary.months_scraped > 1 && ` across ${sync.summary.months_scraped} months`}
              {sync.summary.months_failed > 0 && (
                <span className="text-warning-fg ml-1">({sync.summary.months_failed} failed)</span>
              )}
            </span>
            {xButton(dismiss, 'Dismiss')}
          </div>
        )}

        {sync.phase === 'error' && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-danger-fg truncate">
              {sync.errorMsg || 'Sync failed'}
            </span>
            {xButton(dismiss, 'Dismiss')}
          </div>
        )}
      </div>
    </div>
  )
}
