import type { PaymentFilters } from '../types'

export function formatLocalIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function getCurrentMonthValue(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function getMonthBounds(monthValue: string | null): Pick<PaymentFilters, 'dateFrom' | 'dateTo'> {
  if (!monthValue) return {}
  const [yearStr, monthStr] = monthValue.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  if (!year || !month) return {}
  const from = new Date(year, month - 1, 1)
  const to = new Date(year, month, 0)
  return { dateFrom: formatLocalIsoDate(from), dateTo: formatLocalIsoDate(to) }
}
