import humps from 'humps'

import { useSessionStore } from '@/stores/useSessionStore'

/** Normalized API error: HTTP status + backend `detail` message. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
}

/**
 * Single API entry point. Cross-cutting concerns:
 * - base path /api (same origin; dev is proxied by Vite, see ADR-0004)
 * - JWT from the session store, injected as Bearer header
 * - snake_case → camelCase conversion (humps)
 * - error normalization: non-2xx → ApiError(status, detail)
 * - 401 → clear session (session expired / invalid token)
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = useSessionStore.getState().token
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (res.status === 401) {
    useSessionStore.getState().clearSession()
  }

  if (!res.ok) {
    let detail = res.statusText
    try {
      const data = (await res.json()) as { detail?: unknown }
      if (data.detail !== undefined) {
        detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)
      }
    } catch {
      // non-JSON error body; keep statusText
    }
    throw new ApiError(res.status, detail)
  }

  if (res.status === 204) return undefined as T
  const data = (await res.json()) as unknown
  return humps.camelizeKeys(data) as T
}
