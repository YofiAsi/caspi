interface Props {
  personal: number
  full: number
  currency?: string
}

function fmt(n: number, currency = 'ILS') {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(n))
}

export default function AmountDisplay({ personal, full, currency = 'ILS' }: Props) {
  const isRefund = full < 0
  const isShared = Math.abs(personal - full) > 0.005

  return (
    <div className={`flex flex-col items-end ${isRefund ? 'text-emerald-600' : 'text-zinc-900'}`}>
      <span className="text-sm font-semibold tabular-nums">
        {isRefund ? '+' : ''}{fmt(personal, currency)}
      </span>
      {isShared && (
        <span className="text-xs text-zinc-400 tabular-nums">
          {fmt(full, currency)} total
        </span>
      )}
    </div>
  )
}
