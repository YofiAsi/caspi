import * as Dialog from '@radix-ui/react-dialog'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useMemo } from 'react'
import { api } from '../api/client'
import type { Payment } from '../types'
import { TagChip } from './TagChip'

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
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-surface ${
        checked ? 'bg-accent' : 'bg-toggle-off'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-on-primary transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

export function PaymentDialog({ payment, onClose }: Props) {
  const queryClient = useQueryClient()
  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => api.tags.list(),
    staleTime: 120_000,
    enabled: payment != null,
  })
  const catalog = tagsData?.tags ?? []
  const labelMap = useMemo(() => new Map(catalog.map((t) => [t.id, t.name])), [catalog])

  const [paymentTags, setPaymentTags] = useState<string[]>([])
  const [merchantTags, setMerchantTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [tagBusy, setTagBusy] = useState(false)
  const [tagScopeAllSimilar, setTagScopeAllSimilar] = useState(true)
  const [isRecurring, setIsRecurring] = useState(false)
  const [sharingEnabled, setSharingEnabled] = useState(false)
  const [shareType, setShareType] = useState<ShareType>('fixed')
  const [shareValue, setShareValue] = useState('')
  const [merchantAlias, setMerchantAlias] = useState('')

  useEffect(() => {
    if (payment) {
      setPaymentTags(payment.payment_tags)
      setMerchantTags(payment.merchant_tags)
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
      queryClient.invalidateQueries({ queryKey: ['payments', 'summary'] })
      onClose()
    },
  })

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
      if (tagBusy) return
      setTagBusy(true)
      try {
        const id = await resolveId(tagInput)
        if (!id) {
          setTagInput('')
          return
        }
        const merged = new Set([...paymentTags, ...merchantTags])
        if (merged.has(id)) {
          setTagInput('')
          return
        }
        if (tagScopeAllSimilar) {
          setMerchantTags((prev) => [...prev, id])
        } else {
          setPaymentTags((prev) => [...prev, id])
        }
        setTagInput('')
      } finally {
        setTagBusy(false)
      }
    })()
  }

  const removeTag = (tagId: string) => {
    setMerchantTags((prev) => prev.filter((t) => t !== tagId))
    setPaymentTags((prev) => prev.filter((t) => t !== tagId))
  }

  const handleSave = () => {
    const body: Parameters<typeof api.payments.patch>[1] = {
      payment_tags: paymentTags,
      merchant_tags: merchantTags,
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

  const label = (id: string) => labelMap.get(id) ?? `${id.slice(0, 8)}…`

  return (
    <Dialog.Root open={payment !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-scrim z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[90vh] overflow-y-auto bg-surface rounded-2xl shadow-2xl p-6 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 mx-4">
          {payment && (
            <>
              <div className="mb-5">
                <Dialog.Title className="text-lg font-semibold text-fg leading-tight">
                  {payment.display_name}
                </Dialog.Title>
                <p className="text-sm text-fg-muted mt-0.5">
                  {formatDate(payment.date)} ·{' '}
                  {payment.effective_amount.toLocaleString('en-IL', {
                    style: 'currency',
                    currency: payment.currency,
                  })}
                </p>
              </div>

              <div className="space-y-5">
                <section>
                  <label className="block text-sm font-medium text-fg-secondary mb-1.5">Display alias</label>
                  <input
                    type="text"
                    value={merchantAlias}
                    onChange={(e) => setMerchantAlias(e.target.value)}
                    placeholder={payment.display_name}
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-input-bg text-fg focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {merchantAlias.trim() && (
                    <p className="text-xs text-fg-subtle mt-1">Statement: {payment.description}</p>
                  )}
                </section>

                <section>
                  <label className="block text-sm font-medium text-fg-secondary mb-1.5">Tags</label>
                  <p className="text-xs text-fg-muted mb-1">All like this (future imports too)</p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {merchantTags.map((tid) => (
                      <TagChip
                        key={`m-${tid}`}
                        tagId={tid}
                        label={label(tid)}
                        className="px-2.5 py-0.5 text-xs"
                        onRemove={() => removeTag(tid)}
                      />
                    ))}
                    {merchantTags.length === 0 && (
                      <span className="text-xs text-fg-subtle">None</span>
                    )}
                  </div>
                  <p className="text-xs text-fg-muted mb-1">This payment only</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {paymentTags.map((tid) => (
                      <TagChip
                        key={`p-${tid}`}
                        tagId={tid}
                        label={label(tid)}
                        className="px-2.5 py-0.5 text-xs"
                        onRemove={() => removeTag(tid)}
                      />
                    ))}
                    {paymentTags.length === 0 && (
                      <span className="text-xs text-fg-subtle">None</span>
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-xs text-fg-muted mb-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={tagScopeAllSimilar}
                      onChange={(e) => setTagScopeAllSimilar(e.target.checked)}
                      className="rounded border-checkbox-border text-accent focus:ring-ring"
                    />
                    New tags apply to all like this (including future)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagKeyDown}
                      placeholder="Add a tag…"
                      disabled={tagBusy}
                      className="flex-1 text-sm border border-border rounded-lg px-3 py-2 bg-input-bg text-fg focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={addTag}
                      disabled={tagBusy}
                      className="px-3 py-2 text-sm bg-accent-soft text-accent-soft-fg rounded-lg hover:bg-accent-soft-hover font-medium disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                </section>

                <section>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-fg-secondary">Recurring payment</label>
                    <Toggle checked={isRecurring} onChange={setIsRecurring} />
                  </div>
                </section>

                <section>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-fg-secondary">Sharing</label>
                    <Toggle checked={sharingEnabled} onChange={setSharingEnabled} />
                  </div>
                  {sharingEnabled && (
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-xs text-fg-muted mb-1 block">My share</label>
                        <input
                          type="number"
                          value={shareValue}
                          onChange={(e) => setShareValue(e.target.value)}
                          placeholder={shareType === 'percentage' ? '50' : '0.00'}
                          min="0"
                          step={shareType === 'percentage' ? '1' : '0.01'}
                          max={shareType === 'percentage' ? '100' : undefined}
                          className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-input-bg text-fg focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div className="w-32">
                        <label className="text-xs text-fg-muted mb-1 block">Type</label>
                        <select
                          value={shareType}
                          onChange={(e) => setShareType(e.target.value as ShareType)}
                          className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-input-bg text-fg focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="fixed">Fixed amount</option>
                          <option value="percentage">Percentage</option>
                        </select>
                      </div>
                    </div>
                  )}
                  {sharingEnabled && shareType === 'percentage' && shareValue && payment && (
                    <p className="text-xs text-fg-subtle mt-1.5">
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
                  <button className="flex-1 px-4 py-2.5 text-sm font-medium text-fg-muted bg-muted-hover rounded-xl hover:bg-active-surface transition-colors">
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  onClick={handleSave}
                  disabled={mutation.isPending}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-on-primary bg-accent rounded-xl hover:bg-accent-hover disabled:opacity-50 transition-colors"
                >
                  {mutation.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>

              {mutation.isError && (
                <p className="mt-3 text-sm text-danger-text text-center">
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
