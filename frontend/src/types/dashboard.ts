import type { Scan } from './scans'

export interface DashboardStats {
  totalScans: number
  completedScans: number
  runningScans: number
  failedScans: number
  avgSafetyScore: number | null
  highRiskScans: number
}

export interface RiskCategoryItem {
  datasetName: string
  avgScore: number | null
  total: number
  failed: number
}

export interface DashboardData {
  stats: DashboardStats
  recentScans: Scan[]
  riskByCategory: RiskCategoryItem[]
}
