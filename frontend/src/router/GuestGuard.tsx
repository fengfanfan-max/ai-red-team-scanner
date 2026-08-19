import { Navigate, Outlet } from 'react-router-dom'

import { useSessionStore } from '@/stores/useSessionStore'

/**
 * Protects auth pages (login/register): already having a session (real user
 * or no-auth guest) bounces to /home. In no-auth mode the guest session is
 * set at boot, so auth pages are effectively unreachable — by design.
 */
export function GuestGuard() {
  const booted = useSessionStore((s) => s.booted)
  const user = useSessionStore((s) => s.user)

  if (!booted) return null
  if (user) return <Navigate to="/home" replace />
  return <Outlet />
}
