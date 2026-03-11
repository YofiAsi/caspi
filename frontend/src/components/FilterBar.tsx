import { useState } from 'react'
import type { PaymentFilters } from '../types'

interface Props {
  value: PaymentFilters
  onChange: (value: PaymentFilters) => void
}

export function FilterBar({ value, onChange }: Props) {
  const [includeInput, setIncludeInput] = useState('')
  const [excludeInput, setExcludeInput] = useState('')

  const applyTagInputs = () => {
    const includeTags = includeInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
    const excludeTags = excludeInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
    onChange({
      ...value,
      includeTags: includeTags.length > 0 ? includeTags : undefined,
      excludeTags: excludeTags.length > 0 ? excludeTags : undefined,
    })
  }

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
    <div className="border-b border-gray-200 px-4 py-3 space-y-3 bg-white">
      <div className="flex flex-wrap gap-2">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Include tags</label>
          <input
            type="text"
            value={includeInput}
            onChange={(e) => setIncludeInput(e.target.value)}
            onBlur={applyTagInputs}
            placeholder="food, travel"
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Exclude tags</label>
          <input
            type="text"
            value={excludeInput}
            onChange={(e) => setExcludeInput(e.target.value)}
            onBlur={applyTagInputs}
            placeholder="work, refund"
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600">Date</label>
          <input
            type="date"
            value={value.dateFrom ?? ''}
            onChange={(e) => handleDateChange('dateFrom', e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            value={value.dateTo ?? ''}
            onChange={(e) => handleDateChange('dateTo', e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600">Amount</label>
          <input
            type="number"
            placeholder="min"
            inputMode="decimal"
            className="w-20 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            onChange={(e) => handleAmountChange('amountMin', e.target.value)}
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="number"
            placeholder="max"
            inputMode="decimal"
            className="w-20 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            onChange={(e) => handleAmountChange('amountMax', e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
