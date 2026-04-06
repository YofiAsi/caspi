import type { AnalyticsGranularity } from '../types'
import { monthBounds } from './monthBounds'

type BoundableGranularity = Exclude<AnalyticsGranularity, 'lifetime'>

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function periodBounds(
  periodStart: string,
  granularity: BoundableGranularity,
): { dateFrom: string; dateTo: string } {
  const [y, m, d] = periodStart.split('-').map(Number)
  if (granularity === 'monthly') {
    const { start, end } = monthBounds(y, m)
    return { dateFrom: start, dateTo: end }
  }
  if (granularity === 'weekly') {
    const start = new Date(y, m - 1, d)
    const end = new Date(y, m - 1, d + 6)
    return { dateFrom: fmtDate(start), dateTo: fmtDate(end) }
  }
  if (granularity === 'quarterly') {
    const qStart = new Date(y, m - 1, 1)
    const qEnd = new Date(y, m + 2, 0) // last day of month+2
    return { dateFrom: fmtDate(qStart), dateTo: fmtDate(qEnd) }
  }
  // yearly
  return { dateFrom: `${y}-01-01`, dateTo: `${y}-12-31` }
}

export function formatPeriodLabel(
  periodStart: string,
  granularity: AnalyticsGranularity,
): string {
  if (granularity === 'lifetime') return 'All time'
  const [y, m, d] = periodStart.split('-').map(Number)
  const fmt = new Intl.DateTimeFormat('en-GB', { month: 'short', day: 'numeric' })
  if (granularity === 'weekly') {
    const start = new Date(y, m - 1, d)
    const end = new Date(y, m - 1, d + 6)
    return `${fmt.format(start)} – ${fmt.format(end)}, ${y}`
  }
  if (granularity === 'monthly') {
    return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(
      new Date(y, m - 1, 1),
    )
  }
  if (granularity === 'quarterly') {
    const q = Math.ceil(m / 3)
    return `Q${q} ${y}`
  }
  return String(y)
}

export function formatPeriodAxisLabel(
  periodStart: string,
  granularity: BoundableGranularity,
): string {
  const [y, m, d] = periodStart.split('-').map(Number)
  const currentYear = new Date().getFullYear()
  const yearSuffix = y !== currentYear ? ` '${String(y).slice(-2)}` : ''
  if (granularity === 'weekly') {
    const date = new Date(y, m - 1, d)
    const ml = new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(date)
    return `${ml} ${d}${yearSuffix}`
  }
  if (granularity === 'monthly') {
    const date = new Date(y, m - 1, 1)
    const ml = new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(date)
    return `${ml}${yearSuffix}`
  }
  if (granularity === 'quarterly') {
    const q = Math.ceil(m / 3)
    return `Q${q}${yearSuffix}`
  }
  return String(y)
}
