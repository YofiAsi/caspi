import { useState } from 'react'
import { useTheme } from 'next-themes'
import { useAppAuth } from '../components/AppLayout'
import { logoutAndRefresh } from '../components/AuthGate'
import { CollapsingHeader } from '../components/CollapsingHeader'
import { ScrapeModal } from '../components/ScrapeModal'
import { useSyncContext } from '../contexts/SyncContext'
import { bankWaitLabel } from '../hooks/useScrapeSync'

const THEME_OPTIONS = ['light', 'dark', 'system'] as const

export function SettingsPage() {
  const auth = useAppAuth()
  const { theme, setTheme } = useTheme()
  const [showScrapeModal, setShowScrapeModal] = useState(false)
  const { state: sync, start: startSync, cancel: cancelSync, dismiss: dismissSync } = useSyncContext()

  const userName = auth.email?.split('@')[0] ?? 'User'
  const completedCount = sync.progress?.current ?? 0
  const totalCount = sync.progress?.total ?? 0
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const initial = userName.charAt(0).toUpperCase()

  return (
    <>
      <CollapsingHeader
        header={<div className="px-5 pt-5 pb-1"><h1 className="text-[28px] font-[800] text-fg tracking-tight">Settings</h1></div>}
        className="flex-1 min-h-0 animate-fadeUp"
      >
        <div className="max-w-lg w-full mx-auto px-5 pt-3 pb-8">

          {/* Profile card */}
          {auth.authRequired && auth.email && (
            <div className="bg-surface rounded-[20px] p-[18px] flex items-center gap-3.5 mb-5" style={{ border: '0.5px solid rgba(255,255,255,0.06)' }}>
              <div className="w-[52px] h-[52px] rounded-2xl bg-accent flex items-center justify-center text-[22px] font-[900] text-on-primary shrink-0">
                {initial}
              </div>
              <div>
                <p className="text-[17px] font-bold text-fg tracking-tight">{userName}</p>
                <p className="text-[12px] text-fg-muted mt-0.5">{auth.email}</p>
              </div>
            </div>
          )}

          {/* Appearance */}
          <div className="mb-5">
            <p className="text-[11px] font-bold text-fg-subtle uppercase tracking-wider mb-2 px-0.5">Appearance</p>
            <div className="bg-surface rounded-[18px] overflow-hidden" style={{ border: '0.5px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-8 h-8 rounded-[9px] bg-muted flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-fg-muted">
                    <circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
                  </svg>
                </div>
                <span className="flex-1 text-[14px] text-fg">Theme</span>
                <div className="flex rounded-lg p-0.5 gap-0.5 bg-muted" role="group" aria-label="Theme">
                  {THEME_OPTIONS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setTheme(k)}
                      className={`px-2.5 py-1 text-[12px] font-medium rounded-md capitalize transition-colors ${
                        theme === k ? 'bg-accent-soft text-accent-soft-fg' : 'text-fg-muted hover:text-fg-secondary'
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Data */}
          <div className="mb-5">
            <p className="text-[11px] font-bold text-fg-subtle uppercase tracking-wider mb-2 px-0.5">Data</p>
            <div className="bg-surface rounded-[18px] overflow-hidden" style={{ border: '0.5px solid rgba(255,255,255,0.06)' }}>
              <button
                type="button"
                onClick={() => setShowScrapeModal(true)}
                disabled={sync.phase === 'running'}
                className={`w-full flex items-center gap-3 px-4 py-3.5 transition-colors ${
                  sync.phase === 'running' ? 'opacity-40 pointer-events-none' : 'hover:bg-hover-surface'
                }`}
              >
                <div className="w-8 h-8 rounded-[9px] bg-muted flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-fg-muted">
                    <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="flex-1 text-left text-[14px] text-fg">Sync transactions</span>
                <svg className="text-fg-subtle opacity-25" width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M1 1L6 6L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>

              {/* Inline sync progress */}
              {sync.phase === 'running' && (
                <div className="px-4 pb-3.5 pt-0 flex flex-col gap-2 border-t border-border-subtle">
                  <div className="flex items-center justify-between pt-3">
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
                      <button
                        type="button"
                        onClick={cancelSync}
                        className="text-fg-subtle hover:text-fg-muted transition-colors p-0.5 rounded hover:bg-hover-surface"
                        aria-label="Cancel sync"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M2 2l8 8M10 2l-8 8" />
                        </svg>
                      </button>
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
                </div>
              )}

              {/* Sync done */}
              {sync.phase === 'done' && sync.summary && (
                <div className="px-4 pb-3.5 pt-0 border-t border-border-subtle">
                  <div className="flex items-center justify-between pt-3">
                    <span className="text-xs font-medium text-success-fg flex items-center gap-1.5">
                      <span>✓</span>
                      Synced {sync.summary.total_payments} transaction{sync.summary.total_payments === 1 ? '' : 's'}
                      {sync.summary.months_scraped > 1 && ` across ${sync.summary.months_scraped} months`}
                      {sync.summary.months_failed > 0 && (
                        <span className="text-warning-fg ml-1">({sync.summary.months_failed} failed)</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={dismissSync}
                      className="text-fg-subtle hover:text-fg-muted transition-colors p-0.5 rounded hover:bg-hover-surface"
                      aria-label="Dismiss"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M2 2l8 8M10 2l-8 8" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Sync error */}
              {sync.phase === 'error' && (
                <div className="px-4 pb-3.5 pt-0 border-t border-border-subtle">
                  <div className="flex items-center justify-between pt-3 gap-2">
                    <span className="text-xs text-danger-fg truncate">
                      {sync.errorMsg || 'Sync failed'}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => { dismissSync(); setShowScrapeModal(true) }}
                        className="text-xs text-accent font-medium hover:underline"
                      >
                        Retry
                      </button>
                      <button
                        type="button"
                        onClick={dismissSync}
                        className="text-fg-subtle hover:text-fg-muted transition-colors p-0.5 rounded hover:bg-hover-surface"
                        aria-label="Dismiss"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M2 2l8 8M10 2l-8 8" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Account */}
          {auth.authRequired && auth.email && (
            <div className="mb-5">
              <p className="text-[11px] font-bold text-fg-subtle uppercase tracking-wider mb-2 px-0.5">Account</p>
              <div className="bg-surface rounded-[18px] overflow-hidden" style={{ border: '0.5px solid rgba(255,255,255,0.06)' }}>
                <button
                  type="button"
                  onClick={() => void logoutAndRefresh(auth)}
                  className="w-full text-left px-4 py-3.5 text-[14px] font-medium text-danger-fg hover:bg-hover-surface transition-colors"
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </CollapsingHeader>

      {showScrapeModal && (
        <ScrapeModal
          onClose={() => setShowScrapeModal(false)}
          onStart={(params) => {
            setShowScrapeModal(false)
            startSync(params)
          }}
        />
      )}
    </>
  )
}
