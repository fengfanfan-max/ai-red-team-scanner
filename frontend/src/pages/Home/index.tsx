import { useEffect, useState } from 'react'

interface HealthResponse {
  status: string
  app: string
  version: string
}

/**
 * M0 smoke page: proves the full path frontend → Vite proxy → FastAPI works.
 */
export function HomePage() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<HealthResponse>
      })
      .then(setHealth)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-2xl font-semibold">AI Red Team Scanner</h2>
      <p className="mt-2 text-sm text-neutral-500">
        M0 skeleton: frontend ↔ backend connectivity check.
      </p>
      <div className="mt-6 rounded-lg border border-border bg-surface p-4 text-sm">
        {error ? (
          <p className="text-red-600">Backend unreachable: {error}</p>
        ) : health ? (
          <p className="text-green-600">
            Backend healthy: {health.app} v{health.version} ({health.status})
          </p>
        ) : (
          <p className="text-neutral-400">Checking /api/health…</p>
        )}
      </div>
    </div>
  )
}
