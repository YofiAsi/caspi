import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

interface Props {
  onClose: () => void
}

export function AIProviderDialog({ onClose }: Props) {
  const queryClient = useQueryClient()
  const { data: settings } = useQuery({
    queryKey: ['ai-settings'],
    queryFn: () => api.aiSettings.get(),
  })

  const [provider, setProvider] = useState(settings?.provider ?? '')
  const [model, setModel] = useState(settings?.model ?? '')
  const [apiBase, setApiBase] = useState(settings?.api_base ?? '')
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      api.aiSettings.put({
        provider: provider.trim() || null,
        model: model.trim() || null,
        api_base: apiBase.trim() || null,
        api_key: apiKey.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-settings'] })
      onClose()
    },
    onError: (e: Error) => setError(e.message || 'Failed to save'),
  })

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault()
    setError(null)
    if (!model.trim()) {
      setError('Model is required')
      return
    }
    mutate()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4">
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border-subtle">
          <h2 className="text-base font-semibold text-fg">AI Assistant</h2>
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
            Configure the LLM provider. Settings here override environment variables. Use a local Ollama base URL such as http://host.docker.internal:11434 when running in Docker.
          </p>

          {settings && (
            <p className="text-xs text-fg-subtle">
              {settings.configured
                ? `Active: ${settings.source === 'db' ? 'saved settings' : 'environment'}${settings.has_api_key ? ' · API key set' : ''}`
                : 'Not configured — add a model below or set AI_MODEL in .env'}
            </p>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor="ai-provider" className="text-xs font-medium text-fg-muted">Provider label</label>
            <input
              id="ai-provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="openai, ollama, …"
              className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring bg-input-bg text-fg"
              disabled={isPending}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="ai-model" className="text-xs font-medium text-fg-muted">Model</label>
            <input
              id="ai-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="ollama/llama3.1"
              required
              className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring bg-input-bg text-fg"
              disabled={isPending}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="ai-api-base" className="text-xs font-medium text-fg-muted">API base URL</label>
            <input
              id="ai-api-base"
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              placeholder="http://host.docker.internal:11434"
              className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring bg-input-bg text-fg"
              disabled={isPending}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="ai-api-key" className="text-xs font-medium text-fg-muted">
              API key {settings?.has_api_key ? '(leave blank to keep current)' : ''}
            </label>
            <input
              id="ai-api-key"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={settings?.has_api_key ? '••••••••' : 'Optional for local models'}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring bg-input-bg text-fg"
              disabled={isPending}
            />
          </div>

          {error && <p className="text-xs text-danger-fg">{error}</p>}

          <button
            type="submit"
            disabled={isPending}
            className="mt-1 w-full py-2.5 rounded-xl bg-accent text-accent-fg text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </form>
      </div>
    </div>
  )
}
