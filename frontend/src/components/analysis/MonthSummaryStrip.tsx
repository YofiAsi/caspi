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
    <div className="rounded-[18px] bg-surface p-5" style={{ border: '0.5px solid rgba(255,255,255,0.06)' }}>
      <p className="text-[10px] font-bold text-fg-subtle uppercase tracking-wider">{label}</p>
      <p className="text-[24px] font-[800] text-fg tracking-tight mt-1 leading-none">{formatCurrency(sumEffective, 'ILS')}</p>
      <p className="text-[11px] text-fg-muted mt-1.5">{paymentCount} payments</p>
    </div>
  )
}
