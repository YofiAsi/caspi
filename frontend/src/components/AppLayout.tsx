import { Outlet, useOutletContext } from 'react-router-dom'
import { type AuthContext } from './AuthGate'
import { BottomNav } from './BottomNav'
import { SyncProvider } from '../contexts/SyncContext'

export function useAppAuth() {
  return useOutletContext<AuthContext>()
}

export function AppLayout({ auth }: { auth: AuthContext }) {
  return (
    <SyncProvider>
      <div className="h-screen flex flex-col bg-canvas">
        <div
          className="flex-1 min-h-0 flex flex-col overflow-hidden"
          style={{ paddingBottom: 'calc(88px + env(safe-area-inset-bottom, 0px))' }}
        >
          <Outlet context={auth} />
        </div>
        <BottomNav />
      </div>
    </SyncProvider>
  )
}
