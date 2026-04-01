import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Payment } from '../types'
import { api } from '../api/client'
import { TagChip } from './TagChip'

interface Props {
  payments: Payment[]
  onClearSelection: () => void
}

interface DialogProps {
  payments: Payment[]
  onClose: () => void
  onSaved: () => void
}

function BulkTagDialog({ payments, onClose, onSaved }: DialogProps) {
  const queryClient = useQueryClient()
  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => api.tags.list(),
    staleTime: 120_000,
  })
  const catalog = tagsData?.tags ?? []
  const labelMap = new Map(catalog.map((t) => [t.id, t.name]))

  const [tagIds, setTagIds] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const resolveId = async (raw: string): Promise<string | null> => {
    const n = raw.trim().toLowerCase()
    if (!n) return null
    const hit = catalog.find((t) => t.name === n)?.id
    if (hit) return hit
    const created = await api.tags.create(n)
    await queryClient.invalidateQueries({ queryKey: ['tags'] })
    return created.id
  }

  const addTag = () => {
    void (async () => {
      if (busy) return
      setBusy(true)
      try {
        const id = await resolveId(tagInput)
        if (id && !tagIds.includes(id)) setTagIds((prev) => [...prev, id])
        setTagInput('')
      } finally {
        setBusy(false)
      }
    })()
  }

  const removeTag = (id: string) => setTagIds((prev) => prev.filter((t) => t !== id))

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    }
  }

  const mutation = useMutation({
    mutationFn: async (newIds: string[]) => {
      await Promise.all(
        payments.map((p) => {
          const merged = Array.from(new Set([...p.payment_tags, ...newIds]))
          return api.payments.patch(p.payment_id, { payment_tags: merged })
        }),
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      onSaved()
    },
  })

  const handleSave = () => {
    if (tagIds.length === 0) return
    mutation.mutate(tagIds)
  }

  const label = (id: string) => labelMap.get(id) ?? `${id.slice(0, 8)}…`

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-scrim"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full sm:max-w-sm bg-surface rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-xs font-semibold text-fg-muted uppercase tracking-wide">
            Add payment-only tags to {payments.length} payments
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-fg-subtle hover:text-fg-muted text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4">
          <div>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a tag name and press Enter"
                className="flex-1 text-sm border border-border rounded-lg px-3 py-1.5 bg-input-bg text-fg focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={addTag}
                disabled={!tagInput.trim() || busy}
                className="text-sm px-3 py-1.5 rounded-lg bg-accent-soft text-accent font-medium hover:bg-accent-soft-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Add
              </button>
            </div>

            {tagIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {tagIds.map((id) => (
                  <TagChip
                    key={id}
                    tagId={id}
                    label={label(id)}
                    className="px-2 py-0.5 text-xs"
                    onRemove={() => removeTag(id)}
                  />
                ))}
              </div>
            )}
          </div>

          {mutation.isError && (
            <p className="text-xs text-danger-text">Something went wrong. Please try again.</p>
          )}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="text-sm px-4 py-1.5 rounded-lg border border-border text-fg-muted hover:bg-hover-surface transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={tagIds.length === 0 || mutation.isPending}
              className="text-sm px-4 py-1.5 rounded-lg bg-accent text-on-primary font-medium hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {mutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function BulkActionsPanel({ payments, onClearSelection }: Props) {
  const [showDialog, setShowDialog] = useState(false)

  const handleSaved = () => {
    setShowDialog(false)
    onClearSelection()
  }

  return (
    <>
      <div
        className="fixed right-4 top-[77px] bottom-4 w-80 z-40 bg-surface rounded-2xl shadow-xl border border-border flex flex-col"
        role="complementary"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <p className="text-xs font-semibold text-fg-muted uppercase tracking-wide">
            {payments.length} selected
          </p>
          <button
            type="button"
            onClick={onClearSelection}
            className="text-fg-subtle hover:text-fg-muted text-lg leading-none"
            aria-label="Clear selection"
          >
            ×
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
          <p className="text-sm text-fg-muted text-center">
            {payments.length} payments selected
          </p>
          <button
            type="button"
            onClick={() => setShowDialog(true)}
            className="w-full text-sm px-4 py-2 rounded-lg bg-accent text-on-primary font-medium hover:bg-accent-hover transition-colors"
          >
            Add tags
          </button>
        </div>
      </div>

      {showDialog && (
        <BulkTagDialog
          payments={payments}
          onClose={() => setShowDialog(false)}
          onSaved={handleSaved}
        />
      )}
    </>
  )
}
