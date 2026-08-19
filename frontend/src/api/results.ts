import { api } from '@/api/client'
import type { PaginatedCases, ScanResults } from '@/types/results'

export function getScanResults(id: number): Promise<ScanResults> {
  return api<ScanResults>(`/scans/${id}/results`)
}

export function listScanCases(
  id: number,
  params: { page?: number; pageSize?: number; status?: string } = {}
): Promise<PaginatedCases> {
  const qs = new URLSearchParams()
  if (params.page) qs.set('page', String(params.page))
  if (params.pageSize) qs.set('page_size', String(params.pageSize))
  if (params.status && params.status !== 'all') qs.set('status', params.status)
  const suffix = qs.size ? `?${qs.toString()}` : ''
  return api<PaginatedCases>(`/scans/${id}/cases${suffix}`)
}
