import { api } from './client'
import type { TagOut } from './types'

export const tagsApi = {
  list: () => api.get<TagOut[]>('/tags'),
  create: (name: string) => api.post<TagOut>('/tags', { name }),
  update: (id: string, name: string) => api.put<TagOut>(`/tags/${id}`, { name }),
  delete: (id: string) => api.delete(`/tags/${id}`),
}
