import { api } from '@/api/client'
import type { DashboardData } from '@/types/dashboard'

export function getDashboard(): Promise<DashboardData> {
  return api<DashboardData>('/dashboard')
}
