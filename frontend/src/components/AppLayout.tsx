import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { SyncProvider } from '../contexts/SyncContext'

export function AppLayout() {
  return (
    <SyncProvider>
      <div className="h-screen flex flex-col bg-canvas">
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
