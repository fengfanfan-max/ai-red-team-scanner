import { useQuery } from '@tanstack/react-query'
import { Link, Outlet, useNavigate } from 'react-router-dom'

import { getMeta } from '@/api/meta'
import { useSessionStore } from '@/stores/useSessionStore'

/** Main application shell: sidebar navigation + header (mode badge, user menu). */
export function MainLayout() {
  const user = useSessionStore((s) => s.user)
  const clearSession = useSessionStore((s) => s.clearSession)
  const navigate = useNavigate()
  const { data: meta } = useQuery({ queryKey: ['meta'], queryFn: getMeta, staleTime: Infinity })

  function handleLogout() {
    clearSession()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-border bg-surface p-4">
        <Link to="/home" className="text-sm font-semibold">
          AI Red Team Scanner
        </Link>
        <nav className="mt-6 space-y-1 text-sm">
          <Link to="/home" className="block rounded px-2 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            Dashboard
          </Link>
          <Link to="/applications" className="block rounded px-2 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            AI Applications
          </Link>
          <Link to="/datasets" className="block rounded px-2 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            Datasets
          </Link>
          <Link to="/scans" className="block rounded px-2 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            Scans
          </Link>
          <Link to="/judges" className="block rounded px-2 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            Judges
          </Link>
          <Link to="/settings" className="block rounded px-2 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            Settings
          </Link>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border px-6">
          {meta?.simulateScan ? (
            <span
              className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300"
              title="SIMULATE_SCAN=true — scans use the simulated engine and make no real LLM calls"
            >
              Demo mode · simulated engine
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">v{meta?.version ?? '—'}</span>
          )}
          <div className="flex items-center gap-3 text-sm">
            {user && <span className="text-neutral-600 dark:text-neutral-300">{user.name}</span>}
            <button onClick={handleLogout} className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
              Sign out
            </button>
          </div>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
