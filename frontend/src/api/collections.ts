import { api } from './client'
import type { CollectionOut, CollectionDetailOut } from './types'

export interface CollectionCreate {
  name: string
  start_date?: string | null
  end_date?: string | null
}

export const collectionsApi = {
  list: () => api.get<CollectionOut[]>('/collections'),
  get: (id: string) => api.get<CollectionDetailOut>(`/collections/${id}`),
  create: (body: CollectionCreate) => api.post<CollectionOut>('/collections', body),
  update: (id: string, body: Partial<CollectionCreate>) =>
    api.put<CollectionOut>(`/collections/${id}`, body),
  delete: (id: string) => api.delete(`/collections/${id}`),
}
