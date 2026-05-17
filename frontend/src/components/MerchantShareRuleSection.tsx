import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Payment, SplitwiseRuleBody } from '../types'
import { api } from '../api/client'
import { useSplitwiseGroups, useSplitwiseStatus } from '../hooks/useSplitwise'
import { MerchantShareRuleDialog } from './MerchantShareRuleDialog'

interface Props {
  payment: Payment
}

export function MerchantShareRuleSection({ payment }: Props) {
  const queryClient = useQueryClient()
  const { data: status } = useSplitwiseStatus()
  const { data: groupsData } = useSplitwiseGroups(status?.connected ?? false)
  const groups = groupsData?.groups ?? []

  const [showDialog, setShowDialog] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const { data: rule, isLoading } = useQuery({
    queryKey: ['splitwise', 'rules', payment.merchant_id],
    queryFn: () => api.splitwise.getRule(payment.merchant_id),
    enabled: status?.connected ?? false,
    staleTime: 60_000,
  })

  const saveMutation = useMutation({
    mutationFn: (body: SplitwiseRuleBody) =>
      api.splitwise.putRule(payment.merchant_id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['splitwise', 'rules', payment.merchant_id] })
      setShowDialog(false)
      setSaveError(null)
    },
    onError: (e: Error) => setSaveError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.splitwise.deleteRule(payment.merchant_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['splitwise', 'rules', payment.merchant_id] })
    },
  })

  const toggleEnabled = () => {
    if (!rule) return
    saveMutation.mutate({ ...rule, enabled: !rule.enabled })
  }

  if (!status?.connected) return null
  if (isLoading) return null

  return (
    <>
      <div className="border-t border-border-subtle pt-3 mt-1">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] font-semibold text-fg-muted uppercase tracking-wide">Auto-share rule</p>
          <button
            type="button"
            onClick={() => { setSaveError(null); setShowDialog(true) }}
            className="text-[11px] text-accent hover:opacity-80 transition-opacity"
          >
            {rule ? 'Edit' : 'Add rule'}
          </button>
        </div>

        {rule ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-fg-secondary truncate">
              {rule.enabled ? (
                <span className="text-success-fg">Active · </span>
              ) : (
                <span className="text-fg-subtle">Disabled · </span>
              )}
              {groups.find((g) => g.id === rule.splitwise_group_id)?.name ?? `Group ${rule.splitwise_group_id}`}
              {' · '}
              {rule.split_method === 'equal' ? 'Equal' : rule.split_method === 'percentage' ? 'Percentage' : 'Exact'}
              {' · '}
              {rule.currency}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={toggleEnabled}
                disabled={saveMutation.isPending}
                className="text-[11px] text-fg-subtle hover:text-fg-muted transition-colors disabled:opacity-40"
              >
                {rule.enabled ? 'Disable' : 'Enable'}
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="text-[11px] text-danger-fg hover:opacity-80 transition-opacity disabled:opacity-40"
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-fg-subtle">No rule — future expenses won't be auto-shared.</p>
        )}
      </div>

      {showDialog && status.splitwise_user_id != null && (
        <MerchantShareRuleDialog
          merchantId={payment.merchant_id}
          merchantName={payment.display_name}
          groups={groups}
          currentUserId={status.splitwise_user_id}
          existing={rule ?? null}
          onSave={(body) => saveMutation.mutate(body)}
          onClose={() => setShowDialog(false)}
          isSaving={saveMutation.isPending}
          saveError={saveError}
        />
      )}
    </>
  )
}
