import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Payment, PaymentFilters } from '../types'
import { PaymentCard } from './PaymentCard'

interface Props {
  filters: PaymentFilters
  selectedPaymentId?: string
  onSelect: (payment: Payment) => void
}

export function PaymentList({ filters, selectedPaymentId, onSelect }: Props) {
  const { data: payments, isLoading, isError } = useQuery({
    queryKey: ['payments', filters],
    queryFn: () => api.payments.list(filters),
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-6 w-6 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="py-16 text-center text-sm text-red-500">
        Failed to load payments.
      </div>
    )
  }

  if (!payments || payments.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-400 text-sm">No payments here yet.</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-100">
      {payments.map((payment) => (
        <PaymentCard
          key={payment.payment_id}
          payment={payment}
          onClick={() => onSelect(payment)}
          isSelected={payment.payment_id === selectedPaymentId}
        />
      ))}
    </div>
  )
}
