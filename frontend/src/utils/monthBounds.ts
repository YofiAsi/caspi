export function currentYearMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function parseYearMonth(ym: string): { year: number; month: number } {
  const [y, m] = ym.split('-').map(Number)
  return { year: y, month: m }
}

export function monthBounds(year: number, month: number): { start: string; end: string } {
  const first = new Date(year, month - 1, 1)
  const last = new Date(year, month, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    start: `${first.getFullYear()}-${pad(first.getMonth() + 1)}-${pad(first.getDate())}`,
    end: `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`,
  }
}

export function formatYearMonthLabel(ym: string, locale = 'en-US'): string {
  const { year, month } = parseYearMonth(ym)
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  )
}
