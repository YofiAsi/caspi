import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { analyticsApi } from '../api/analytics'
import { collectionsApi } from '../api/collections'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import EmptyState from '../components/shared/EmptyState'

type SubView = 'routine' | 'collections'

function last6MonthsRange() {
  const end = new Date()
  const start = new Date()
  start.setMonth(start.getMonth() - 5)
  start.setDate(1)
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

function fmtMonth(ym: string) {
  const [y, m] = ym.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-US', { month: 'short' })
}

export default function AnalyticsScreen() {
  const [subView, setSubView] = useState<SubView>('routine')

  return (
    <div className="flex h-full flex-col">
      <header className="bg-white px-4 pt-6 pb-3">
        <h1 className="text-xl font-bold text-zinc-900">Analytics</h1>
        <div className="mt-3 flex rounded-xl bg-zinc-100 p-1">
          {(['routine', 'collections'] as SubView[]).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => setSubView(v)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium capitalize transition-colors ${
                subView === v ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {subView === 'routine' ? <RoutineView /> : <CollectionsView />}
      </div>
    </div>
  )
}

function RoutineView() {
  const { start, end } = last6MonthsRange()

  const { data: monthly } = useQuery({
    queryKey: ['analytics', 'routine', 'monthly', start, end],
    queryFn: () => analyticsApi.routineMonthly(start, end),
  })

  const { data: byTag } = useQuery({
    queryKey: ['analytics', 'routine', 'by-tag', start, end],
    queryFn: () => analyticsApi.routineByTag(start, end),
  })

  const months = monthly?.months ?? []
  const tags = byTag?.tags ?? []
  const maxTotal = Math.max(...months.map(m => m.total_personal), 1)
  const currentMonth = months[months.length - 1]

  return (
    <div className="flex flex-col gap-6 px-4 py-4">
      {/* Bar chart */}
      {months.length > 0 ? (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Last 6 months</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={months} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="month"
                tickFormatter={fmtMonth}
                tick={{ fontSize: 11, fill: '#a1a1aa' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={v => `₪${Math.round(v / 1000)}k`}
                tick={{ fontSize: 11, fill: '#a1a1aa' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v) => fmtCurrency(Number(v))}
                labelFormatter={(label) => fmtMonth(String(label))}
                contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.1)', fontSize: 13 }}
              />
              <Bar dataKey="total_personal" radius={[6, 6, 0, 0]}>
                {months.map((m, i) => (
                  <Cell
                    key={m.month}
                    fill={i === months.length - 1 ? '#18181b' : '#e4e4e7'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState message="No routine expenses yet" />
      )}

      {/* Current month stats */}
      {currentMonth && (
        <div className="flex gap-3">
          <div className="flex-1 rounded-2xl bg-white p-4">
            <p className="text-xs text-zinc-400">This month</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-zinc-900">
              {fmtCurrency(currentMonth.total_personal)}
            </p>
          </div>
          <div className="flex-1 rounded-2xl bg-white p-4">
            <p className="text-xs text-zinc-400">Expenses</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-zinc-900">
              {currentMonth.expense_count}
            </p>
          </div>
        </div>
      )}

      {/* Tag breakdown */}
      {tags.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">By tag</p>
          <div className="flex flex-col gap-3">
            {tags.map(t => (
              <div key={t.tag_id} className="flex flex-col gap-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-zinc-800">{t.tag_name}</span>
                  <span className="tabular-nums text-zinc-600">{fmtCurrency(t.total_personal)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-2 rounded-full bg-zinc-800"
                    style={{ width: `${(t.total_personal / maxTotal) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CollectionsView() {
  const navigate = useNavigate()
  const { data: collections = [], isLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: () => collectionsApi.list(),
  })

  if (isLoading) return null

  if (collections.length === 0) {
    return <EmptyState message="No collections" detail="Assign expenses to a collection when tagging." />
  }

  return (
    <div className="flex flex-col gap-2 px-4 py-4">
      {collections.map(c => (
        <button
          key={c.id}
          type="button"
          onClick={() => navigate(`/analytics/collections/${c.id}`)}
          className="flex items-center justify-between rounded-2xl bg-white p-4 text-left active:bg-zinc-50"
        >
          <div>
            <p className="font-semibold text-zinc-900">{c.name}</p>
            {(c.start_date || c.end_date) && (
              <p className="mt-0.5 text-xs text-zinc-400">
                {c.start_date ?? '—'} → {c.end_date ?? '—'}
              </p>
            )}
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 4l4 4-4 4" />
          </svg>
        </button>
      ))}
    </div>
  )
}
