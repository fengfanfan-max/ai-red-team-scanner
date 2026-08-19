export type ScanStatus = 'pending' | 'running' | 'failed' | 'completed'

export interface DatasetRef {
  source: 'builtin' | 'custom'
  ref: string
}

export interface Scan {
  id: number
  name: string
  status: ScanStatus
  applicationId: number
  algorithm: string
  datasets: DatasetRef[]
  concurrency: number
  qpm: number
  failThreshold: number
  totalCases: number
  completedCases: number
  passedCases: number
  failedCases: number
  errorCases: number
  safetyScore: number | null
  errorMessage: string | null
  progressPct: number
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
}

export interface ScanProgress {
  id: number
  status: ScanStatus
  progressPct: number
  completedCases: number
  totalCases: number
  passedCases: number
  failedCases: number
  errorCases: number
  remainingTimeS: number | null
  safetyScore: number | null
  errorMessage: string | null
}

export interface PaginationInfo {
  currentPage: number
  pageSize: number
  totalItems: number
  totalPages: number
  nextPage: number | null
  prevPage: number | null
}

export interface PaginatedScans {
  items: Scan[]
  pagination: PaginationInfo
}

export interface ScanCreatePayload {
  name: string
  application_id: number
  algorithm: string
  datasets: DatasetRef[]
  concurrency: number
  qpm: number
  fail_threshold: number
  judge?: { base_url: string; model: string; api_key: string }
}
