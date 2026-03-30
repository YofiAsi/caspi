export type TagColorVariant = 'light' | 'dark'

const PALETTE_LIGHT: ReadonlyArray<{ bg: string; fg: string }> = [
  { bg: '#dbeafe', fg: '#1d4ed8' },
  { bg: '#cffafe', fg: '#0e7490' },
  { bg: '#ccfbf1', fg: '#0f766e' },
  { bg: '#d1fae5', fg: '#047857' },
  { bg: '#bbf7d0', fg: '#166534' },
  { bg: '#ecfccb', fg: '#4d7c0f' },
  { bg: '#d9f99d', fg: '#365314' },
  { bg: '#fef3c7', fg: '#b45309' },
  { bg: '#fde68a', fg: '#92400e' },
  { bg: '#ffedd5', fg: '#c2410c' },
  { bg: '#fed7aa', fg: '#9a3412' },
  { bg: '#fecaca', fg: '#b91c1c' },
  { bg: '#fce7f3', fg: '#be185d' },
  { bg: '#fbcfe8', fg: '#9d174d' },
  { bg: '#f3e8ff', fg: '#7e22ce' },
  { bg: '#e9d5ff', fg: '#6b21a8' },
  { bg: '#ddd6fe', fg: '#5b21b6' },
  { bg: '#e0e7ff', fg: '#4338ca' },
  { bg: '#bfdbfe', fg: '#1e40af' },
  { bg: '#a5f3fc', fg: '#155e75' },
  { bg: '#fde047', fg: '#713f12' },
  { bg: '#fecdd3', fg: '#9f1239' },
  { bg: '#e2e8f0', fg: '#334155' },
  { bg: '#d1d5db', fg: '#1f2937' },
]

const PALETTE_DARK: ReadonlyArray<{ bg: string; fg: string }> = [
  { bg: 'rgb(30 58 138 / 0.45)', fg: '#93c5fd' },
  { bg: 'rgb(19 78 74 / 0.45)', fg: '#5eead4' },
  { bg: 'rgb(17 94 89 / 0.45)', fg: '#5eead4' },
  { bg: 'rgb(6 78 59 / 0.45)', fg: '#6ee7b7' },
  { bg: 'rgb(22 101 52 / 0.45)', fg: '#86efac' },
  { bg: 'rgb(63 98 18 / 0.45)', fg: '#bef264' },
  { bg: 'rgb(54 83 20 / 0.45)', fg: '#d9f99d' },
  { bg: 'rgb(120 53 15 / 0.45)', fg: '#fcd34d' },
  { bg: 'rgb(113 63 18 / 0.45)', fg: '#fcd34d' },
  { bg: 'rgb(124 45 18 / 0.45)', fg: '#fdba74' },
  { bg: 'rgb(124 45 18 / 0.45)', fg: '#fdba74' },
  { bg: 'rgb(127 29 29 / 0.45)', fg: '#fca5a5' },
  { bg: 'rgb(131 24 67 / 0.45)', fg: '#f9a8d4' },
  { bg: 'rgb(131 24 67 / 0.45)', fg: '#f9a8d4' },
  { bg: 'rgb(88 28 135 / 0.45)', fg: '#d8b4fe' },
  { bg: 'rgb(88 28 135 / 0.45)', fg: '#d8b4fe' },
  { bg: 'rgb(76 29 149 / 0.45)', fg: '#c4b5fd' },
  { bg: 'rgb(49 46 129 / 0.45)', fg: '#a5b4fc' },
  { bg: 'rgb(30 58 138 / 0.45)', fg: '#93c5fd' },
  { bg: 'rgb(21 94 117 / 0.45)', fg: '#67e8f9' },
  { bg: 'rgb(113 63 18 / 0.45)', fg: '#fde047' },
  { bg: 'rgb(136 19 55 / 0.45)', fg: '#fda4af' },
  { bg: 'rgb(51 65 85 / 0.5)', fg: '#cbd5e1' },
  { bg: 'rgb(63 63 70 / 0.6)', fg: '#e4e4e7' },
]

function fnv1a32(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase()
}

function paletteFor(variant: TagColorVariant) {
  return variant === 'dark' ? PALETTE_DARK : PALETTE_LIGHT
}

export function getTagChipStyle(
  tag: string,
  variant: TagColorVariant = 'light',
): { backgroundColor: string; color: string } {
  const n = normalizeTag(tag)
  if (!n) {
    return variant === 'dark'
      ? { backgroundColor: 'rgb(39 39 42 / 0.9)', color: '#a1a1aa' }
      : { backgroundColor: '#f1f5f9', color: '#475569' }
  }
  const pair = paletteFor(variant)[fnv1a32(n) % PALETTE_LIGHT.length]
  return { backgroundColor: pair.bg, color: pair.fg }
}

export function getTagAccentColor(tag: string, variant: TagColorVariant = 'light'): string {
  const n = normalizeTag(tag)
  if (!n) return variant === 'dark' ? '#a1a1aa' : '#64748b'
  return paletteFor(variant)[fnv1a32(n) % PALETTE_LIGHT.length].fg
}
