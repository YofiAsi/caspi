import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Payment } from '../types'
import { api } from '../api/client'
import { formatCurrency } from '../utils/currency'
import { useSplitwiseGroups, useSplitwiseStatus } from '../hooks/useSplitwise'
import { ShareExpenseDialog } from './ShareExpenseDialog'

interface Props {
  payment: Payment
  onPaymentUpdate?: (p: Payment) => void
}

type UnshareStep = null | 'confirm'

export function SplitwisePanelSection({ payment, onPaymentUpdate }: Props) {
  const queryClient = useQueryClient()
  const { data: status } = useSplitwiseStatus()
  const { data: groupsData } = useSplitwiseGroups(status?.connected ?? false)
  const groups = groupsData?.groups ?? []

  const [showShareDialog, setShowShareDialog] = useState(false)
  const [unshareStep, setUnshareStep] = useState<UnshareStep>(null)

  const isShared = payment.share_amount !== null

  const unshareMutation = useMutation({
    mutationFn: (deleteRemote: boolean) =>
      api.splitwise.unshare(payment.payment_id, deleteRemote),
    onSuccess: async () => {
      const updated = await api.payments.patch(payment.payment_id, {
        share_amount: null,
        share_currency: null,
      })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['splitwise', 'status'] })
      onPaymentUpdate?.(updated)
      setUnshareStep(null)
    },
  })

  if (!status?.connected) return null

  return (
    <>
      <div className="border-t border-border-subtle pt-3 mt-1">
        <p className="text-[11px] font-semibold text-fg-muted uppercase tracking-wide mb-2">Splitwise</p>

        {isShared ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-success-fg font-medium">
                  Your share: {formatCurrency(payment.share_amount!, payment.share_currency ?? payment.currency)}
                </p>
                <p className="text-xs text-fg-subtle">
                  Charged: {formatCurrency(payment.amount, payment.currency)}
                </p>
              </div>
              {unshareStep === null ? (
                <button
                  type="button"
                  onClick={() => setUnshareStep('confirm')}
                  className="text-xs text-fg-subtle hover:text-danger-fg transition-colors"
                >
                  Unshare
                </button>
              ) : null}
            </div>

            {unshareStep === 'confirm' && (
              <div className="bg-muted rounded-lg px-3 py-2 flex flex-col gap-2">
                <p className="text-xs text-fg">Also delete from Splitwise?</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={unshareMutation.isPending}
                    onClick={() => unshareMutation.mutate(true)}
                    className="flex-1 text-xs py-1.5 rounded-lg bg-danger-fg text-white font-medium hover:opacity-80 disabled:opacity-40 transition-opacity"
                  >
                    Yes, delete
                  </button>
                  <button
                    type="button"
                    disabled={unshareMutation.isPending}
                    onClick={() => unshareMutation.mutate(false)}
                    className="flex-1 text-xs py-1.5 rounded-lg bg-accent-soft text-accent-soft-fg font-medium hover:opacity-80 disabled:opacity-40 transition-opacity"
                  >
                    Keep in Splitwise
                  </button>
                  <button
                    type="button"
                    disabled={unshareMutation.isPending}
                    onClick={() => setUnshareStep(null)}
                    className="text-xs text-fg-subtle hover:text-fg-muted transition-colors px-2"
                  >
                    Cancel
                  </button>
                </div>
                {unshareMutation.isError && (
                  <p className="text-xs text-danger-fg">{(unshareMutation.error as Error).message}</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowShareDialog(true)}
            disabled={groups.length === 0}
            className="text-xs text-accent font-medium hover:opacity-80 transition-opacity disabled:opacity-40"
          >
            {groups.length === 0 ? 'No groups found' : 'Share on Splitwise…'}
          </button>
        )}
      </div>

      {showShareDialog && status.splitwise_user_id != null && (
        <ShareExpenseDialog
          payment={payment}
          groups={groups}
          currentUserId={status.splitwise_user_id}
          onClose={() => setShowShareDialog(false)}
          onSuccess={(updated) => onPaymentUpdate?.(updated)}
        />
      )}
    </>
  )
}
