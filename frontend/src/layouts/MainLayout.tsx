import { Link, Outlet, useNavigate } from 'react-router-dom'

import { useSessionStore } from '@/stores/useSessionStore'

/**
 * Main application shell: sidebar + header. Navigation grows in M2+.
 */
export function MainLayout() {
  const user = useSessionStore((s) => s.user)
  const clearSession = useSessionStore((s) => s.clearSession)
  const navigate = useNavigate()

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
            Home
          </Link>
          <Link to="/applications" className="block rounded px-2 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            AI Applications
          </Link>
          <Link to="/datasets" className="block rounded px-2 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            Datasets
          </Link>
          <Link to="/settings" className="block rounded px-2 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            Settings
          </Link>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border px-6">
          <span className="text-sm text-neutral-500">M1: auth skeleton</span>
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
