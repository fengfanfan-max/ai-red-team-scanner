import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { listScans } from '@/api/scans'
import type { Scan, ScanStatus } from '@/types/scans'

const STATUS_LABEL: Record<ScanStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  failed: 'Failed',
  completed: 'Completed',
}

const STATUS_CLASS: Record<ScanStatus, string> = {
  pending: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
  running: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
}

function StatusBadge({ status }: { status: ScanStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}

function ScanCard({ scan }: { scan: Scan }) {
  const active = scan.status === 'pending' || scan.status === 'running'
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <Link
          to={`/scans/${scan.id}`}
          className="text-sm font-medium hover:text-primary"
          title="Result page (M5)"
        >
          {scan.name}
        </Link>
        <StatusBadge status={scan.status} />
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        {scan.completedCases}/{scan.totalCases} cases · {scan.algorithm} · app #{scan.applicationId}
      </p>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full transition-all ${active ? 'bg-blue-500' : scan.status === 'failed' ? 'bg-red-500' : 'bg-green-500'}`}
          style={{ width: `${scan.progressPct}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
        <span>
          {active
            ? `${scan.progressPct}% — ${scan.completedCases} done`
            : `${scan.progressPct}%`}
        </span>
        {scan.status === 'completed' && scan.safetyScore !== null && (
          <span className="font-medium">
            Safety score:{' '}
            <span className={scan.safetyScore >= 70 ? 'text-green-600' : scan.safetyScore >= 40 ? 'text-amber-600' : 'text-red-600'}>
              {scan.safetyScore}
            </span>
          </span>
        )}
        {scan.status === 'failed' && (
          <span className="max-w-[50%] truncate text-red-600" title={scan.errorMessage ?? ''}>
            {scan.errorMessage ?? 'Scan failed'}
          </span>
        )}
      </div>
    </div>
  )
}

export function ScansPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['scans'],
    queryFn: () => listScans({ pageSize: 50 }),
    // Poll only while any scan is still active (2s cadence).
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? []
      return items.some((s) => s.status === 'pending' || s.status === 'running') ? 2000 : false
    },
  })

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Scans</h2>
          <p className="mt-1 text-sm text-neutral-500">Safety evaluation runs against your models.</p>
        </div>
        <Link
          to="/scans/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white"
        >
          New scan
        </Link>
      </div>

      {isLoading && <p className="mt-8 text-sm text-neutral-400">Loading…</p>}
      {isError && <p className="mt-8 text-sm text-red-600">Failed to load scans.</p>}

      {!isLoading && !isError && (data?.items.length ?? 0) === 0 && (
        <div className="mt-16 text-center text-sm text-neutral-500">
          <p>No scans yet.</p>
          <p className="mt-1">
            <Link to="/scans/new" className="text-primary">
              Create your first scan
            </Link>{' '}
            to evaluate a model.
          </p>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {data?.items.map((scan) => <ScanCard key={scan.id} scan={scan} />)}
      </div>
    </div>
  )
}
