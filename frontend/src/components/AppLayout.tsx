import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { type AuthContext } from './AuthGate'
import { BottomNav } from './BottomNav'

function getFullscreenElement(): Element | null {
  const d = document as Document & { webkitFullscreenElement?: Element | null }
  return document.fullscreenElement ?? d.webkitFullscreenElement ?? null
}

const TITLE_MAP: Record<string, string> = {
  '/': 'Caspi',
  '/analysis': 'Breakdown',
  '/collections': 'Collections',
  '/settings': 'Settings',
}

function headerTitle(pathname: string): string {
  if (pathname.startsWith('/collections/')) return 'Collection'
  return TITLE_MAP[pathname] ?? 'Caspi'
}

export function AppLayout({ auth: _auth }: { auth: AuthContext }) {
  const { pathname } = useLocation()
  const [fullscreenActive, setFullscreenActive] = useState(false)
  const [fullscreenSupported, setFullscreenSupported] = useState(false)
  const [headerVisible, setHeaderVisible] = useState(true)
  const lastScrollY = useRef(0)

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
    const handleScroll = (e: Event) => {
      if (window.innerWidth >= 768) {
        setHeaderVisible(true)
        return
      }
      const target = e.target as HTMLElement
      const currentY = target.scrollTop ?? 0
      const delta = currentY - lastScrollY.current
      lastScrollY.current = currentY
      if (delta > 4) {
        setHeaderVisible(false)
      } else if (delta < -4) {
        setHeaderVisible(true)
      }
    }
    const handleResize = () => {
      if (window.innerWidth >= 768) setHeaderVisible(true)
    }
    window.addEventListener('scroll', handleScroll, { capture: true })
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true })
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const headerOffset = headerVisible ? 0 : -60

  return (
    <div className="h-screen flex flex-col bg-canvas">
      <header
        className="fixed top-0 left-0 right-0 bg-surface border-b border-border px-4 sm:px-6 flex items-center justify-between gap-4 z-50"
        style={{ height: '60px', transform: `translateY(${headerOffset}px)`, transition: 'transform 0.25s ease' }}
      >
        <Link
          to="/"
          className="flex items-center gap-2 text-xl font-bold text-fg tracking-tight hover:text-fg-secondary transition-colors shrink-0 min-w-0"
        >
          <img src="/favicon.png" alt="" className="h-8 w-8 shrink-0 object-contain" aria-hidden />
          <span className="truncate">
            {headerTitle(pathname)}
          </span>
        </Link>
        <div className="flex items-center gap-2">
          {fullscreenSupported ? (
            <button
              type="button"
              onClick={toggleFullscreen}
              className="md:hidden p-1.5 rounded-lg text-fg-subtle hover:text-fg-secondary hover:bg-hover-surface transition-colors"
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
        </div>
      </header>

      <div
        className="flex-1 min-h-0 flex flex-col overflow-hidden"
        style={{
          paddingTop: `${60 + headerOffset}px`,
          paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
          transition: 'padding-top 0.25s ease',
        }}
      >
        <Outlet />
      </div>

      <BottomNav />
    </div>
  )
}
