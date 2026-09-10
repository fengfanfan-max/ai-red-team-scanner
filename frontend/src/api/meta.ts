import { api } from '@/api/client'

export interface AppMeta {
  app: string
  version: string
  simulateScan: boolean
  authMode: string
}

export function getMeta(): Promise<AppMeta> {
  return api<AppMeta>('/meta')
}
