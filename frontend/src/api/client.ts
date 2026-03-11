import type { PatchPaymentBody, Payment, PaymentFilters, ScrapeResult } from '../types'

const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(detail || res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  scrape: {
    quick: (startDate: string): Promise<ScrapeResult> =>
      request(`/scrape/isracard?start_date=${startDate}`, { method: 'POST' }),
  },
  payments: {
    list: (filters?: PaymentFilters): Promise<Payment[]> => {
      const params = new URLSearchParams()

      if (filters?.includeTags) {
        for (const tag of filters.includeTags) {
          params.append('include_tags', tag)
        }
      }

      if (filters?.excludeTags) {
        for (const tag of filters.excludeTags) {
          params.append('exclude_tags', tag)
        }
      }

      if (filters?.dateFrom) {
        params.set('date_from', filters.dateFrom)
      }
      if (filters?.dateTo) {
        params.set('date_to', filters.dateTo)
      }

      if (filters?.amountMin !== undefined) {
        params.set('amount_min', String(filters.amountMin))
      }
      if (filters?.amountMax !== undefined) {
        params.set('amount_max', String(filters.amountMax))
      }

      const query = params.toString()
      return request(`/payments${query ? `?${query}` : ''}`)
    },
    patch: (paymentId: string, body: PatchPaymentBody): Promise<Payment> =>
      request(`/payments/${paymentId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
  },
}
