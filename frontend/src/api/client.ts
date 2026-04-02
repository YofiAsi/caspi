import type {
  CollectionItem,
  MonthTagSlicesResponse,
  PatchPaymentBody,
  Payment,
  PaymentFilters,
  PaymentListCursor,
  PaymentListPage,
  PaymentSummary,
  ScrapeResult,
  TagItem,
} from '../types'

const BASE = '/api'

function appendPaymentFilters(params: URLSearchParams, filters?: PaymentFilters): void {
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
  if (filters?.taggedOnly) {
    params.set('tagged_only', 'true')
  }
  if (filters?.q?.trim()) {
    params.set('q', filters.q.trim())
  }
  if (filters?.currency) {
    params.set('currency', filters.currency)
  }
  if (filters?.sort) {
    params.set('sort', filters.sort)
  }
  if (filters?.applyTagSlice) {
    params.set('apply_tag_slice', 'true')
  }
  if (filters?.filterTagId) {
    params.set('filter_tag_id', filters.filterTagId)
  }
  if (filters?.otherTagIds) {
    for (const id of filters.otherTagIds) {
      params.append('other_tag_ids', id)
    }
  }
  if (filters?.includeTotals) {
    params.set('include_totals', 'true')
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string> | undefined),
    },
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
    listPage: (
      filters: PaymentFilters | undefined,
      options: { limit?: number; cursor?: PaymentListCursor | null },
    ): Promise<PaymentListPage> => {
      const params = new URLSearchParams()
      appendPaymentFilters(params, filters)
      params.set('limit', String(options.limit ?? 50))
      if (options.cursor) {
        params.set('after_date', options.cursor.date)
        params.set('after_payment_id', options.cursor.payment_id)
        if (options.cursor.effective_amount != null) {
          params.set('after_effective_amount', String(options.cursor.effective_amount))
        }
        if (options.cursor.merchant_sort_key != null) {
          params.set('after_merchant_key', options.cursor.merchant_sort_key)
        }
      }
      const query = params.toString()
      return request(`/payments${query ? `?${query}` : ''}`)
    },
    summary: (filters?: PaymentFilters): Promise<PaymentSummary> => {
      const params = new URLSearchParams()
      appendPaymentFilters(params, filters)
      const query = params.toString()
      return request(`/payments/summary${query ? `?${query}` : ''}`)
    },
    patch: (paymentId: string, body: PatchPaymentBody): Promise<Payment> =>
      request(`/payments/${paymentId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    monthTagSlices: (args: {
      year: number
      month: number
      filterTagId: string
    }): Promise<MonthTagSlicesResponse> => {
      const params = new URLSearchParams()
      params.set('year', String(args.year))
      params.set('month', String(args.month))
      params.set('filter_tag_id', args.filterTagId)
      return request(`/payments/analysis/month-tag-slices?${params.toString()}`)
    },
  },
  tags: {
    list: (): Promise<{ tags: TagItem[] }> => request('/tags'),
    create: (name: string): Promise<TagItem> =>
      request('/tags', { method: 'POST', body: JSON.stringify({ name }) }),
  },
  collections: {
    list: (): Promise<CollectionItem[]> => request('/collections'),
    create: (name: string): Promise<CollectionItem> =>
      request('/collections', { method: 'POST', body: JSON.stringify({ name }) }),
  },
  auth: {
    logout: (): Promise<void> =>
      request('/auth/logout', { method: 'POST' }),
  },
}

export type AuthMeResponse =
  | { auth_required: false; email: null }
  | { auth_required: true; email: string }

export async function fetchAuthMe(): Promise<
  | { kind: 'ok'; data: AuthMeResponse }
  | { kind: 'unauthorized' }
  | { kind: 'error'; status: number }
> {
  const res = await fetch(`${BASE}/auth/me`, { credentials: 'include' })
  if (res.status === 401) return { kind: 'unauthorized' }
  if (!res.ok) return { kind: 'error', status: res.status }
  const data = (await res.json()) as AuthMeResponse
  return { kind: 'ok', data }
}
