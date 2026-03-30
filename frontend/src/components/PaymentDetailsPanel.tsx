import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Payment } from '../types'
import { api } from '../api/client'
import { getTagAccentColor, type TagColorVariant } from '../lib/tagColors'
import { formatCurrency } from '../utils/currency'
import { paymentShowsOriginalCurrency } from '../utils/paymentExtra'
import { TagChip } from './TagChip'

interface Props {
  payment: Payment | null
  onClose: () => void
  onPaymentUpdate?: (payment: Payment) => void
}

function useIsSmallScreen() {
  const [isSmall, setIsSmall] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setIsSmall(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isSmall
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-border-subtle last:border-0">
      <span className="text-xs text-fg-muted shrink-0">{label}</span>
      <span className="text-xs text-fg-secondary text-right break-all">{String(value)}</span>
    </div>
  )
}

function TagAutocompleteField({
  value,
  onChange,
  allTags,
  paymentTags,
  merchantTags,
  disabled,
  onCommitValue,
}: {
  value: string
  onChange: (v: string) => void
  allTags: string[]
  paymentTags: string[]
  merchantTags: string[]
  disabled: boolean
  onCommitValue: (trimmedLower: string) => void
}) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const { resolvedTheme } = useTheme()
  const tagVariant: TagColorVariant = resolvedTheme === 'dark' ? 'dark' : 'light'

  const suggestions = useMemo(() => {
    const applied = new Set([...paymentTags, ...merchantTags])
    const unused = allTags.filter((t) => !applied.has(t))
    const q = value.trim().toLowerCase()
    if (q) return unused.filter((t) => t.includes(q)).slice(0, 50)
    return unused.slice(0, 20)
  }, [allTags, paymentTags, merchantTags, value])

  useEffect(() => {
    setHighlighted(-1)
  }, [suggestions])

  useEffect(() => {
    if (suggestions.length === 0) setOpen(false)
  }, [suggestions.length])

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  const pick = (tag: string) => {
    onCommitValue(tag)
    onChange('')
    setOpen(false)
    setHighlighted(-1)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
        setHighlighted(-1)
      }
      return
    }
    if (suggestions.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault()
        onCommitValue(value.trim().toLowerCase())
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setHighlighted((i) => {
        if (i < 0) return 0
        return i < suggestions.length - 1 ? i + 1 : i
      })
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      setHighlighted((i) => (i <= 0 ? 0 : i - 1))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (open && highlighted >= 0 && suggestions[highlighted]) {
        pick(suggestions[highlighted])
      } else {
        onCommitValue(value.trim().toLowerCase())
      }
    }
  }

  const showList = open && suggestions.length > 0

  return (
    <div ref={rootRef} className="relative flex-1 min-w-0">
      <input
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(suggestions.length > 0)}
        onKeyDown={onKeyDown}
        placeholder="Add a tag…"
        className="w-full text-xs border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring bg-input-bg text-fg"
        disabled={disabled}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-40 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          {suggestions.map((tag, idx) => (
            <li
              key={tag}
              role="option"
              aria-selected={idx === highlighted}
              className={`cursor-pointer px-2.5 py-1.5 text-xs flex items-center gap-2 ${
                idx === highlighted ? 'bg-accent-soft text-accent-nav-fg' : 'text-fg-secondary hover:bg-hover-surface'
              }`}
              onMouseDown={(ev) => {
                ev.preventDefault()
                pick(tag)
              }}
              onMouseEnter={() => setHighlighted(idx)}
            >
              <span
                className="shrink-0 size-2 rounded-full"
                style={{ backgroundColor: getTagAccentColor(tag, tagVariant) }}
                aria-hidden
              />
              {tag}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface ContentProps {
  payment: Payment
  paymentTags: string[]
  merchantTags: string[]
  tagInput: string
  setTagInput: (v: string) => void
  addTag: () => void
  commitTag: (trimmedLower: string) => void
  removeTag: (tag: string) => void
  allTags: string[]
  tagScopeAllSimilar: boolean
  setTagScopeAllSimilar: (v: boolean) => void
  isPending: boolean
  isEditingAlias: boolean
  aliasInput: string
  setAliasInput: (v: string) => void
  startEditAlias: () => void
  confirmAlias: () => void
  cancelAlias: () => void
  isAliasPending: boolean
}

function PanelContent({
  payment,
  paymentTags,
  merchantTags,
  tagInput,
  setTagInput,
  addTag,
  commitTag,
  removeTag,
  allTags,
  tagScopeAllSimilar,
  setTagScopeAllSimilar,
  isPending,
  isEditingAlias,
  aliasInput,
  setAliasInput,
  startEditAlias,
  confirmAlias,
  cancelAlias,
  isAliasPending,
}: ContentProps) {
  const [rawExpanded, setRawExpanded] = useState(false)
  const { extra } = payment

  const formattedDate = new Date(payment.date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  const effectiveAmount = formatCurrency(payment.effective_amount, payment.currency)
  const isShared = payment.share_amount !== null && payment.share_currency !== null
  const totalDiffers = payment.effective_amount !== payment.amount

  const showOriginal = paymentShowsOriginalCurrency(payment)

  const processedDateStr =
    extra.processed_date && extra.processed_date.slice(0, 10) !== payment.date
      ? new Date(extra.processed_date).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : null

  const showInstallments =
    extra.installment_number != null && extra.installment_total != null

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 py-4 space-y-5">
        <div>
          {isEditingAlias ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); confirmAlias() }
                  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelAlias() }
                }}
                className="flex-1 text-sm font-semibold text-fg border border-ring rounded-md px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-ring bg-input-bg"
                autoFocus
                disabled={isAliasPending}
              />
              <button
                type="button"
                onClick={confirmAlias}
                disabled={isAliasPending}
                className="text-success-text hover:opacity-80 disabled:opacity-40"
                aria-label="Confirm alias"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                type="button"
                onClick={cancelAlias}
                disabled={isAliasPending}
                className="text-fg-subtle hover:text-fg-muted disabled:opacity-40"
                aria-label="Cancel alias"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group">
              <p className="text-sm font-semibold text-fg leading-snug">{payment.display_name}</p>
              <button
                type="button"
                onClick={startEditAlias}
                className="text-disabled-fg hover:text-fg-subtle opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Edit name alias"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
            </div>
          )}
          {payment.merchant_alias && (
            <p className="text-xs text-fg-subtle mt-0.5">{payment.merchant}</p>
          )}
          {!payment.merchant_alias && payment.description !== payment.display_name && (
            <p className="text-xs text-fg-subtle mt-0.5">{payment.description}</p>
          )}
          <p className="text-xl font-bold text-fg mt-1.5">{effectiveAmount}</p>
          {totalDiffers && (
            <p className="text-xs text-fg-muted">
              Total: {formatCurrency(payment.amount, payment.currency)}
            </p>
          )}
          {isShared && (
            <p className="text-xs text-emerald-link mt-0.5">
              My share:{' '}
              {formatCurrency(payment.share_amount!, payment.share_currency!)}
            </p>
          )}
          <p className="text-xs text-fg-muted mt-0.5">{formattedDate}</p>
        </div>

        <div>
          <p className="text-xs font-semibold text-fg-subtle uppercase tracking-wide mb-1">
            Transaction
          </p>
          <div className="bg-surface rounded-lg border border-border-subtle px-3 py-0.5">
            <Row label="Status" value={extra.status ? capitalize(extra.status) : null} />
            <Row label="Category" value={extra.category} />
            <Row
              label="Type"
              value={extra.type === 'installments' ? 'Installments' : extra.type === 'normal' ? 'Normal' : extra.type ?? null}
            />
            {showInstallments && (
              <Row
                label="Installment"
                value={`${extra.installment_number} of ${extra.installment_total}`}
              />
            )}
            {processedDateStr && <Row label="Processed" value={processedDateStr} />}
            {showOriginal && (
              <Row
                label="Original amount"
                value={formatCurrency(extra.original_amount!, extra.original_currency!)}
              />
            )}
            <Row label="Account" value={extra.account_number} />
            <Row label="Memo" value={extra.memo} />
            <Row
              label="Payment type"
              value={payment.payment_type === 'recurring' ? 'Recurring' : 'One-time'}
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-fg-subtle uppercase tracking-wide mb-1.5">
            Tags
          </p>
          <p className="text-xs text-fg-muted mb-1">All like this (future imports too)</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {merchantTags.map((tag) => (
              <TagChip
                key={`m-${tag}`}
                tag={tag}
                className="px-2.5 py-0.5 text-xs"
                onRemove={() => removeTag(tag)}
                disabled={isPending}
              />
            ))}
            {merchantTags.length === 0 && (
              <span className="text-xs text-fg-subtle">None</span>
            )}
          </div>
          <p className="text-xs text-fg-muted mb-1">This payment only</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {paymentTags.map((tag) => (
              <TagChip
                key={`p-${tag}`}
                tag={tag}
                className="px-2.5 py-0.5 text-xs"
                onRemove={() => removeTag(tag)}
                disabled={isPending}
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
              disabled={isPending}
            />
            New tags apply to all like this (including future)
          </label>
          <div className="flex gap-2">
            <TagAutocompleteField
              value={tagInput}
              onChange={setTagInput}
              allTags={allTags}
              paymentTags={paymentTags}
              merchantTags={merchantTags}
              disabled={isPending}
              onCommitValue={commitTag}
            />
            <button
              type="button"
              onClick={addTag}
              disabled={isPending}
              className="px-3 py-1.5 text-xs bg-accent-soft text-accent-soft-fg rounded-lg hover:bg-accent-soft-hover font-medium disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>

        {extra.extended_details?.rawDetails != null && (
          <div>
            <button
              type="button"
              onClick={() => setRawExpanded((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-fg-subtle uppercase tracking-wide"
            >
              <span
                className={`transition-transform duration-150 inline-block ${rawExpanded ? 'rotate-90' : ''}`}
              >
                ▶
              </span>
              Raw details
            </button>
            {rawExpanded && (
              <pre className="mt-2 text-xs text-fg-muted bg-muted-hover rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(extra.extended_details!.rawDetails, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function PaymentDetailsPanel({ payment, onClose, onPaymentUpdate }: Props) {
  const isSmall = useIsSmallScreen()
  const queryClient = useQueryClient()
  const [paymentTags, setPaymentTags] = useState<string[]>([])
  const [merchantTags, setMerchantTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [tagScopeAllSimilar, setTagScopeAllSimilar] = useState(true)
  const [isEditingAlias, setIsEditingAlias] = useState(false)
  const [aliasInput, setAliasInput] = useState('')

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => api.tags.list(),
    staleTime: 120_000,
    enabled: payment != null,
  })
  const allTags = tagsData?.tags ?? []

  useEffect(() => {
    if (payment) {
      setPaymentTags(payment.payment_tags)
      setMerchantTags(payment.merchant_tags)
      setTagInput('')
      setIsEditingAlias(false)
      setAliasInput('')
    }
  }, [payment])

  useEffect(() => {
    if (!payment) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [payment, onClose])

  const mutation = useMutation({
    mutationFn: (payload: { payment_tags: string[]; merchant_tags: string[] }) =>
      api.payments.patch(payment!.payment_id, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      onPaymentUpdate?.(data)
      setPaymentTags(data.payment_tags)
      setMerchantTags(data.merchant_tags)
    },
  })

  const aliasMutation = useMutation({
    mutationFn: (alias: string | null) =>
      api.payments.patch(payment!.payment_id, { merchant_alias: alias }),
    onSuccess: (updatedPayment) => {
      onPaymentUpdate?.(updatedPayment)
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      setIsEditingAlias(false)
    },
  })

  const applyBuckets = (nextPayment: string[], nextMerchant: string[]) => {
    setPaymentTags(nextPayment)
    setMerchantTags(nextMerchant)
    if (payment) mutation.mutate({ payment_tags: nextPayment, merchant_tags: nextMerchant })
  }

  const commitTag = (trimmed: string) => {
    const merged = new Set([...paymentTags, ...merchantTags])
    if (!trimmed || merged.has(trimmed)) {
      setTagInput('')
      return
    }
    if (tagScopeAllSimilar) {
      applyBuckets(paymentTags, [...merchantTags, trimmed])
    } else {
      applyBuckets([...paymentTags, trimmed], merchantTags)
    }
    setTagInput('')
  }

  const addTag = () => commitTag(tagInput.trim().toLowerCase())

  const removeTag = (tag: string) => {
    const nextM = merchantTags.filter((t) => t !== tag)
    const nextP = paymentTags.filter((t) => t !== tag)
    if (nextM.length === merchantTags.length && nextP.length === paymentTags.length) return
    applyBuckets(nextP, nextM)
  }

  const startEditAlias = () => {
    setAliasInput(payment?.display_name ?? '')
    setIsEditingAlias(true)
  }

  const confirmAlias = () => {
    const trimmed = aliasInput.trim()
    aliasMutation.mutate(trimmed || null)
  }

  const cancelAlias = () => {
    setIsEditingAlias(false)
    setAliasInput('')
  }

  const contentProps: Omit<ContentProps, 'payment'> = {
    paymentTags,
    merchantTags,
    tagInput,
    setTagInput,
    addTag,
    commitTag,
    removeTag,
    allTags,
    tagScopeAllSimilar,
    setTagScopeAllSimilar,
    isPending: mutation.isPending,
    isEditingAlias,
    aliasInput,
    setAliasInput,
    startEditAlias,
    confirmAlias,
    cancelAlias,
    isAliasPending: aliasMutation.isPending,
  }

  if (isSmall) {
    if (!payment) return null
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
        <div className="relative z-10 w-full sm:max-w-md bg-surface rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <p className="text-xs font-semibold text-fg-muted uppercase tracking-wide">Details</p>
            <button
              type="button"
              onClick={onClose}
              className="text-fg-subtle hover:text-fg-muted text-lg leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <PanelContent payment={payment} {...contentProps} />
        </div>
      </div>
    )
  }

  if (!payment) return null

  return (
    <div
      className="fixed right-4 top-[77px] bottom-4 w-80 z-40 bg-surface rounded-2xl shadow-xl border border-border flex flex-col"
      role="complementary"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <p className="text-xs font-semibold text-fg-muted uppercase tracking-wide">Details</p>
        <button
          type="button"
          onClick={onClose}
          className="text-fg-subtle hover:text-fg-muted text-lg leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>
      <PanelContent payment={payment} {...contentProps} />
    </div>
  )
}
