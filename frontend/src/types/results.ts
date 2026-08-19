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
