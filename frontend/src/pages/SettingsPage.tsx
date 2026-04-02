import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { logoutAndRefresh, type AuthContext } from '../components/AuthGate'
import { ScrapeModal } from '../components/ScrapeModal'

const THEME_OPTIONS = ['light', 'dark', 'system'] as const

export function SettingsPage({ auth }: { auth: AuthContext }) {
  const { theme, setTheme } = useTheme()
  const [showScrapeModal, setShowScrapeModal] = useState(false)
  const queryClient = useQueryClient()

  return (
    <>
      <div className="flex-1 overflow-y-auto min-h-0">
        <main className="max-w-lg w-full mx-auto px-4 py-6 flex flex-col gap-6">

          <section>
            <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">
              Appearance
            </h2>
            <div className="bg-surface rounded-2xl border border-border p-4">
              <p className="text-sm text-fg-secondary mb-3">Theme</p>
              <div className="flex rounded-lg border border-border p-0.5 gap-0.5" role="group" aria-label="Theme">
                {THEME_OPTIONS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTheme(k)}
                    className={`flex-1 px-2 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${
                      theme === k ? 'bg-accent-soft text-accent-soft-fg' : 'text-fg-muted hover:bg-hover-surface'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">
              Data
            </h2>
            <div className="bg-surface rounded-2xl border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setShowScrapeModal(true)}
                className="w-full flex items-center justify-between px-4 py-3.5 text-sm text-fg-secondary hover:bg-hover-surface transition-colors"
              >
                <span>Sync transactions</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-fg-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </section>

          {auth.authRequired && auth.email ? (
            <section>
              <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">
                Account
              </h2>
              <div className="bg-surface rounded-2xl border border-border overflow-hidden">
                <div className="px-4 py-3.5 text-sm text-fg-muted border-b border-border">
                  {auth.email}
                </div>
                <button
                  type="button"
                  onClick={() => void logoutAndRefresh(auth)}
                  className="w-full text-left px-4 py-3.5 text-sm font-medium text-red-500 hover:bg-hover-surface transition-colors"
                >
                  Sign out
                </button>
              </div>
            </section>
          ) : null}

        </main>
      </div>

      {showScrapeModal && (
        <ScrapeModal
          onClose={() => setShowScrapeModal(false)}
          onSyncComplete={() => {
            void queryClient.invalidateQueries({ queryKey: ['payments'] })
            void queryClient.invalidateQueries({ queryKey: ['payments', 'summary'] })
          }}
        />
      )}
    </>
  )
}
