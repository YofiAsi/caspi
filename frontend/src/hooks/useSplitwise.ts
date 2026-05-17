import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { SplitwiseStatus } from '../types'

export function useSplitwiseStatus(opts?: { refetchInterval?: number }) {
  return useQuery<SplitwiseStatus>({
    queryKey: ['splitwise', 'status'],
    queryFn: async () => {
      try {
        return await api.splitwise.status()
      } catch {
        return {
          connected: false,
          source: null,
          splitwise_user_id: null,
          last_validated_at: null,
          queued: 0,
          failed: 0,
        }
      }
    },
    staleTime: 30_000,
    refetchInterval: opts?.refetchInterval,
    refetchOnWindowFocus: true,
  })
}

export function useSplitwiseGroups(enabled: boolean) {
  return useQuery({
    queryKey: ['splitwise', 'groups'],
    queryFn: () => api.splitwise.groups(),
    staleTime: 5 * 60_000,
    enabled,
  })
}
