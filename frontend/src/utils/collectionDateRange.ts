function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatCollectionDateRange(
  first: string | null | undefined,
  last: string | null | undefined,
  locale = 'en-GB',
): string {
  if (!first || !last) return '—'
  const fmt = new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' })
  const a = parseLocalDate(first)
  const b = parseLocalDate(last)
  const now = new Date()
  const isPresent = b.getFullYear() === now.getFullYear() && b.getMonth() === now.getMonth()
  const left = fmt.format(a)
  const right = isPresent ? 'present' : fmt.format(b)
  return `${left} — ${right}`
}
