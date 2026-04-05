import { api } from './client'
import type { ExpenseOut, PaginatedExpenses } from './types'

export interface ExpenseFilters {
  start_date?: string
  end_date?: string
  merchant_id?: string
  tag_id?: string
  collection_id?: string
  payment_type?: string
  untagged?: boolean
  sort?: string
  limit?: number
  offset?: number
}

export interface ExpenseUpdate {
  date?: string
  merchant_id?: string
  full_amount?: number
  currency?: string
  share?: number | null
  share_amount?: number | null
  tag_ids?: string[]
  collection_id?: string | null
  payment_type?: string
}

function toQuery(filters: ExpenseFilters): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null) params.set(k, String(v))
  }
  const q = params.toString()
  return q ? `?${q}` : ''
}

export const expensesApi = {
  list: (filters: ExpenseFilters = {}) =>
    api.get<PaginatedExpenses>(`/expenses${toQuery(filters)}`),
  get: (id: string) => api.get<ExpenseOut>(`/expenses/${id}`),
  update: (id: string, body: ExpenseUpdate) => api.put<ExpenseOut>(`/expenses/${id}`, body),
  delete: (id: string) => api.delete(`/expenses/${id}`),
}
