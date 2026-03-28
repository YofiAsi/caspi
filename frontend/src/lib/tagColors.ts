const PALETTE: ReadonlyArray<{ bg: string; fg: string }> = [
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

export function getTagChipStyle(tag: string): { backgroundColor: string; color: string } {
  const n = normalizeTag(tag)
  if (!n) {
    return { backgroundColor: '#f1f5f9', color: '#475569' }
  }
  const pair = PALETTE[fnv1a32(n) % PALETTE.length]
  return { backgroundColor: pair.bg, color: pair.fg }
}

export function getTagAccentColor(tag: string): string {
  const n = normalizeTag(tag)
  if (!n) return '#64748b'
  return PALETTE[fnv1a32(n) % PALETTE.length].fg
}
