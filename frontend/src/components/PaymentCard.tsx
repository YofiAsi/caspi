import type { Payment } from '../types'
import { formatCurrency } from '../utils/currency'
import { paymentShowsOriginalCurrency } from '../utils/paymentExtra'
import { TagChip } from './TagChip'

interface Props {
  payment: Payment
  tagLabels: Map<string, string>
  onClick: (event: React.MouseEvent) => void
  isSelected?: boolean
  merchantLine?: 'default' | 'alias_first'
  hideDate?: boolean
  noLeftPad?: boolean
}

function mergedTagIds(p: Payment): string[] {
  return [...new Set([...p.payment_tags, ...p.merchant_tags])]
}

export function PaymentCard({ payment, tagLabels, onClick, isSelected, merchantLine = 'default', hideDate = false, noLeftPad = false }: Props) {
  const dateAtNoon = new Date(`${payment.date.slice(0, 10)}T12:00:00`)
  const dateMonthShort = dateAtNoon.toLocaleDateString('en-GB', { month: 'short' })
  const dateDayNum = dateAtNoon.getDate()

  const amount = formatCurrency(payment.effective_amount, payment.currency)
  const isRefund = payment.effective_amount < 0
  const isShared = payment.share_amount !== null
  const showOriginal = paymentShowsOriginalCurrency(payment)
  const { extra } = payment

  const tagIds = mergedTagIds(payment)
  const label = (id: string) => tagLabels.get(id) ?? `${id.slice(0, 8)}...`
  const merchantTitle =
    merchantLine === 'alias_first' && payment.merchant_alias?.trim()
      ? payment.merchant_alias.trim()
      : payment.display_name

  const hasCollections = payment.collection_ids.length > 0
  const isUntagged = tagIds.length === 0 && !hasCollections

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick(e as unknown as React.MouseEvent)}
      className={`w-full text-left ${noLeftPad ? 'pl-2 pr-4 py-3' : 'px-4 py-3'} select-none transition-all duration-150 cursor-pointer ${
        isSelected ? 'bg-accent-soft' : 'hover:bg-hover-surface active:bg-active-surface'
      }`}
      style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}
    >
      <div className={`flex gap-3 ${hideDate ? 'items-center' : 'items-start'}`}>
        {!hideDate && (
          <div className="shrink-0 w-10 flex flex-col items-center justify-center text-center self-center">
            <span className="text-[11px] font-medium text-fg-muted leading-none">{dateMonthShort}</span>
            <span className="text-[20px] font-bold text-fg leading-none mt-1 tabular-nums">{dateDayNum}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-fg truncate tracking-tight">{merchantTitle}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {isUntagged && (
              <TagChip tagId="" label="Untagged" variant="untagged" className="px-2 py-0 text-[10px]" />
            )}
            {hasCollections && (
              <TagChip tagId="" label="Collection" variant="collection" className="px-2 py-0 text-[10px]" />
            )}
            {tagIds.map((tid) => (
              <TagChip key={tid} tagId={tid} label={label(tid)} className="px-2 py-0 text-[10px]" />
            ))}
          </div>
        </div>

        {/* Amount */}
        <div className="shrink-0 text-right">
          <p className={`text-[15px] font-bold tracking-tight ${isRefund ? 'text-success-fg' : 'text-fg'}`}>
            {amount}
          </p>
          {showOriginal && (
            <p className="text-[10px] text-fg-subtle truncate">
              {formatCurrency(extra.original_amount!, extra.original_currency!)}
            </p>
          )}
          {isShared && (
            <p className="text-[10px] text-fg-subtle mt-0.5">
              your share {formatCurrency(payment.share_amount!, payment.share_currency ?? payment.currency)}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
