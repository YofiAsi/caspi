import { api } from './client'
import type { User } from './types'

export const authApi = {
  me: () => api.get<User>('/auth/me'),
  logout: () => api.post<{ ok: boolean }>('/auth/logout', {}),
}
