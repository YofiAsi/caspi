import type { PaymentFilters } from '../types'
import { getCurrentMonthValue, getMonthBounds } from './monthBounds'

export type AnalysisPreset = {
  id: string
  name: string
  filters: PaymentFilters
}

const STORAGE_KEY = 'caspi-analysis-presets-v1'

export function makeDefaultPreset(): AnalysisPreset {
  const month = getCurrentMonthValue()
  return {
    id: crypto.randomUUID(),
    name: 'Default',
    filters: {
      ...getMonthBounds(month),
      taggedOnly: false,
    },
  }
}

export function loadPresetsFromStorage(): AnalysisPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [makeDefaultPreset()]
    const parsed = JSON.parse(raw) as { presets?: unknown }
    if (!Array.isArray(parsed.presets) || parsed.presets.length === 0) {
      return [makeDefaultPreset()]
    }
    return parsed.presets.filter(isValidPreset) as AnalysisPreset[]
  } catch {
    return [makeDefaultPreset()]
  }
}

function isValidPreset(x: unknown): x is AnalysisPreset {
  if (x === null || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return typeof o.id === 'string' && typeof o.name === 'string' && typeof o.filters === 'object' && o.filters !== null
}

export function savePresetsToStorage(presets: AnalysisPreset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ presets }))
  } catch {
    /* ignore quota */
  }
}
