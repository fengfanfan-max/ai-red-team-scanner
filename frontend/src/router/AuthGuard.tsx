import { Navigate, Outlet } from 'react-router-dom'

import { useSessionStore } from '@/stores/useSessionStore'

/**
 * Protects main routes: requires a session (real user OR no-auth guest).
 * Redirects to /login when the boot check finished without a session.
 */
export function AuthGuard() {
  const booted = useSessionStore((s) => s.booted)
  const user = useSessionStore((s) => s.user)

  if (!booted) return null // AuthProvider shows the loading gate
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}
