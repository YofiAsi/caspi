import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { PaymentFilters } from '../types'

interface Props {
  value: PaymentFilters
  onChange: (value: PaymentFilters) => void
}

const inputClass =
  'text-xs border border-border rounded-lg px-2.5 py-1.5 bg-input-bg text-fg focus:outline-none focus:ring-2 focus:ring-ring'

const selectClass = `w-full min-h-[88px] ${inputClass}`

export function FilterBar({ value, onChange }: Props) {
  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => api.tags.list(),
    staleTime: 120_000,
  })
  const tagOptions = tagsData?.tags ?? []

  const includeSet = new Set(value.includeTags ?? [])
  const excludeSet = new Set(value.excludeTags ?? [])

  const handleDateChange = (field: 'dateFrom' | 'dateTo', v: string) => {
    onChange({
      ...value,
      [field]: v || undefined,
    })
  }

  const handleAmountChange = (field: 'amountMin' | 'amountMax', v: string) => {
    const num = v === '' ? undefined : Number(v)
    onChange({
      ...value,
      [field]: Number.isFinite(num as number) ? (num as number) : undefined,
    })
  }

  return (
    <div className="border-b border-border px-4 py-3 space-y-3 bg-surface">
      <div className="flex flex-wrap gap-2">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-fg-muted mb-1">Include tags</label>
          <select
            multiple
            className={selectClass}
            value={[...includeSet]}
            onChange={(e) => {
              const next = new Set([...e.target.selectedOptions].map((o) => o.value))
              onChange({
                ...value,
                includeTags: next.size > 0 ? [...next] : undefined,
              })
            }}
          >
            {tagOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-fg-muted mb-1">Exclude tags</label>
          <select
            multiple
            className={selectClass}
            value={[...excludeSet]}
            onChange={(e) => {
              const next = new Set([...e.target.selectedOptions].map((o) => o.value))
              onChange({
                ...value,
                excludeTags: next.size > 0 ? [...next] : undefined,
              })
            }}
          >
            {tagOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-fg-muted">Date</label>
          <input
            type="date"
            value={value.dateFrom ?? ''}
            onChange={(e) => handleDateChange('dateFrom', e.target.value)}
            className={`text-xs border border-border rounded-lg px-2 py-1.5 bg-input-bg text-fg focus:outline-none focus:ring-2 focus:ring-ring`}
          />
          <span className="text-xs text-fg-subtle">to</span>
          <input
            type="date"
            value={value.dateTo ?? ''}
            onChange={(e) => handleDateChange('dateTo', e.target.value)}
            className={`text-xs border border-border rounded-lg px-2 py-1.5 bg-input-bg text-fg focus:outline-none focus:ring-2 focus:ring-ring`}
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-fg-muted">Amount</label>
          <input
            type="number"
            placeholder="min"
            inputMode="decimal"
            className={`w-20 ${inputClass}`}
            onChange={(e) => handleAmountChange('amountMin', e.target.value)}
          />
          <span className="text-xs text-fg-subtle">to</span>
          <input
            type="number"
            placeholder="max"
            inputMode="decimal"
            className={`w-20 ${inputClass}`}
            onChange={(e) => handleAmountChange('amountMax', e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
