import { api } from './client'
import type { MonthlyRoutine, RoutineByTag } from './types'

export const analyticsApi = {
  routineMonthly: (start_date: string, end_date: string) =>
    api.get<MonthlyRoutine>(`/analytics/routine/monthly?start_date=${start_date}&end_date=${end_date}`),
  routineByTag: (start_date: string, end_date: string) =>
    api.get<RoutineByTag>(`/analytics/routine/by-tag?start_date=${start_date}&end_date=${end_date}`),
}
