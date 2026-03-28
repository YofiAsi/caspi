import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { logoutAndRefresh, type AuthContext } from './AuthGate'
import { ScrapeModal } from './ScrapeModal'

export function AppLayout({ auth }: { auth: AuthContext }) {
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [showScrapeModal, setShowScrapeModal] = useState(false)
  const queryClient = useQueryClient()

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
      <div className="h-screen flex flex-col bg-gray-50">
        <header
          className="shrink-0 bg-white border-b border-gray-200 px-4 sm:px-6 flex items-center justify-between gap-4 relative z-50"
          style={{ height: '73px' }}
        >
          <Link to="/" className="text-xl font-bold text-gray-900 tracking-tight hover:text-gray-700">
            Caspi
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowScrapeModal(true)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Sync transactions"
              title="Sync transactions"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setOptionsOpen((o) => !o)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
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
              className="fixed inset-x-0 top-[73px] bottom-0 z-40 bg-black/40"
              aria-label="Close options"
              onClick={() => setOptionsOpen(false)}
            />
            <div
              className="fixed top-[73px] right-0 bottom-0 z-50 w-72 max-w-[85vw] bg-white border-l border-gray-200 shadow-xl flex flex-col"
              role="dialog"
              aria-modal="true"
              aria-labelledby="options-drawer-title"
            >
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h2 id="options-drawer-title" className="text-sm font-semibold text-gray-900">
                  Options
                </h2>
                <button
                  type="button"
                  onClick={() => setOptionsOpen(false)}
                  className="p-1 rounded-lg text-gray-500 hover:bg-gray-100"
                  aria-label="Close"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <nav className="flex flex-col p-2 gap-1">
                <NavLink
                  to="/analysis"
                  onClick={() => setOptionsOpen(false)}
                  className={({ isActive }) =>
                    `px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                      isActive ? 'bg-indigo-100 text-indigo-900' : 'text-gray-700 hover:bg-gray-100'
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
                    className="text-left px-3 py-2.5 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-100"
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
