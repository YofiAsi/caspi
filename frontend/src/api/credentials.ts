import { api } from './client'
import type { CredentialOut } from './types'

export const credentialsApi = {
  list: () => api.get<CredentialOut[]>('/credentials'),
  create: (body: { provider: string; label: string; credentials: Record<string, string> }) =>
    api.post<CredentialOut>('/credentials', body),
  delete: (id: string) => api.delete(`/credentials/${id}`),
}
