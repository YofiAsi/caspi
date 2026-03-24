import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Payment } from '../types'
import { api } from '../api/client'

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
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
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

  const addTag = () => {
    const trimmed = tagInput.trim().toLowerCase()
    if (trimmed && !tags.includes(trimmed)) setTags((prev) => [...prev, trimmed])
    setTagInput('')
  }

  const removeTag = (tag: string) => setTags((prev) => prev.filter((t) => t !== tag))

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    }
  }

  const mutation = useMutation({
    mutationFn: async (newTags: string[]) => {
      await Promise.all(
        payments.map((p) => {
          const merged = Array.from(new Set([...p.payment_tags, ...newTags]))
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
    if (tags.length === 0) return
    mutation.mutate(tags)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Add payment-only tags to {payments.length} payments
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
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
                placeholder="Type a tag and press Enter"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                type="button"
                onClick={addTag}
                disabled={!tagInput.trim()}
                className="text-sm px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 font-medium hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Add
              </button>
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-600 font-medium"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="leading-none text-indigo-400 hover:text-indigo-700"
                      aria-label={`Remove tag ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {mutation.isError && (
            <p className="text-xs text-red-500">Something went wrong. Please try again.</p>
          )}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="text-sm px-4 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={tags.length === 0 || mutation.isPending}
              className="text-sm px-4 py-1.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
        className="fixed right-4 top-[77px] bottom-4 w-80 z-40 bg-white rounded-2xl shadow-xl border border-gray-200 flex flex-col"
        role="complementary"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {payments.length} selected
          </p>
          <button
            type="button"
            onClick={onClearSelection}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            aria-label="Clear selection"
          >
            ×
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
          <p className="text-sm text-gray-500 text-center">
            {payments.length} payments selected
          </p>
          <button
            type="button"
            onClick={() => setShowDialog(true)}
            className="w-full text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
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
