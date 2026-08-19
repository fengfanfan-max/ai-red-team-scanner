import { Outlet } from 'react-router-dom'

/** Centered card shell for login/register pages. */
export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-6 dark:bg-neutral-950">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-sm">
        <h1 className="text-lg font-semibold">AI Red Team Scanner</h1>
        <div className="mt-6">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
