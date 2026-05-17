import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

interface Props {
  onClose: () => void
}

export function SplitwiseConnectDialog({ onClose }: Props) {
  const queryClient = useQueryClient()
  const [consumerKey, setConsumerKey] = useState('')
  const [consumerSecret, setConsumerSecret] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      api.splitwise.connect({
        consumer_key: consumerKey.trim(),
        consumer_secret: consumerSecret.trim(),
        api_key: apiKey.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['splitwise', 'status'] })
      onClose()
    },
    onError: (e: Error) => {
      setError(e.message || 'Invalid credentials')
    },
  })

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault()
    setError(null)
    mutate()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4">
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border-subtle">
          <h2 className="text-base font-semibold text-fg">Connect Splitwise</h2>
          <button
            onClick={onClose}
            className="text-fg-subtle hover:text-fg-muted transition-colors p-1 rounded-lg hover:bg-hover-surface"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-3">
          <p className="text-xs text-fg-muted">
            Paste your Splitwise API credentials. You can find these in Splitwise → Account Settings → API.
          </p>

          {[
            { label: 'Consumer Key', value: consumerKey, set: setConsumerKey, id: 'sw-consumer-key' },
            { label: 'Consumer Secret', value: consumerSecret, set: setConsumerSecret, id: 'sw-consumer-secret' },
            { label: 'API Key', value: apiKey, set: setApiKey, id: 'sw-api-key' },
          ].map(({ label, value, set, id }) => (
            <div key={id} className="flex flex-col gap-1">
              <label htmlFor={id} className="text-xs font-medium text-fg-muted">{label}</label>
              <input
                id={id}
                type="password"
                autoComplete="off"
                value={value}
                onChange={(e) => set(e.target.value)}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring bg-input-bg text-fg"
                disabled={isPending}
              />
            </div>
          ))}

          {error && (
            <p className="text-xs text-danger-fg">{error}</p>
          )}

          <button
            type="submit"
            disabled={isPending || !apiKey.trim()}
            className="mt-1 w-full py-2.5 rounded-xl bg-accent text-on-primary text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-40"
          >
            {isPending ? 'Connecting…' : 'Connect'}
          </button>
        </form>
      </div>
    </div>
  )
}
