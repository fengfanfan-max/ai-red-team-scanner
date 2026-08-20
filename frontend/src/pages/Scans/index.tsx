import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { listScans, rerunScan } from '@/api/scans'
import { ScanStatusBadge, ToneProgress } from '@/components/ScanStatusBadge'
import type { Scan } from '@/types/scans'

function ScanCard({ scan, onRerun }: { scan: Scan; onRerun: (id: number) => void }) {
  const active = scan.status === 'pending' || scan.status === 'running'
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <Link
          to={`/scans/${scan.id}`}
          className="text-sm font-medium hover:text-primary"
          title="Scan detail"
        >
          {scan.name}
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onRerun(scan.id)}
            disabled={active}
            className="rounded border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40"
            title="Run the same configuration again"
          >
            Rerun
          </button>
          <ScanStatusBadge status={scan.status} />
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {scan.completedCases}/{scan.totalCases} cases · {scan.algorithm} · app #{scan.applicationId}
      </p>

      <div className="mt-3">
        <ToneProgress
          value={scan.progressPct}
          tone={
            active ? 'active' : scan.status === 'failed' ? 'bad' : 'good'
          }
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {active
            ? `${scan.progressPct}% — ${scan.completedCases} done`
            : `${scan.progressPct}%`}
        </span>
        {scan.status === 'completed' && scan.safetyScore !== null && (
          <span className="font-medium">
            Safety score:{' '}
            <span
              className={
                scan.safetyScore >= 70
                  ? 'text-green-600 dark:text-green-400'
                  : scan.safetyScore >= 40
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-600 dark:text-red-400'
              }
            >
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

  const queryClient = useQueryClient()
  const rerunMutation = useMutation({
    mutationFn: (id: number) => rerunScan(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scans'] }),
  })

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Scans</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Safety evaluation runs against your models.
          </p>
        </div>
        <Link
          to="/scans/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          New scan
        </Link>
      </div>

      {isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading…</p>}
      {isError && <p className="mt-8 text-sm text-red-600">Failed to load scans.</p>}

      {!isLoading && !isError && (data?.items.length ?? 0) === 0 && (
        <div className="mt-16 text-center text-sm text-muted-foreground">
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
        {data?.items.map((scan) => (
          <ScanCard key={scan.id} scan={scan} onRerun={(id) => rerunMutation.mutate(id)} />
        ))}
      </div>
    </div>
  )
}
