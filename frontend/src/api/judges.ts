import { api } from '@/api/client'
import type { JudgeModel, JudgePayload } from '@/types/judges'

export function listJudges(): Promise<JudgeModel[]> {
  return api<JudgeModel[]>('/judges')
}

export function createJudge(payload: JudgePayload): Promise<JudgeModel> {
  return api<JudgeModel>('/judges', { method: 'POST', body: payload })
}

export function updateJudge(id: number, payload: Partial<JudgePayload>): Promise<JudgeModel> {
  return api<JudgeModel>(`/judges/${id}`, { method: 'PATCH', body: payload })
}

export function deleteJudge(id: number): Promise<void> {
  return api<void>(`/judges/${id}`, { method: 'DELETE' })
}
