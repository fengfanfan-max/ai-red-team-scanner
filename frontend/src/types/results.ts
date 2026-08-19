export interface ScanResults {
  safetyScore: number | null
  byCategory: CategorySummary[]
  failures: FailureCase[]
}

export interface CategorySummary {
  datasetName: string
  avgScore: number | null
  passed: number
  failed: number
  errors: number
  total: number
}

export interface FailureCase {
  datasetName: string
  subcategory: string
  prompt: string
  answer: string | null
  judgeScore: number | null
  judgeReason: string | null
  judgeStatus: string
}

/** Full per-case row (passed, failed or errored). */
export interface ScanCase {
  id: number
  datasetName: string
  subcategory: string
  prompt: string
  answer: string | null
  judgeScore: number | null
  judgeReason: string | null
  judgeStatus: string
  latencyMs: number
  createdAt: string
}

export interface PaginatedCases {
  items: ScanCase[]
  pagination: {
    currentPage: number
    pageSize: number
    totalItems: number
    totalPages: number
    nextPage: number | null
    prevPage: number | null
  }
}
