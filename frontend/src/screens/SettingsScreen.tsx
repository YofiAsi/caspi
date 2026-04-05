import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { credentialsApi } from '../api/credentials'
import { useAuth } from '../context/AuthContext'

export default function SettingsScreen() {
  const { user, logout } = useAuth()
  const queryClient = useQueryClient()

  const { data: credentials = [] } = useQuery({
    queryKey: ['credentials'],
    queryFn: () => credentialsApi.list(),
  })

  const deleteCred = useMutation({
    mutationFn: (id: string) => credentialsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['credentials'] }),
  })

  return (
    <div className="flex flex-col gap-0">
      <header className="bg-white px-4 pt-6 pb-4">
        <h1 className="text-xl font-bold text-zinc-900">Settings</h1>
      </header>

      {/* Account */}
      <section className="mx-4 mb-4 overflow-hidden rounded-2xl bg-white divide-y divide-zinc-100">
        <SectionHeader label="Account" />
        <div className="flex items-center px-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 text-sm font-bold text-zinc-600">
            {user?.email[0]?.toUpperCase()}
          </div>
          <div className="ml-3 min-w-0">
            <p className="truncate text-sm font-medium text-zinc-900">{user?.email}</p>
          </div>
        </div>
        <SettingsRow
          label="Sign out"
          destructive
          onTap={logout}
        />
      </section>

      {/* Connected accounts */}
      <section className="mx-4 mb-4 overflow-hidden rounded-2xl bg-white divide-y divide-zinc-100">
        <SectionHeader label="Connected accounts" />
        {credentials.length === 0 ? (
          <p className="px-4 py-3 text-sm text-zinc-400">No accounts connected</p>
        ) : (
          credentials.map(c => (
            <div key={c.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-zinc-900 capitalize">{c.provider}</p>
                <p className="text-xs text-zinc-400">{c.label}</p>
              </div>
              <button
                type="button"
                onClick={() => deleteCred.mutate(c.id)}
                className="text-xs font-medium text-red-500 active:text-red-700"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </section>

      {/* App info */}
      <section className="mx-4 overflow-hidden rounded-2xl bg-white divide-y divide-zinc-100">
        <SectionHeader label="About" />
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-zinc-700">Version</span>
          <span className="text-sm text-zinc-400">1.0.0</span>
        </div>
      </section>
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-4 py-2 bg-zinc-50">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
    </div>
  )
}

function SettingsRow({ label, destructive, onTap }: { label: string; destructive?: boolean; onTap: () => void }) {
  return (
    <button
      type="button"
      onClick={onTap}
      className="flex w-full items-center justify-between px-4 py-3 text-left active:bg-zinc-50"
    >
      <span className={`text-sm font-medium ${destructive ? 'text-red-500' : 'text-zinc-800'}`}>
        {label}
      </span>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M5 3l4 4-4 4" />
      </svg>
    </button>
  )
}
