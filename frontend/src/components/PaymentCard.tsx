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
}

function mergedTagIds(p: Payment): string[] {
  return [...new Set([...p.payment_tags, ...p.merchant_tags])]
}

export function PaymentCard({ payment, tagLabels, onClick, isSelected, merchantLine = 'default' }: Props) {
  const formattedDate = new Date(payment.date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  })

  const amount = formatCurrency(payment.effective_amount, payment.currency)

  const isShared = payment.share_amount !== null
  const showOriginal = paymentShowsOriginalCurrency(payment)
  const { extra } = payment

  const tagIds = mergedTagIds(payment)
  const label = (id: string) => tagLabels.get(id) ?? `${id.slice(0, 8)}…`
  const merchantTitle =
    merchantLine === 'alias_first' && payment.merchant_alias?.trim()
      ? payment.merchant_alias.trim()
      : payment.display_name

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick(e as unknown as React.MouseEvent)}
      className={`w-full text-left px-4 py-3.5 select-none transition-colors cursor-pointer border-b border-border-subtle last:border-0 ${
        isSelected ? 'bg-accent-soft' : 'hover:bg-hover-surface active:bg-active-surface'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="shrink-0 text-center w-10">
          <p className="text-xs text-fg-subtle leading-tight">{formattedDate.split(' ')[1]}</p>
          <p className="text-sm font-semibold text-fg-secondary leading-tight">{formattedDate.split(' ')[0]}</p>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-fg truncate">{merchantTitle}</p>
          {tagIds.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {tagIds.map((tid) => (
                <TagChip key={tid} tagId={tid} label={label(tid)} className="px-1.5 py-0 text-xs" />
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-fg">{amount}</p>
          {showOriginal && (
            <p className="text-[10px] text-fg-subtle truncate">
              {formatCurrency(extra.original_amount!, extra.original_currency!)}
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
    </div>
  )
}
