import { useEffect, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { Payment } from '../../types'
import { PaymentCard } from '../PaymentCard'

interface Props {
  payments: Payment[]
  isPending: boolean
  isError: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  scrollRoot: HTMLDivElement | null
  selectedPaymentId: string | null
  onSelectPayment: (p: Payment | null) => void
}

export function AnalysisPaymentList({
  payments,
  isPending,
  isError,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  scrollRoot,
  selectedPaymentId,
  onSelectPayment,
}: Props) {
  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => api.tags.list(),
    staleTime: 120_000,
  })
  const tagLabels = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of tagsData?.tags ?? []) m.set(t.id, t.name)
    return m
  }, [tagsData])

  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = scrollRoot
    const target = sentinelRef.current
    if (!root || !target) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage()
        }
      },
      { root, rootMargin: '120px', threshold: 0 },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [scrollRoot, hasNextPage, isFetchingNextPage, fetchNextPage, payments.length])

  if (isPending) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-6 w-6 rounded-full border-2 border-ring border-t-transparent animate-spin" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="py-16 text-center text-sm text-danger-text">
        Failed to load payments.
      </div>
    )
  }

  if (payments.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-fg-subtle text-sm">No payments for this selection.</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-border-subtle">
      {payments.map((payment) => (
        <div key={payment.payment_id}>
          <PaymentCard
            payment={payment}
            tagLabels={tagLabels}
            merchantLine="alias_first"
            onClick={() => {
              if (selectedPaymentId === payment.payment_id) onSelectPayment(null)
              else onSelectPayment(payment)
            }}
            isSelected={selectedPaymentId === payment.payment_id}
          />
        </div>
      ))}
      <div ref={sentinelRef} className="h-1 w-full" aria-hidden />
      {isFetchingNextPage ? (
        <div className="flex justify-center py-6">
          <div className="h-5 w-5 rounded-full border-2 border-ring border-t-transparent animate-spin" />
        </div>
      ) : null}
    </div>
  )
}
