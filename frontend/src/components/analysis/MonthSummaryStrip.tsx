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
    <div className="rounded-2xl bg-gradient-to-br from-accent/10 to-transparent p-5">
      <p className="text-xs font-medium text-fg-muted uppercase tracking-wide mb-1">{label}</p>
      <p className="text-4xl font-bold text-fg tracking-tight">{formatCurrency(sumEffective, 'ILS')}</p>
      <p className="text-xs text-fg-subtle mt-2">{paymentCount} payments</p>
    </div>
  )
}
