import { monthBounds } from './monthBounds'

export type TimeGranularity = 'daily' | 'weekly' | 'monthly'

function parseYMD(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return { y, m, d }
}

export function periodRangeFilter(
  periodStart: string,
  g: TimeGranularity,
): { dateFrom: string; dateTo: string } {
  const { y, m, d } = parseYMD(periodStart)
  const pad = (n: number) => String(n).padStart(2, '0')
  if (g === 'daily') {
    const ds = `${y}-${pad(m)}-${pad(d)}`
    return { dateFrom: ds, dateTo: ds }
  }
  if (g === 'monthly') {
    const { start, end } = monthBounds(y, m)
    return { dateFrom: start, dateTo: end }
  }
  const start = new Date(y, m - 1, d)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return {
    dateFrom: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    dateTo: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
  }
}
