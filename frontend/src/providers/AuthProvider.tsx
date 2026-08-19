import { useEffect, type ReactNode } from 'react'

import { api } from '@/api/client'
import { useSessionStore, type SessionUser } from '@/stores/useSessionStore'

/**
 * On app boot: verify the persisted token (or discover no-auth guest mode) via
 * GET /api/auth/me, then release the loading gate. Guards read `booted` from
 * the session store so they never redirect before this resolves.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const booted = useSessionStore((s) => s.booted)

  useEffect(() => {
    let cancelled = false

    async function boot() {
      try {
        const user = await api<SessionUser>('/auth/me')
        if (!cancelled) useSessionStore.getState().setUser(user)
      } catch {
        // 401 → api() already cleared the session; no-auth mode returns 200 guest.
        if (!cancelled) useSessionStore.getState().setUser(null)
      } finally {
        if (!cancelled) useSessionStore.getState().setBooted(true)
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [])

  if (!booted) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-neutral-400">
        Loading…
      </div>
    )
  }
  return children
}
