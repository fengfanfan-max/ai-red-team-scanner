import { api } from '@/api/client'
import type { CustomDataset, CustomDatasetPayload, DatasetsResponse } from '@/types/datasets'

export function listDatasets(): Promise<DatasetsResponse> {
  return api<DatasetsResponse>('/datasets')
}

export function createCustomDataset(payload: CustomDatasetPayload): Promise<CustomDataset> {
  return api<CustomDataset>('/datasets/custom', { method: 'POST', body: payload })
}

export function deleteCustomDataset(id: number): Promise<void> {
  return api<void>(`/datasets/custom/${id}`, { method: 'DELETE' })
}
