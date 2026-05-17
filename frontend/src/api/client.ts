import type {
  CollectionItem,
  CollectionTimeseriesResponse,
  MonthTagSlicesResponse,
  PatchPaymentBody,
  Payment,
  PaymentFilters,
  PaymentListCursor,
  PaymentListPage,
  PaymentSummary,
  PaymentTimeseriesResponse,
  ScrapeResult,
  SplitwiseFailedEntry,
  SplitwiseGroup,
  SplitwiseRetryResponse,
  SplitwiseRule,
  SplitwiseRuleBody,
  SplitwiseShareRequest,
  SplitwiseShareResponse,
  SplitwiseStatus,
  SplitwiseUnshareResponse,
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
  if (filters?.collectionId) {
    params.set('collection_id', filters.collectionId)
  }
  if (filters?.applyTagCombo) {
    params.set('apply_tag_combo', 'true')
    const ids = filters.mergedTagIds ?? []
    for (const id of [...ids].sort()) {
      params.append('merged_tag_ids', id)
    }
  }
  if (filters?.applyTagComboOther) {
    params.set('apply_tag_combo_other', 'true')
    const ex = filters.tagComboExcludes ?? []
    for (const combo of ex) {
      params.append('tag_combo_exclude', combo.length ? [...combo].sort().join(',') : '')
    }
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
    timeseries: (
      granularity: 'weekly' | 'monthly' | 'quarterly' | 'yearly',
      filters?: PaymentFilters,
    ): Promise<PaymentTimeseriesResponse> => {
      const params = new URLSearchParams()
      params.set('granularity', granularity)
      appendPaymentFilters(params, filters)
      return request(`/payments/timeseries?${params.toString()}`)
    },
    periodTagSlices: (args: {
      dateFrom: string
      dateTo: string
      filterTagId: string
    }): Promise<MonthTagSlicesResponse> => {
      const params = new URLSearchParams()
      params.set('date_from', args.dateFrom)
      params.set('date_to', args.dateTo)
      params.set('filter_tag_id', args.filterTagId)
      return request(`/payments/analysis/period-tag-slices?${params.toString()}`)
    },
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
    tagSlices: (collectionId: string): Promise<MonthTagSlicesResponse> =>
      request(`/collections/${collectionId}/tag-slices`),
    timeseries: (
      collectionId: string,
      granularity: 'daily' | 'weekly' | 'monthly',
    ): Promise<CollectionTimeseriesResponse> =>
      request(`/collections/${collectionId}/timeseries?granularity=${granularity}`),
  },
  splitwise: {
    status: (): Promise<SplitwiseStatus> => request('/splitwise/status'),
    connect: (body: {
      consumer_key: string
      consumer_secret: string
      api_key: string
    }): Promise<{ source: string; splitwise_user_id: number }> =>
      request('/splitwise/connect', { method: 'POST', body: JSON.stringify(body) }),
    disconnect: (): Promise<void> =>
      request('/splitwise/disconnect', { method: 'POST' }),
    groups: (): Promise<{ groups: SplitwiseGroup[] }> => request('/splitwise/groups'),
    share: (body: SplitwiseShareRequest): Promise<SplitwiseShareResponse> =>
      request('/splitwise/share', { method: 'POST', body: JSON.stringify(body) }),
    unshare: (paymentId: string, deleteRemote: boolean): Promise<SplitwiseUnshareResponse> =>
      request(
        `/splitwise/share/${paymentId}?delete_remote=${deleteRemote ? 'true' : 'false'}`,
        { method: 'DELETE' },
      ),
    getRule: (merchantId: string): Promise<SplitwiseRule | null> =>
      request<SplitwiseRule>(`/splitwise/rules/${merchantId}`).catch((e: Error) => {
        if (e.message.includes('rule not found') || e.message.includes('404')) return null
        throw e
      }),
    putRule: (merchantId: string, body: SplitwiseRuleBody): Promise<SplitwiseRule> =>
      request(`/splitwise/rules/${merchantId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    deleteRule: (merchantId: string): Promise<void> =>
      request(`/splitwise/rules/${merchantId}`, { method: 'DELETE' }),
    listFailed: (limit = 100): Promise<{ entries: SplitwiseFailedEntry[] }> =>
      request(`/splitwise/outbox/failed?limit=${limit}`),
    retry: (paymentId: string): Promise<SplitwiseRetryResponse> =>
      request(`/splitwise/retry/${paymentId}`, { method: 'POST' }),
  },
}
