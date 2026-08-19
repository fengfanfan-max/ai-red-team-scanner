import { Outlet } from 'react-router-dom'

/**
 * Main application shell: sidebar + header placeholder.
 * Real navigation (Dashboard / Applications / Scans / …) lands in M1+.
 */
export function MainLayout() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-border bg-surface p-4">
        <h1 className="text-sm font-semibold">AI Red Team Scanner</h1>
        <p className="mt-1 text-xs text-neutral-400">Sidebar (M1+)</p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border px-6">
          <span className="text-sm text-neutral-500">Header (M1+)</span>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
