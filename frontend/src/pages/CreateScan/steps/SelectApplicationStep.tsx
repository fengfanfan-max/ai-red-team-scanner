import { useQuery } from '@tanstack/react-query'

import { listApplications } from '@/api/applications'
import { useCreateScanStore } from '../stores/useCreateScanStore'

export function SelectApplicationStep() {
  const applicationId = useCreateScanStore((s) => s.applicationId)
  const setApplication = useCreateScanStore((s) => s.setApplication)

  const { data: applications = [], isLoading, isError } = useQuery({
    queryKey: ['applications'],
    queryFn: listApplications,
  })

  if (isLoading) return <p className="text-sm text-neutral-400">Loading…</p>
  if (isError) return <p className="text-sm text-red-600">Failed to load applications.</p>

  if (applications.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-sm text-neutral-500">
        No applications yet — create one under{' '}
        <a href="/applications" className="text-primary">
          AI Applications
        </a>{' '}
        first.
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {applications.map((app) => (
        <button
          key={app.id}
          type="button"
          onClick={() => setApplication(app.id)}
          className={`rounded-lg border p-4 text-left transition-colors ${
            applicationId === app.id
              ? 'border-primary bg-primary/5'
              : 'border-border bg-surface hover:border-neutral-300'
          }`}
        >
          <p className="text-sm font-medium">{app.name}</p>
          <p className="mt-1 text-xs text-neutral-500">
            {app.modelName} · {app.baseUrl}
          </p>
          <p className="mt-1 text-xs text-neutral-400">key {app.apiKeyMasked || '(none)'}</p>
        </button>
      ))}
    </div>
  )
}
