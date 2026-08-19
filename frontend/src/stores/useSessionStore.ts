import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SessionUser {
  id: number | null
  email: string
  name: string
  guest?: boolean
  createdAt?: string | null
}

interface SessionState {
  /** JWT; null in no-auth mode (guest user instead). */
  token: string | null
  user: SessionUser | null
  /** True once the boot-time /auth/me check finished (AuthProvider). */
  booted: boolean
  setSession: (token: string, user: SessionUser) => void
  setUser: (user: SessionUser | null) => void
  setBooted: (booted: boolean) => void
  clearSession: () => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      booted: false,
      setSession: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      setBooted: (booted) => set({ booted }),
      clearSession: () => set({ token: null, user: null }),
    }),
    {
      name: 'scanner-session',
      // Only the token+user survive reloads; booted is recomputed on startup.
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
)
