import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SplitwiseFailedEntry } from '../types'
import { api } from '../api/client'

interface Props {
  onClose: () => void
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function SplitwiseFailedDrawer({ onClose }: Props) {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['splitwise', 'failed'],
    queryFn: () => api.splitwise.listFailed(100),
    staleTime: 15_000,
    refetchInterval: 15_000,
  })

  const retryMutation = useMutation({
    mutationFn: (entry: SplitwiseFailedEntry) =>
      api.splitwise.retry(entry.payment_id ?? ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['splitwise', 'failed'] })
      queryClient.invalidateQueries({ queryKey: ['splitwise', 'status'] })
    },
  })

  const entries = data?.entries ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-scrim animate-scrimIn" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full sm:max-w-md bg-surface rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[80vh] animate-slideUp">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border-subtle shrink-0">
          <h2 className="text-base font-semibold text-fg">Failed Splitwise Pushes</h2>
          <button onClick={onClose} className="text-fg-subtle hover:text-fg-muted transition-colors p-1 rounded-lg hover:bg-hover-surface" aria-label="Close">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4">
          {isLoading && <p className="text-sm text-fg-muted">Loading…</p>}
          {!isLoading && entries.length === 0 && (
            <p className="text-sm text-fg-muted">No failed entries.</p>
          )}
          {entries.map((e) => (
            <div key={e.id} className="py-3 border-b border-border-subtle last:border-0 flex flex-col gap-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-fg">
                    {e.operation === 'push' ? 'Push' : 'Delete'} · {e.attempts} attempt{e.attempts === 1 ? '' : 's'}
                  </p>
                  <p className="text-[11px] text-fg-muted truncate">
                    {e.payment_id ? `Payment ${e.payment_id.slice(0, 8)}…` : 'Unknown payment'}
                  </p>
                  {e.last_error && (
                    <p className="text-[11px] text-danger-fg truncate">{e.last_error}</p>
                  )}
                  <p className="text-[11px] text-fg-subtle">
                    Last attempt: {formatDate(e.updated_at)}
                  </p>
                </div>
                {e.payment_id && (
                  <button
                    type="button"
                    onClick={() => retryMutation.mutate(e)}
                    disabled={retryMutation.isPending}
                    className="text-xs text-accent font-medium hover:opacity-80 disabled:opacity-40 transition-opacity shrink-0"
                  >
                    Retry
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
