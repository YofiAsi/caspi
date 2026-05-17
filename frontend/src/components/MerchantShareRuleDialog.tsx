import { useState } from 'react'
import type { SplitMethod, SplitwiseGroup, SplitwiseRule } from '../types'

const CURRENCIES = ['ILS', 'USD', 'EUR']

interface Props {
  merchantId: string
  merchantName: string
  groups: SplitwiseGroup[]
  currentUserId: number
  existing: SplitwiseRule | null
  onSave: (body: {
    enabled: boolean
    splitwise_group_id: number
    split_method: SplitMethod
    split_params: object
    currency: string
  }) => void
  onClose: () => void
  isSaving: boolean
  saveError: string | null
}

interface MemberWeight {
  user_id: number
  value: string
}

export function MerchantShareRuleDialog({
  merchantName,
  groups,
  currentUserId,
  existing,
  onSave,
  onClose,
  isSaving,
  saveError,
}: Props) {
  const [enabled, setEnabled] = useState(existing?.enabled ?? true)
  const [groupId, setGroupId] = useState<number>(
    existing?.splitwise_group_id ?? groups[0]?.id ?? 0,
  )
  const [splitMethod, setSplitMethod] = useState<SplitMethod>(existing?.split_method ?? 'equal')
  const [currency, setCurrency] = useState(existing?.currency ?? 'ILS')
  const [selectedMembers, setSelectedMembers] = useState<number[]>(() => {
    if (existing?.split_method === 'equal') {
      const p = existing.split_params as { member_ids?: number[] }
      return p.member_ids ?? groups.find((g) => g.id === (existing?.splitwise_group_id ?? groups[0]?.id))?.members.map((m) => m.user_id) ?? []
    }
    const g = groups.find((gr) => gr.id === (existing?.splitwise_group_id ?? groups[0]?.id))
    return g?.members.map((m) => m.user_id) ?? []
  })
  const [weights, setWeights] = useState<MemberWeight[]>(() => {
    const g = groups.find((gr) => gr.id === (existing?.splitwise_group_id ?? groups[0]?.id))
    if (!g) return []
    if (existing?.split_method === 'percentage' || existing?.split_method === 'shares') {
      const p = existing.split_params as { members?: { user_id: number; value: number }[] }
      return g.members.map((m) => {
        const found = p.members?.find((x) => x.user_id === m.user_id)
        return { user_id: m.user_id, value: found ? String(found.value) : '' }
      })
    }
    return g.members.map((m) => ({ user_id: m.user_id, value: '' }))
  })
  const [validationError, setValidationError] = useState<string | null>(null)

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

  const memberName = (uid: number) => {
    const m = selectedGroup?.members.find((x) => x.user_id === uid)
    if (!m) return `User ${uid}`
    return `${m.first_name}${m.last_name ? ` ${m.last_name}` : ''}${uid === currentUserId ? ' (you)' : ''}`
  }

  const handleSave = () => {
    setValidationError(null)
    let split_params: object
    if (splitMethod === 'equal') {
      if (selectedMembers.length === 0) { setValidationError('Select at least one member'); return }
      split_params = { member_ids: selectedMembers }
    } else {
      const activeWeights = weights.filter((w) => selectedMembers.includes(w.user_id))
      if (activeWeights.length === 0) { setValidationError('Select at least one member'); return }
      const values = activeWeights.map((w) => ({ user_id: w.user_id, value: parseFloat(w.value) || 0 }))
      if (splitMethod === 'percentage') {
        const total = values.reduce((s, v) => s + v.value, 0)
        if (Math.abs(total - 100) > 0.01) { setValidationError(`Percentages must sum to 100 (currently ${total.toFixed(1)})`); return }
      }
      split_params = { members: values }
    }
    onSave({ enabled, splitwise_group_id: groupId, split_method: splitMethod, split_params, currency })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4">
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md flex flex-col overflow-hidden max-h-[90vh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border-subtle shrink-0">
          <h2 className="text-base font-semibold text-fg truncate">Auto-share: {merchantName}</h2>
          <button onClick={onClose} className="text-fg-subtle hover:text-fg-muted transition-colors p-1 rounded-lg hover:bg-hover-surface shrink-0" aria-label="Close">✕</button>
        </div>

        <div className="overflow-y-auto px-5 py-4 flex flex-col gap-4">
          <p className="text-xs text-fg-muted">
            Future expenses from this merchant will be automatically shared. Existing expenses are unaffected.
          </p>

          {/* Enabled toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-fg">Enable rule</span>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-accent' : 'bg-muted'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Currency */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-fg-muted">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring bg-input-bg text-fg"
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Group */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-fg-muted">Group</label>
            <select
              value={groupId}
              onChange={(e) => handleGroupChange(Number(e.target.value))}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring bg-input-bg text-fg"
            >
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
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
                  className={`flex-1 py-1.5 font-medium transition-colors capitalize ${i > 0 ? 'border-l border-border' : ''} ${splitMethod === m ? 'bg-accent-soft text-accent-soft-fg' : 'text-fg-muted hover:bg-hover-surface'}`}
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
                      <input type="checkbox" id={`rule-member-${m.user_id}`} checked={checked} onChange={() => toggleMember(m.user_id)} className="accent-accent" />
                      <label htmlFor={`rule-member-${m.user_id}`} className="flex-1 text-sm text-fg truncate">{memberName(m.user_id)}</label>
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

          {(validationError || saveError) && (
            <p className="text-xs text-danger-fg">{validationError ?? saveError}</p>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-2.5 rounded-xl bg-accent text-on-primary text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-40"
          >
            {isSaving ? 'Saving…' : 'Save rule'}
          </button>
        </div>
      </div>
    </div>
  )
}
