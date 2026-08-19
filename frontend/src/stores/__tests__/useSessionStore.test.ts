import { beforeEach, describe, expect, it } from 'vitest'

import { useSessionStore } from '@/stores/useSessionStore'

const STORAGE_KEY = 'scanner-session'

describe('useSessionStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useSessionStore.setState({ token: null, user: null, booted: false })
  })

  it('setSession stores token + user', () => {
    useSessionStore.getState().setSession('jwt-token', {
      id: 1,
      email: 'a@b.c',
      name: 'Alice',
    })
    const s = useSessionStore.getState()
    expect(s.token).toBe('jwt-token')
    expect(s.user?.name).toBe('Alice')
  })

  it('clearSession wipes token and user', () => {
    useSessionStore.getState().setSession('jwt-token', { id: 1, email: 'a@b.c', name: 'Alice' })
    useSessionStore.getState().clearSession()
    const s = useSessionStore.getState()
    expect(s.token).toBeNull()
    expect(s.user).toBeNull()
  })

  it('persists token+user to localStorage (survives page reloads)', () => {
    useSessionStore.getState().setSession('jwt-token', { id: 2, email: 'b@c.d', name: 'Bob' })

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as {
      state: { token: string | null; user: { name: string } | null }
    }
    expect(stored.state.token).toBe('jwt-token')
    expect(stored.state.user?.name).toBe('Bob')

    // booted must NOT persist: it is recomputed on every page load
    useSessionStore.getState().setBooted(true)
    const after = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as {
      state: { booted?: boolean }
    }
    expect(after.state.booted).toBeUndefined()
  })
})
