import { createContext, useContext } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../api/auth'
import { ApiError } from '../api/client'
import type { User } from '../api/types'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()

  const { data: user, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authApi.me(),
    retry: (_, err) => !(err instanceof ApiError && err.status === 401),
    staleTime: 5 * 60 * 1000,
  })

  async function logout() {
    await authApi.logout()
    queryClient.clear()
    window.location.href = '/auth/login'
  }

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
