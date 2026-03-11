import type { Payment } from '../types'
import { formatCurrency } from '../utils/currency'

interface Props {
  payment: Payment
  onClick: () => void
  isSelected?: boolean
}

export function PaymentCard({ payment, onClick, isSelected }: Props) {
  const formattedDate = new Date(payment.date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  })

  const amount = formatCurrency(payment.effective_amount, payment.currency)

  const isShared = payment.share_amount !== null

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className={`w-full text-left px-4 py-3.5 transition-colors cursor-pointer border-b border-gray-100 last:border-0 ${
        isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50 active:bg-gray-100'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="shrink-0 text-center w-10">
          <p className="text-xs text-gray-400 leading-tight">{formattedDate.split(' ')[1]}</p>
          <p className="text-sm font-semibold text-gray-700 leading-tight">{formattedDate.split(' ')[0]}</p>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {payment.display_name}
          </p>
          {payment.merchant_alias && (
            <p className="text-xs text-gray-400 truncate">{payment.merchant}</p>
          )}
          {payment.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {payment.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0 rounded-full text-xs bg-indigo-50 text-indigo-600 font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-gray-900">{amount}</p>
          {isShared && (
            <p className="text-xs text-emerald-600 font-medium">shared</p>
          )}
          {payment.payment_type === 'recurring' && (
            <p className="text-xs text-blue-500 font-medium">recurring</p>
          )}
        </div>
      </div>
    </div>
  )
}
