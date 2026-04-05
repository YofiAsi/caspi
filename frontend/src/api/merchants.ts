import { api } from './client'
import type { MerchantOut } from './types'

export interface MerchantUpdate {
  alias?: string | null
  default_share?: number | null
  default_share_amount?: number | null
  tag_ids?: string[]
}

export const merchantsApi = {
  list: (q?: string, limit = 50) => {
    const params = new URLSearchParams({ limit: String(limit) })
    if (q) params.set('q', q)
    return api.get<MerchantOut[]>(`/merchants?${params}`)
  },
  get: (id: string) => api.get<MerchantOut>(`/merchants/${id}`),
  update: (id: string, body: MerchantUpdate) => api.put<MerchantOut>(`/merchants/${id}`, body),
}
