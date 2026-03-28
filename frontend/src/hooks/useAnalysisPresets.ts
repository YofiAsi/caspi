import { useCallback, useEffect, useState } from 'react'
import type { PaymentFilters } from '../types'
import type { AnalysisPreset } from '../lib/analysisPresetsStorage'
import { loadPresetsFromStorage, makeDefaultPreset, savePresetsToStorage } from '../lib/analysisPresetsStorage'

export function useAnalysisPresets() {
  const [presets, setPresets] = useState<AnalysisPreset[]>(() => loadPresetsFromStorage())

  useEffect(() => {
    savePresetsToStorage(presets)
  }, [presets])

  const updatePresetFilters = useCallback((id: string, filters: PaymentFilters) => {
    setPresets((ps) => ps.map((p) => (p.id === id ? { ...p, filters: { ...filters } } : p)))
  }, [])

  const addPreset = useCallback((filters: PaymentFilters, suggestedName?: string) => {
    const id = crypto.randomUUID()
    setPresets((ps) => {
      const name = suggestedName ?? `View ${ps.length + 1}`
      return [...ps, { id, name, filters: { ...filters } }]
    })
    return id
  }, [])

  const renamePreset = useCallback((id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setPresets((ps) => ps.map((p) => (p.id === id ? { ...p, name: trimmed } : p)))
  }, [])

  const deletePreset = useCallback((id: string) => {
    setPresets((ps) => {
      const next = ps.filter((p) => p.id !== id)
      if (next.length === 0) return [makeDefaultPreset()]
      return next
    })
  }, [])

  return { presets, updatePresetFilters, addPreset, renamePreset, deletePreset }
}
