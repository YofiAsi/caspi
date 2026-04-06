import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CollectionItem, Payment, TagItem } from '../types'
import { api } from '../api/client'
import { getTagAccentColorById, type TagColorVariant } from '../lib/tagColors'
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

function Row({
  label,
  value,
  dense,
}: {
  label: string
  value?: string | number | null
  dense?: boolean
}) {
  if (value === undefined || value === null || value === '') return null
  const sz = dense ? 'text-[11px]' : 'text-xs'
  const py = dense ? 'py-1' : 'py-1.5'
  return (
    <div className={`flex justify-between gap-3 ${py} border-b border-border-subtle last:border-0`}>
      <span className={`${sz} text-fg-muted shrink-0`}>{label}</span>
      <span className={`${sz} text-fg-secondary text-right break-all`}>{String(value)}</span>
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
  allTags: TagItem[]
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
    const unused = allTags.filter((t) => !applied.has(t.id))
    const q = value.trim().toLowerCase()
    if (q) return unused.filter((t) => t.name.includes(q)).slice(0, 50)
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

  const pick = (tag: TagItem) => {
    onCommitValue(tag.name)
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
        placeholder="Tag…"
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
              key={tag.id}
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
                style={{ backgroundColor: getTagAccentColorById(tag.id, tagVariant) }}
                aria-hidden
              />
              {tag.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CollectionAutocompleteField({
  value,
  onChange,
  collectionIds,
  allCollections,
  disabled,
  onPick,
  onCommitNew,
}: {
  value: string
  onChange: (v: string) => void
  collectionIds: string[]
  allCollections: CollectionItem[]
  disabled: boolean
  onPick: (id: string) => void
  onCommitNew: (trimmed: string) => void
}) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const { resolvedTheme } = useTheme()
  const tagVariant: TagColorVariant = resolvedTheme === 'dark' ? 'dark' : 'light'

  const suggestions = useMemo(() => {
    const selected = new Set(collectionIds)
    const available = allCollections.filter((c) => !selected.has(c.id))
    const q = value.trim().toLowerCase()
    if (q) return available.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 50)
    return available.slice(0, 20)
  }, [allCollections, collectionIds, value])

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

  const pick = (c: CollectionItem) => {
    onPick(c.id)
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
        onCommitNew(value.trim())
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
        onCommitNew(value.trim())
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
        placeholder="Add…"
        className="w-full text-xs border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring bg-input-bg text-fg"
        disabled={disabled}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-40 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          {suggestions.map((c, idx) => (
            <li
              key={c.id}
              role="option"
              aria-selected={idx === highlighted}
              className={`cursor-pointer px-2.5 py-1.5 text-xs flex items-center gap-2 ${
                idx === highlighted ? 'bg-accent-soft text-accent-nav-fg' : 'text-fg-secondary hover:bg-hover-surface'
              }`}
              onMouseDown={(ev) => {
                ev.preventDefault()
                pick(c)
              }}
              onMouseEnter={() => setHighlighted(idx)}
            >
              <span
                className="shrink-0 size-2 rounded-full"
                style={{ backgroundColor: getTagAccentColorById(c.id, tagVariant) }}
                aria-hidden
              />
              {c.name}
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
  removeTag: (tagId: string) => void
  allTags: TagItem[]
  tagCommitBusy: boolean
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
  collectionIds: string[]
  allCollections: CollectionItem[]
  collectionsBusy: boolean
  collectionInput: string
  setCollectionInput: (v: string) => void
  collectionCommitBusy: boolean
  pickCollection: (id: string) => void
  commitCollection: (trimmed: string) => void
  removeCollection: (id: string) => void
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
  tagCommitBusy,
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
  collectionIds,
  allCollections,
  collectionsBusy,
  collectionInput,
  setCollectionInput,
  collectionCommitBusy,
  pickCollection,
  commitCollection,
  removeCollection,
}: ContentProps) {
  const { extra } = payment

  const tagLabelMap = useMemo(() => new Map(allTags.map((t) => [t.id, t.name])), [allTags])
  const tagLabel = (id: string) => tagLabelMap.get(id) ?? `${id.slice(0, 8)}…`
  const collectionLabelMap = useMemo(
    () => new Map(allCollections.map((c) => [c.id, c.name])),
    [allCollections],
  )
  const collectionLabel = (id: string) => collectionLabelMap.get(id) ?? `${id.slice(0, 8)}…`

  const listFormattedDate = new Date(payment.date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  })
  const dateParts = listFormattedDate.split(' ')

  const effectiveAmount = formatCurrency(payment.effective_amount, payment.currency)
  const isShared = payment.share_amount !== null
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

  const showDescriptionSub =
    payment.description.trim() !== payment.display_name.trim()

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 py-4 space-y-4">
        <div className="pb-3 border-b border-border-subtle -mx-4 px-4">
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
            <div className="flex items-center gap-3">
              <div className="shrink-0 text-center w-10">
                <p className="text-xs text-fg-subtle leading-tight">{dateParts[1]}</p>
                <p className="text-sm font-semibold text-fg-secondary leading-tight">{dateParts[0]}</p>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 group min-w-0">
                  <p className="text-sm font-medium text-fg truncate">{payment.display_name}</p>
                  <button
                    type="button"
                    onClick={startEditAlias}
                    className="text-disabled-fg hover:text-fg-subtle shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Edit name alias"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                </div>
                {showDescriptionSub && (
                  <p className="text-xs text-fg-subtle truncate mt-0.5">{payment.description}</p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-fg">{effectiveAmount}</p>
                {showOriginal && (
                  <p className="text-[10px] text-fg-subtle truncate max-w-[7rem] ml-auto">
                    {formatCurrency(extra.original_amount!, extra.original_currency!)}
                  </p>
                )}
                {totalDiffers && (
                  <p
                    className="text-[10px] text-fg-subtle truncate max-w-[7rem] ml-auto"
                    title="Full charge amount"
                  >
                    Tot. {formatCurrency(payment.amount, payment.currency)}
                  </p>
                )}
                {isShared && (
                  <p className="text-xs text-emerald-link font-medium">shared</p>
                )}
                {payment.payment_type === 'recurring' && (
                  <p className="text-xs text-info font-medium">recurring</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="flex flex-wrap gap-1.5 min-h-[1.5rem]">
            {collectionIds.map((cid) => (
              <TagChip
                key={cid}
                tagId={cid}
                label={collectionLabel(cid)}
                className="px-2 py-0.5 text-[11px]"
                onRemove={() => removeCollection(cid)}
                disabled={isPending || collectionsBusy}
                removeAriaLabel={`Remove collection ${collectionLabel(cid)}`}
              />
            ))}
          </div>
          <div className="flex gap-1.5 mt-1.5">
            <CollectionAutocompleteField
              value={collectionInput}
              onChange={setCollectionInput}
              collectionIds={collectionIds}
              allCollections={allCollections}
              disabled={isPending || collectionsBusy || collectionCommitBusy}
              onPick={pickCollection}
              onCommitNew={commitCollection}
            />
          </div>
        </div>

        <div>
          <p
            className="text-[10px] text-fg-muted mb-0.5 tabular-nums"
            title="All matching payments, including future imports"
          >
            ∞
          </p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {merchantTags.map((tid) => (
              <TagChip
                key={`m-${tid}`}
                tagId={tid}
                label={tagLabel(tid)}
                className="px-2 py-0.5 text-[11px]"
                onRemove={() => removeTag(tid)}
                disabled={isPending}
              />
            ))}
          </div>
          <p
            className="text-[10px] text-fg-muted mb-0.5 tabular-nums"
            title="This payment only"
          >
            1
          </p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {paymentTags.map((tid) => (
              <TagChip
                key={`p-${tid}`}
                tagId={tid}
                label={tagLabel(tid)}
                className="px-2 py-0.5 text-[11px]"
                onRemove={() => removeTag(tid)}
                disabled={isPending}
              />
            ))}
          </div>
          <div className="inline-flex rounded-lg border border-border p-0.5 gap-0.5 mb-2">
            <button
              type="button"
              aria-pressed={tagScopeAllSimilar}
              title="New tags apply to all matching payments, including future imports"
              aria-label="New tags apply to all matching payments, including future imports"
              onClick={() => setTagScopeAllSimilar(true)}
              disabled={isPending}
              className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition-colors ${
                tagScopeAllSimilar
                  ? 'bg-accent-soft text-accent-soft-fg'
                  : 'text-fg-muted hover:bg-hover-surface'
              } disabled:opacity-50`}
            >
              All
            </button>
            <button
              type="button"
              aria-pressed={!tagScopeAllSimilar}
              title="New tags apply only to this payment"
              aria-label="New tags apply only to this payment"
              onClick={() => setTagScopeAllSimilar(false)}
              disabled={isPending}
              className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition-colors ${
                !tagScopeAllSimilar
                  ? 'bg-accent-soft text-accent-soft-fg'
                  : 'text-fg-muted hover:bg-hover-surface'
              } disabled:opacity-50`}
            >
              This
            </button>
          </div>
          <div className="flex gap-1.5">
            <TagAutocompleteField
              value={tagInput}
              onChange={setTagInput}
              allTags={allTags}
              paymentTags={paymentTags}
              merchantTags={merchantTags}
              disabled={isPending || tagCommitBusy}
              onCommitValue={commitTag}
            />
            <button
              type="button"
              onClick={addTag}
              disabled={isPending || tagCommitBusy}
              className="shrink-0 px-2 py-1.5 text-xs bg-accent-soft text-accent-soft-fg rounded-lg hover:bg-accent-soft-hover font-medium disabled:opacity-50"
              aria-label="Add tag"
              title="Add tag"
            >
              +
            </button>
          </div>
        </div>

        <div>
          <p className="text-[11px] text-fg-muted mb-1">More</p>
          <div className="bg-surface rounded-lg border border-border-subtle px-2.5 py-0.5">
            <Row dense label="Status" value={extra.status ? capitalize(extra.status) : null} />
            <Row dense label="Category" value={extra.category} />
            <Row
              dense
              label="Type"
              value={extra.type === 'installments' ? 'Installments' : extra.type === 'normal' ? 'Normal' : extra.type ?? null}
            />
            {showInstallments && (
              <Row
                dense
                label="Inst."
                value={`${extra.installment_number} of ${extra.installment_total}`}
              />
            )}
            {processedDateStr && <Row dense label="Proc." value={processedDateStr} />}
            {showOriginal && (
              <Row
                dense
                label="Orig."
                value={formatCurrency(extra.original_amount!, extra.original_currency!)}
              />
            )}
            <Row dense label="Acct." value={extra.account_number} />
            <Row dense label="Memo" value={extra.memo} />
            <Row
              dense
              label="Billing"
              value={payment.payment_type === 'recurring' ? 'Recurring' : 'One-time'}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

const SWIPE_THRESHOLD = 80

function MobileSheet({
  payment,
  onClose,
  contentProps,
}: {
  payment: Payment | null
  onClose: () => void
  contentProps: Omit<ContentProps, 'payment'>
}) {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragY = useRef(0)
  const dragging = useRef(false)
  const startY = useRef(0)
  const prevPayment = useRef<Payment | null>(null)

  // Track the last non-null payment so we can show it while animating out
  if (payment) prevPayment.current = payment

  const displayPayment = payment ?? prevPayment.current

  // Open when payment arrives
  useEffect(() => {
    if (payment) {
      setExiting(false)
      setVisible(true)
    }
  }, [payment])

  const animateClose = useCallback(() => {
    if (exiting) return
    setExiting(true)
    setTimeout(() => {
      setVisible(false)
      setExiting(false)
      onClose()
    }, 350) // match slideDown duration
  }, [exiting, onClose])

  // Touch handlers for swipe-to-close
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const el = sheetRef.current
    if (!el) return
    // Only allow drag when the scroll container is at the top
    const scrollContainer = el.querySelector('.overflow-y-auto') as HTMLElement | null
    if (scrollContainer && scrollContainer.scrollTop > 0) return
    startY.current = e.touches[0].clientY
    dragY.current = 0
    dragging.current = true
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging.current) return
    const delta = e.touches[0].clientY - startY.current
    if (delta < 0) { dragY.current = 0; return } // only track downward
    dragY.current = delta
    const el = sheetRef.current
    if (el) el.style.transform = `translateY(${delta}px)`
  }, [])

  const onTouchEnd = useCallback(() => {
    if (!dragging.current) return
    dragging.current = false
    const el = sheetRef.current
    if (dragY.current > SWIPE_THRESHOLD) {
      animateClose()
      if (el) el.style.transform = ''
    } else {
      if (el) {
        el.style.transition = 'transform 0.2s ease'
        el.style.transform = ''
        setTimeout(() => { if (el) el.style.transition = '' }, 200)
      }
    }
    dragY.current = 0
  }, [animateClose])

  if (!visible || !displayPayment) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`absolute inset-0 bg-scrim ${exiting ? 'animate-scrimOut' : 'animate-scrimIn'}`}
        onClick={animateClose}
        aria-hidden="true"
      />
      <div
        ref={sheetRef}
        className={`relative z-10 w-full sm:max-w-md bg-surface rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[90vh] ${exiting ? 'animate-slideDown' : 'animate-slideUp'}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-0 shrink-0">
          <div className="w-9 h-1 rounded-full bg-fg-subtle/30" />
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
          <p className="text-xs font-semibold text-fg-muted uppercase tracking-wide">Details</p>
          <button
            type="button"
            onClick={animateClose}
            className="text-fg-subtle hover:text-fg-muted text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <PanelContent payment={displayPayment} {...contentProps} />
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
  const [collectionIds, setCollectionIds] = useState<string[]>([])
  const [collectionInput, setCollectionInput] = useState('')
  const [collectionCommitBusy, setCollectionCommitBusy] = useState(false)

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => api.tags.list(),
    staleTime: 120_000,
    enabled: payment != null,
  })
  const allTags: TagItem[] = tagsData?.tags ?? []

  const { data: allCollections = [] } = useQuery({
    queryKey: ['collections'],
    queryFn: () => api.collections.list(),
    staleTime: 120_000,
    enabled: payment != null,
  })
  const [tagCommitBusy, setTagCommitBusy] = useState(false)

  useEffect(() => {
    if (payment) {
      setPaymentTags(payment.payment_tags)
      setMerchantTags(payment.merchant_tags)
      setCollectionIds(payment.collection_ids)
      setCollectionInput('')
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
      queryClient.invalidateQueries({ queryKey: ['payments', 'summary'] })
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
      queryClient.invalidateQueries({ queryKey: ['payments', 'summary'] })
      setIsEditingAlias(false)
    },
  })

  const collectionMutation = useMutation({
    mutationFn: (ids: string[]) =>
      api.payments.patch(payment!.payment_id, { collection_ids: ids }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['payments', 'summary'] })
      onPaymentUpdate?.(data)
      setCollectionIds(data.collection_ids)
    },
  })

  const handleCollectionChange = (ids: string[]) => {
    setCollectionIds(ids)
    if (payment) collectionMutation.mutate(ids)
  }

  const pickCollection = (id: string) => {
    if (collectionIds.includes(id)) return
    handleCollectionChange([...collectionIds, id])
  }

  const removeCollection = (id: string) => {
    handleCollectionChange(collectionIds.filter((x) => x !== id))
  }

  const commitCollection = (raw: string) => {
    void (async () => {
      const trimmed = raw.trim()
      if (!trimmed || collectionCommitBusy || collectionMutation.isPending) {
        setCollectionInput('')
        return
      }
      setCollectionCommitBusy(true)
      try {
        const selected = new Set(collectionIds)
        const q = trimmed.toLowerCase()
        const match = allCollections.find(
          (c) => !selected.has(c.id) && c.name.toLowerCase() === q,
        )
        if (match) {
          handleCollectionChange([...collectionIds, match.id])
          setCollectionInput('')
          return
        }
        try {
          const created = await api.collections.create(trimmed)
          await queryClient.invalidateQueries({ queryKey: ['collections'] })
          handleCollectionChange(
            collectionIds.includes(created.id) ? collectionIds : [...collectionIds, created.id],
          )
        } catch {
          const refreshed = await queryClient.fetchQuery({
            queryKey: ['collections'],
            queryFn: () => api.collections.list(),
          })
          const found = refreshed.find(
            (c) => c.name.toLowerCase() === q && !selected.has(c.id),
          )
          if (found) handleCollectionChange([...collectionIds, found.id])
        }
        setCollectionInput('')
      } finally {
        setCollectionCommitBusy(false)
      }
    })()
  }

  const applyBuckets = (nextPayment: string[], nextMerchant: string[]) => {
    setPaymentTags(nextPayment)
    setMerchantTags(nextMerchant)
    if (payment) mutation.mutate({ payment_tags: nextPayment, merchant_tags: nextMerchant })
  }

  const resolveTagId = async (normalizedName: string): Promise<string | null> => {
    const fromCat = allTags.find((t) => t.name === normalizedName)?.id
    if (fromCat) return fromCat
    const created = await api.tags.create(normalizedName)
    await queryClient.invalidateQueries({ queryKey: ['tags'] })
    return created.id
  }

  const commitTag = (raw: string) => {
    void (async () => {
      const trimmed = raw.trim().toLowerCase()
      if (!trimmed || tagCommitBusy) {
        setTagInput('')
        return
      }
      setTagCommitBusy(true)
      try {
        const id = await resolveTagId(trimmed)
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
          applyBuckets(paymentTags, [...merchantTags, id])
        } else {
          applyBuckets([...paymentTags, id], merchantTags)
        }
        setTagInput('')
      } finally {
        setTagCommitBusy(false)
      }
    })()
  }

  const addTag = () => commitTag(tagInput)

  const removeTag = (tagId: string) => {
    const nextM = merchantTags.filter((t) => t !== tagId)
    const nextP = paymentTags.filter((t) => t !== tagId)
    if (nextM.length === merchantTags.length && nextP.length === paymentTags.length) return
    applyBuckets(nextP, nextM)
  }

  const startEditAlias = () => {
    setAliasInput(payment?.merchant_alias?.trim() ?? '')
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
    tagCommitBusy,
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
    collectionIds,
    allCollections,
    collectionsBusy: collectionMutation.isPending,
    collectionInput,
    setCollectionInput,
    collectionCommitBusy,
    pickCollection,
    commitCollection,
    removeCollection,
  }

  if (isSmall) {
    return (
      <MobileSheet payment={payment} onClose={onClose} contentProps={contentProps} />
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
