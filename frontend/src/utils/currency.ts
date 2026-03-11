const SYMBOLS: Record<string, string> = {
  ILS: '₪',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CHF: 'Fr',
  CAD: 'C$',
  AUD: 'A$',
}

export function formatCurrency(amount: number, currency: string): string {
  const symbol = SYMBOLS[currency.toUpperCase()]
  const number = amount.toLocaleString('en', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  if (symbol) return `${number} ${symbol}`
  try {
    return amount.toLocaleString('en', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    })
  } catch {
    return `${currency} ${number}`
  }
}
