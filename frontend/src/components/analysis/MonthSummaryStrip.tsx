import { formatCurrency } from '../../utils/currency'
import { formatYearMonthLabel } from '../../utils/monthBounds'

interface Props {
  yearMonth: string
  paymentCount: number
  sumEffective: number
}

export function MonthSummaryStrip({ yearMonth, paymentCount, sumEffective }: Props) {
  const label = formatYearMonthLabel(yearMonth, 'en-GB')
  return (
    <div className="rounded-xl border border-border-subtle bg-surface px-4 py-3 flex flex-wrap items-baseline justify-between gap-2">
      <p className="text-sm font-semibold text-fg">{label}</p>
      <div className="flex flex-wrap gap-4 text-sm text-fg-secondary">
        <span>
          <span className="text-fg-muted">Total</span>{' '}
          <span className="font-semibold text-fg">{formatCurrency(sumEffective, 'ILS')}</span>
        </span>
        <span>
          <span className="text-fg-muted">Payments</span>{' '}
          <span className="font-semibold text-fg">{paymentCount}</span>
        </span>
      </div>
    </div>
  )
}
