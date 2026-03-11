import * as Dialog from '@radix-ui/react-dialog'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { api } from '../api/client'
import type { Payment } from '../types'

interface Props {
  payment: Payment | null
  onClose: () => void
}

type ShareType = 'fixed' | 'percentage'

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 ${
        checked ? 'bg-indigo-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

export function PaymentDialog({ payment, projects, onClose }: Props) {
  const queryClient = useQueryClient()
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [sharingEnabled, setSharingEnabled] = useState(false)
  const [shareType, setShareType] = useState<ShareType>('fixed')
  const [shareValue, setShareValue] = useState('')
  const [merchantAlias, setMerchantAlias] = useState('')

  useEffect(() => {
    if (payment) {
      setTags(payment.tags)
      setTagInput('')
      setIsRecurring(payment.payment_type === 'recurring')
      setSharingEnabled(payment.share_amount !== null)
      setShareType('fixed')
      setShareValue(payment.share_amount !== null ? String(payment.share_amount) : '')
      setMerchantAlias(payment.merchant_alias ?? '')
    }
  }, [payment])

  const mutation = useMutation({
    mutationFn: (body: Parameters<typeof api.payments.patch>[1]) =>
      api.payments.patch(payment!.payment_id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      onClose()
    },
  })

  const handleSave = () => {
    const body: Parameters<typeof api.payments.patch>[1] = {
      tags,
      payment_type: isRecurring ? 'recurring' : 'one_time',
      merchant_alias: merchantAlias.trim() || null,
    }

    if (sharingEnabled && shareValue) {
      const val = parseFloat(shareValue)
      const computed =
        shareType === 'percentage' ? (payment!.amount * val) / 100 : val
      body.share_amount = computed
      body.share_currency = payment!.currency
    } else {
      body.share_amount = null
    }

    mutation.mutate(body)
  }

  const addTag = () => {
    const trimmed = tagInput.trim().toLowerCase()
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed])
    }
    setTagInput('')
  }

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag))

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    }
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })

  return (
    <Dialog.Root open={payment !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl p-6 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 mx-4">
          {payment && (
            <>
              <div className="mb-5">
                <Dialog.Title className="text-lg font-semibold text-gray-900 leading-tight">
                  {payment.display_name}
                </Dialog.Title>
                <p className="text-sm text-gray-500 mt-0.5">
                  {formatDate(payment.date)} ·{' '}
                  {payment.effective_amount.toLocaleString('en-IL', {
                    style: 'currency',
                    currency: payment.currency,
                  })}
                </p>
              </div>

              <div className="space-y-5">
                {payment.merchant && (
                  <section>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Display name</label>
                    <input
                      type="text"
                      value={merchantAlias}
                      onChange={(e) => setMerchantAlias(e.target.value)}
                      placeholder={payment.merchant}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    {merchantAlias.trim() && (
                      <p className="text-xs text-gray-400 mt-1">Original: {payment.merchant}</p>
                    )}
                  </section>
                )}

                <section>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Tags</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700"
                      >
                        {tag}
                        <button
                          onClick={() => removeTag(tag)}
                          className="text-indigo-400 hover:text-indigo-700 leading-none"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagKeyDown}
                      placeholder="Add a tag…"
                      className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <button
                      onClick={addTag}
                      className="px-3 py-2 text-sm bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 font-medium"
                    >
                      Add
                    </button>
                  </div>
                </section>

                <section>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">Recurring payment</label>
                    <Toggle checked={isRecurring} onChange={setIsRecurring} />
                  </div>
                </section>

                <section>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700">Sharing</label>
                    <Toggle checked={sharingEnabled} onChange={setSharingEnabled} />
                  </div>
                  {sharingEnabled && (
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 mb-1 block">My share</label>
                        <input
                          type="number"
                          value={shareValue}
                          onChange={(e) => setShareValue(e.target.value)}
                          placeholder={shareType === 'percentage' ? '50' : '0.00'}
                          min="0"
                          step={shareType === 'percentage' ? '1' : '0.01'}
                          max={shareType === 'percentage' ? '100' : undefined}
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                      </div>
                      <div className="w-32">
                        <label className="text-xs text-gray-500 mb-1 block">Type</label>
                        <select
                          value={shareType}
                          onChange={(e) => setShareType(e.target.value as ShareType)}
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        >
                          <option value="fixed">Fixed amount</option>
                          <option value="percentage">Percentage</option>
                        </select>
                      </div>
                    </div>
                  )}
                  {sharingEnabled && shareType === 'percentage' && shareValue && payment && (
                    <p className="text-xs text-gray-400 mt-1.5">
                      ={' '}
                      {((payment.amount * parseFloat(shareValue)) / 100).toLocaleString('en-IL', {
                        style: 'currency',
                        currency: payment.currency,
                      })}
                    </p>
                  )}
                </section>
              </div>

              <div className="flex gap-3 mt-6">
                <Dialog.Close asChild>
                  <button className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  onClick={handleSave}
                  disabled={mutation.isPending}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {mutation.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>

              {mutation.isError && (
                <p className="mt-3 text-sm text-red-600 text-center">
                  Failed to save. Please try again.
                </p>
              )}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
