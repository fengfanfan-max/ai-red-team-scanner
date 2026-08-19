import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api, ApiError } from '@/api/client'
import { useSessionStore } from '@/stores/useSessionStore'

function mockFetchOnce(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    )
  )
}

describe('api client', () => {
  beforeEach(() => {
    localStorage.clear()
    useSessionStore.setState({ token: null, user: null, booted: false })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('camelizes snake_case response keys', async () => {
    mockFetchOnce(200, { access_token: 'abc', user: { id: 1, created_at: '2026-01-01' } })
    const data = await api<{ accessToken: string; user: { createdAt: string } }>('/auth/login', {
      method: 'POST',
      body: { email: 'a@b.c', password: 'x' },
    })
    expect(data.accessToken).toBe('abc')
    expect(data.user.createdAt).toBe('2026-01-01')
  })

  it('attaches the Bearer token from the session store', async () => {
    useSessionStore.getState().setSession('my-jwt', { id: 1, email: 'a@b.c', name: 'A' })
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await api('/auth/me')
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer my-jwt')
  })

  it('normalizes error detail into ApiError', async () => {
    mockFetchOnce(401, { detail: 'Invalid email or password' })
    const err = await api('/auth/login', { method: 'POST', body: {} }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(401)
    expect((err as ApiError).message).toBe('Invalid email or password')
  })

  it('clears the session on 401', async () => {
    useSessionStore.getState().setSession('expired', { id: 1, email: 'a@b.c', name: 'A' })
    mockFetchOnce(401, { detail: 'Invalid or expired token' })
    await api('/auth/me').catch(() => undefined)
    expect(useSessionStore.getState().token).toBeNull()
    expect(useSessionStore.getState().user).toBeNull()
  })

  it('returns undefined for 204', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
    const result = await api<void>('/auth/logout', { method: 'POST' })
    expect(result).toBeUndefined()
  })
})
