import { api } from '@/api/client'
import type { ScanResults } from '@/types/results'

export function getScanResults(id: number): Promise<ScanResults> {
  return api<ScanResults>(`/scans/${id}/results`)
}
