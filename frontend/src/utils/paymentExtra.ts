import type { Payment } from '../types'

export function paymentShowsOriginalCurrency(payment: Payment): boolean {
  const { extra } = payment
  return Boolean(
    extra.original_currency &&
      extra.original_currency !== payment.currency &&
      extra.original_amount != null,
  )
}
