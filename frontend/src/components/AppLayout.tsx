import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { logoutAndRefresh, type AuthContext } from './AuthGate'
import { ScrapeModal } from './ScrapeModal'

function getFullscreenElement(): Element | null {
  const d = document as Document & { webkitFullscreenElement?: Element | null }
  return document.fullscreenElement ?? d.webkitFullscreenElement ?? null
}

const THEME_OPTIONS = ['light', 'dark', 'system'] as const

export function AppLayout({ auth }: { auth: AuthContext }) {
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [showScrapeModal, setShowScrapeModal] = useState(false)
  const [fullscreenActive, setFullscreenActive] = useState(false)
  const [fullscreenSupported, setFullscreenSupported] = useState(false)
  const queryClient = useQueryClient()
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    const el = document.documentElement as HTMLElement & {
      requestFullscreen?: () => Promise<void>
      webkitRequestFullscreen?: () => void
    }
    setFullscreenSupported(
      typeof el.requestFullscreen === 'function' || typeof el.webkitRequestFullscreen === 'function',
    )
  }, [])

  useEffect(() => {
    const sync = () => setFullscreenActive(!!getFullscreenElement())
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('webkitfullscreenchange', sync)
    sync()
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      document.removeEventListener('webkitfullscreenchange', sync)
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> }
    const root = document.documentElement as HTMLElement & {
      requestFullscreen?: () => Promise<void>
      webkitRequestFullscreen?: () => void
    }
    if (getFullscreenElement()) {
      if (document.exitFullscreen) {
        void document.exitFullscreen()
      } else {
        void doc.webkitExitFullscreen?.()
      }
      return
    }
    if (root.requestFullscreen) {
      void root.requestFullscreen().catch(() => {})
    } else {
      root.webkitRequestFullscreen?.()
    }
  }, [])

  useEffect(() => {
    if (!optionsOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOptionsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [optionsOpen])

  return (
    <>
      <div className="h-screen flex flex-col bg-canvas">
        <header
          className="shrink-0 bg-surface border-b border-border px-4 sm:px-6 flex items-center justify-between gap-4 relative z-50"
          style={{ height: '60px' }}
        >
          <Link
            to="/"
            className="flex items-center gap-2 text-xl font-bold text-fg tracking-tight hover:text-fg-secondary transition-colors"
          >
            <img src="/favicon.png" alt="" className="h-8 w-8 shrink-0 object-contain" aria-hidden />
            Caspi
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowScrapeModal(true)}
              className="p-1.5 rounded-lg text-fg-subtle hover:text-fg-secondary hover:bg-hover-surface transition-colors"
              aria-label="Sync transactions"
              title="Sync transactions"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            {fullscreenSupported ? (
              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-1.5 rounded-lg text-fg-subtle hover:text-fg-secondary hover:bg-hover-surface transition-colors"
                aria-label={fullscreenActive ? 'Exit fullscreen' : 'Enter fullscreen'}
                aria-pressed={fullscreenActive}
                title={fullscreenActive ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {fullscreenActive ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  </svg>
                )}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setOptionsOpen((o) => !o)}
              className="p-1.5 rounded-lg text-fg-subtle hover:text-fg-secondary hover:bg-hover-surface transition-colors"
              aria-label="Options"
              aria-expanded={optionsOpen}
              aria-haspopup="true"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <Outlet />
        </div>

        {optionsOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-x-0 top-[60px] bottom-0 z-40 bg-scrim"
              aria-label="Close options"
              onClick={() => setOptionsOpen(false)}
            />
            <div
              className="fixed top-[60px] right-0 bottom-0 z-50 w-72 max-w-[85vw] bg-surface border-l border-border shadow-xl flex flex-col"
              role="dialog"
              aria-modal="true"
              aria-labelledby="options-drawer-title"
            >
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h2 id="options-drawer-title" className="text-sm font-semibold text-fg">
                  Options
                </h2>
                <button
                  type="button"
                  onClick={() => setOptionsOpen(false)}
                  className="p-1 rounded-lg text-fg-muted hover:bg-hover-surface"
                  aria-label="Close"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs font-medium text-fg-muted mb-2">Appearance</p>
                <div className="flex rounded-lg border border-border p-0.5 gap-0.5" role="group" aria-label="Theme">
                  {THEME_OPTIONS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setTheme(k)}
                      className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                        theme === k ? 'bg-accent-soft text-accent-soft-fg' : 'text-fg-muted hover:bg-hover-surface'
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
              <nav className="flex flex-col p-2 gap-1">
                <NavLink
                  to="/analysis"
                  onClick={() => setOptionsOpen(false)}
                  className={({ isActive }) =>
                    `px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                      isActive ? 'bg-accent-nav text-accent-nav-fg' : 'text-fg-secondary hover:bg-hover-surface'
                    }`
                  }
                >
                  Analysis
                </NavLink>
                {auth.authRequired && auth.email ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOptionsOpen(false)
                      void logoutAndRefresh(auth)
                    }}
                    className="text-left px-3 py-2.5 text-sm font-medium rounded-lg text-fg-secondary hover:bg-hover-surface"
                  >
                    Sign out
                  </button>
                ) : null}
              </nav>
            </div>
          </>
        ) : null}
      </div>
      {showScrapeModal && (
        <ScrapeModal
          onClose={() => setShowScrapeModal(false)}
          onSyncComplete={() => queryClient.invalidateQueries({ queryKey: ['payments'] })}
        />
      )}
    </>
  )
}
