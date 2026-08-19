import { api } from '@/api/client'
import type { AIApplication, ApplicationPayload, TestChatResult } from '@/types/applications'

export function listApplications(): Promise<AIApplication[]> {
  return api<AIApplication[]>('/applications')
}

export function createApplication(payload: ApplicationPayload): Promise<AIApplication> {
  return api<AIApplication>('/applications', { method: 'POST', body: payload })
}

export function updateApplication(
  id: number,
  payload: Partial<ApplicationPayload>
): Promise<AIApplication> {
  return api<AIApplication>(`/applications/${id}`, { method: 'PATCH', body: payload })
}

export function deleteApplication(id: number): Promise<void> {
  return api<void>(`/applications/${id}`, { method: 'DELETE' })
}

export function testChat(id: number, message: string): Promise<TestChatResult> {
  return api<TestChatResult>(`/applications/${id}/test-chat`, {
    method: 'POST',
    body: { message },
  })
}
