import { api } from '@/api/client'
import type { PaginatedScans, Scan, ScanCreatePayload, ScanProgress } from '@/types/scans'

export function listScans(params: { page?: number; pageSize?: number } = {}): Promise<PaginatedScans> {
  const qs = new URLSearchParams()
  if (params.page) qs.set('page', String(params.page))
  if (params.pageSize) qs.set('page_size', String(params.pageSize))
  const suffix = qs.size ? `?${qs.toString()}` : ''
  return api<PaginatedScans>(`/scans${suffix}`)
}

export function getScan(id: number): Promise<Scan> {
  return api<Scan>(`/scans/${id}`)
}

export function getScanProgress(id: number): Promise<ScanProgress> {
  return api<ScanProgress>(`/scans/${id}/progress`)
}

export function createScan(payload: ScanCreatePayload): Promise<Scan> {
  return api<Scan>('/scans', { method: 'POST', body: payload })
}

export interface Attack {
  key: string
  name: string
  description: string
}

export function listAttacks(): Promise<Attack[]> {
  return api<Attack[]>('/attacks')
}

export function rerunScan(id: number): Promise<Scan> {
  return api<Scan>(`/scans/${id}/rerun`, { method: 'POST' })
}

export function listScanRuns(id: number): Promise<Scan[]> {
  return api<Scan[]>(`/scans/${id}/runs`)
}
