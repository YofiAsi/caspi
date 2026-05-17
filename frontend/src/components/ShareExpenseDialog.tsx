import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Payment, SplitMethod, SplitwiseGroup } from '../types'
import { api } from '../api/client'
import { formatCurrency } from '../utils/currency'

const CURRENCIES = ['ILS', 'USD', 'EUR']

interface Props {
  payment: Payment
  groups: SplitwiseGroup[]
  currentUserId: number
  onClose: () => void
  onSuccess: (payment: Payment) => void
}

interface MemberWeight {
  user_id: number
  value: string
}

export function ShareExpenseDialog({ payment, groups, currentUserId, onClose, onSuccess }: Props) {
  const queryClient = useQueryClient()

  const defaultCurrencies = Array.from(
    new Set([
      'ILS',
      payment.currency !== 'ILS' ? payment.currency : null,
    ].filter(Boolean) as string[]),
  )
  const currencyOptions = Array.from(new Set([...defaultCurrencies, ...CURRENCIES]))

  const [groupId, setGroupId] = useState<number | null>(groups[0]?.id ?? null)
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal')
  const [currency, setCurrency] = useState(payment.currency)
  const [amount, setAmount] = useState(String(payment.amount))
  const [selectedMembers, setSelectedMembers] = useState<number[]>(() => {
    const g = groups[0]
    return g ? g.members.map((m) => m.user_id) : []
  })
  const [weights, setWeights] = useState<MemberWeight[]>(() => {
    const g = groups[0]
    return g ? g.members.map((m) => ({ user_id: m.user_id, value: '' })) : []
  })
  const [error, setError] = useState<string | null>(null)

  const selectedGroup = groups.find((g) => g.id === groupId) ?? null

  const handleGroupChange = (id: number) => {
    setGroupId(id)
    const g = groups.find((gr) => gr.id === id)
    if (g) {
      setSelectedMembers(g.members.map((m) => m.user_id))
      setWeights(g.members.map((m) => ({ user_id: m.user_id, value: '' })))
    }
  }

  const toggleMember = (uid: number) => {
    setSelectedMembers((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid],
    )
  }

  const setWeight = (uid: number, val: string) => {
    setWeights((prev) => prev.map((w) => (w.user_id === uid ? { ...w, value: val } : w)))
  }

  const buildSplitParams = (): { ok: true; params: object } | { ok: false; msg: string } => {
    if (splitMethod === 'equal') {
      if (selectedMembers.length === 0) return { ok: false, msg: 'Select at least one member' }
      return { ok: true, params: { member_ids: selectedMembers } }
    }
    const activeWeights = weights.filter((w) => selectedMembers.includes(w.user_id))
    if (activeWeights.length === 0) return { ok: false, msg: 'Select at least one member' }
    const values = activeWeights.map((w) => ({ user_id: w.user_id, value: parseFloat(w.value) || 0 }))
    const total = values.reduce((s, v) => s + v.value, 0)
    if (splitMethod === 'percentage') {
      if (Math.abs(total - 100) > 0.01) return { ok: false, msg: `Percentages must sum to 100 (currently ${total.toFixed(1)})` }
    } else {
      const amt = parseFloat(amount)
      if (Math.abs(total - amt) > 0.01) return { ok: false, msg: `Amounts must sum to ${formatCurrency(amt, currency)} (currently ${total.toFixed(2)})` }
    }
    return { ok: true, params: { members: values } }
  }

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const sp = buildSplitParams()
      if (!sp.ok) throw new Error(sp.msg)
      if (!groupId) throw new Error('Select a group')
      const res = await api.splitwise.share({
        payment_id: payment.payment_id,
        amount: parseFloat(amount),
        currency,
        group_id: groupId,
        split_method: splitMethod,
        split_params: sp.params,
        description: payment.display_name,
        date: payment.date,
      })
      // update payment share fields via patch to keep local state in sync
      return api.payments.patch(payment.payment_id, {
        share_amount: parseFloat(res.my_share_amount),
        share_currency: res.my_share_currency,
      })
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['splitwise', 'status'] })
      onSuccess(updated)
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  const memberName = (uid: number) => {
    const m = selectedGroup?.members.find((x) => x.user_id === uid)
    if (!m) return `User ${uid}`
    return `${m.first_name}${m.last_name ? ` ${m.last_name}` : ''}${uid === currentUserId ? ' (you)' : ''}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4">
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md flex flex-col overflow-hidden max-h-[90vh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border-subtle shrink-0">
          <h2 className="text-base font-semibold text-fg">Share on Splitwise</h2>
          <button onClick={onClose} className="text-fg-subtle hover:text-fg-muted transition-colors p-1 rounded-lg hover:bg-hover-surface" aria-label="Close">✕</button>
        </div>

        <div className="overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {/* Amount + currency */}
          <div className="flex gap-2">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-xs font-medium text-fg-muted">Amount</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring bg-input-bg text-fg"
              />
            </div>
            <div className="flex flex-col gap-1 w-24">
              <label className="text-xs font-medium text-fg-muted">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full text-sm border border-border rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-ring bg-input-bg text-fg"
              >
                {currencyOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Group */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-fg-muted">Group</label>
            <select
              value={groupId ?? ''}
              onChange={(e) => handleGroupChange(Number(e.target.value))}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring bg-input-bg text-fg"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          {/* Split method */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-fg-muted">Split</label>
            <div className="flex rounded-lg border border-border overflow-hidden text-sm">
              {(['equal', 'percentage', 'shares'] as SplitMethod[]).map((m, i) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSplitMethod(m)}
                  className={`flex-1 py-1.5 font-medium transition-colors capitalize ${
                    i > 0 ? 'border-l border-border' : ''
                  } ${splitMethod === m ? 'bg-accent-soft text-accent-soft-fg' : 'text-fg-muted hover:bg-hover-surface'}`}
                >
                  {m === 'shares' ? 'Exact' : m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Members */}
          {selectedGroup && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-fg-muted">Members</label>
              <div className="flex flex-col gap-1.5">
                {selectedGroup.members.map((m) => {
                  const checked = selectedMembers.includes(m.user_id)
                  const w = weights.find((x) => x.user_id === m.user_id)
                  return (
                    <div key={m.user_id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`member-${m.user_id}`}
                        checked={checked}
                        onChange={() => toggleMember(m.user_id)}
                        className="accent-accent"
                      />
                      <label htmlFor={`member-${m.user_id}`} className="flex-1 text-sm text-fg truncate">
                        {memberName(m.user_id)}
                      </label>
                      {splitMethod !== 'equal' && checked && (
                        <input
                          type="number"
                          min="0"
                          step={splitMethod === 'percentage' ? '1' : '0.01'}
                          placeholder={splitMethod === 'percentage' ? '%' : currency}
                          value={w?.value ?? ''}
                          onChange={(e) => setWeight(m.user_id, e.target.value)}
                          className="w-20 text-sm border border-border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring bg-input-bg text-fg"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-danger-fg">{error}</p>}

          <button
            type="button"
            onClick={() => { setError(null); mutate() }}
            disabled={isPending || !groupId}
            className="w-full py-2.5 rounded-xl bg-accent text-on-primary text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-40"
          >
            {isPending ? 'Sharing…' : 'Share'}
          </button>
        </div>
      </div>
    </div>
  )
}
