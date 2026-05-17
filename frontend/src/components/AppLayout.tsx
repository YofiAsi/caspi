import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { SyncProvider } from '../contexts/SyncContext'
import { useSplitwiseStatus } from '../hooks/useSplitwise'
import { SplitwiseFailedDrawer } from './SplitwiseFailedDrawer'

function SplitwiseBanner() {
  const { data: status } = useSplitwiseStatus({ refetchInterval: 60_000 })
  const [showDrawer, setShowDrawer] = useState(false)

  if (!status?.connected || status.failed === 0) return null

  return (
    <>
      <div className="shrink-0 bg-warning-bg border-b border-warning-border px-4 py-2 flex items-center justify-between gap-2">
        <p className="text-xs text-warning-fg">
          {status.failed} Splitwise push{status.failed === 1 ? '' : 'es'} failed
        </p>
        <button
          type="button"
          onClick={() => setShowDrawer(true)}
          className="text-xs font-medium text-warning-fg underline hover:opacity-80 transition-opacity shrink-0"
        >
          Review
        </button>
      </div>
      {showDrawer && <SplitwiseFailedDrawer onClose={() => setShowDrawer(false)} />}
    </>
  )
}

export function AppLayout() {
  return (
    <SyncProvider>
      <div className="h-screen flex flex-col bg-canvas">
        <SplitwiseBanner />
        <div
          className="flex-1 min-h-0 flex flex-col overflow-hidden"
          style={{ paddingBottom: 'calc(88px + env(safe-area-inset-bottom, 0px))' }}
        >
          <Outlet />
        </div>
        <BottomNav />
      </div>
    </SyncProvider>
  )
}
