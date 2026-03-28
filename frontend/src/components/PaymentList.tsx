import { useEffect, useMemo, useRef } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Payment, PaymentFilters, PaymentListCursor } from '../types'
import { PaymentCard } from './PaymentCard'

const PAGE_SIZE = 50

interface Props {
  filters: PaymentFilters
  scrollRoot: HTMLDivElement | null
  selectedPaymentIds: Set<string>
  onSelectionChange: (payments: Payment[]) => void
}

export function PaymentList({
  filters,
  scrollRoot,
  selectedPaymentIds,
  onSelectionChange,
}: Props) {
  const {
    data,
    isPending,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['payments', 'infinite', filters],
    queryFn: ({ pageParam }) =>
      api.payments.listPage(filters, {
        limit: PAGE_SIZE,
        cursor: pageParam ?? undefined,
      }),
    initialPageParam: null as PaymentListCursor | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  })

  const payments = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  )

  const lastClickedId = useRef<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = scrollRoot
    const target = sentinelRef.current
    if (!root || !target) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (
          entry?.isIntersecting &&
          hasNextPage &&
          !isFetchingNextPage
        ) {
          void fetchNextPage()
        }
      },
      { root, rootMargin: '120px', threshold: 0 },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [scrollRoot, hasNextPage, isFetchingNextPage, fetchNextPage, payments.length])

  const handleCardClick = (payment: Payment, event: React.MouseEvent) => {
    if (!payments.length) return

    const isCtrl = event.ctrlKey || event.metaKey
    const isShift = event.shiftKey

    if (isShift && lastClickedId.current) {
      const anchorIdx = payments.findIndex((p) => p.payment_id === lastClickedId.current)
      const targetIdx = payments.findIndex((p) => p.payment_id === payment.payment_id)
      if (anchorIdx !== -1 && targetIdx !== -1) {
        const from = Math.min(anchorIdx, targetIdx)
        const to = Math.max(anchorIdx, targetIdx)
        const rangeIds = new Set(payments.slice(from, to + 1).map((p) => p.payment_id))
        const next = payments.filter((p) => selectedPaymentIds.has(p.payment_id) || rangeIds.has(p.payment_id))
        onSelectionChange(next)
        return
      }
    }

    if (isCtrl) {
      lastClickedId.current = payment.payment_id
      if (selectedPaymentIds.has(payment.payment_id)) {
        onSelectionChange(payments.filter((p) => selectedPaymentIds.has(p.payment_id) && p.payment_id !== payment.payment_id))
      } else {
        onSelectionChange(payments.filter((p) => selectedPaymentIds.has(p.payment_id) || p.payment_id === payment.payment_id))
      }
      return
    }

    lastClickedId.current = payment.payment_id
    if (selectedPaymentIds.size === 1 && selectedPaymentIds.has(payment.payment_id)) {
      onSelectionChange([])
    } else {
      onSelectionChange([payment])
    }
  }

  if (isPending) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-6 w-6 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="py-16 text-center text-sm text-red-500">
        Failed to load payments.
      </div>
    )
  }

  if (payments.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-400 text-sm">No payments here yet.</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-100">
      {payments.map((payment) => (
        <PaymentCard
          key={payment.payment_id}
          payment={payment}
          onClick={(e) => handleCardClick(payment, e)}
          isSelected={selectedPaymentIds.has(payment.payment_id)}
        />
      ))}
      <div ref={sentinelRef} className="h-1 w-full" aria-hidden />
      {isFetchingNextPage ? (
        <div className="flex justify-center py-6">
          <div className="h-5 w-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
        </div>
      ) : null}
    </div>
  )
}
