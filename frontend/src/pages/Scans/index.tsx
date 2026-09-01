import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { listScans, rerunScan } from '@/api/scans'
import { ScanStatusBadge, ToneProgress } from '@/components/ScanStatusBadge'
import type { Scan } from '@/types/scans'

function RunRow({ scan }: { scan: Scan }) {
  const active = scan.status === 'pending' || scan.status === 'running'
  return (
    <Link
      to={`/scans/${scan.id}`}
      className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted"
    >
      <span className="truncate font-medium">{scan.name}</span>
      <span className="ml-3 flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
        <ToneProgress value={scan.progressPct} tone={active ? 'active' : scan.status === 'failed' ? 'bad' : 'good'} />
        <span className="w-24">{scan.progressPct}%</span>
        {scan.status === 'completed' && scan.safetyScore !== null ? (
          <span className="font-medium">{scan.safetyScore}</span>
        ) : (
          <ScanStatusBadge status={scan.status} />
        )}
      </span>
    </Link>
  )
}

function FamilyCard({ scans, onRerun }: { scans: Scan[]; onRerun: (id: number) => void }) {
  const newest = scans[scans.length - 1]
  const history = [...scans].reverse()
  const [expanded, setExpanded] = useState(false)
  const active = newest.status === 'pending' || newest.status === 'running'

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <Link
          to={`/scans/${newest.id}`}
          className="text-sm font-medium hover:text-primary"
          title="Newest run in this scan family"
        >
          {newest.name}
        </Link>
        <div className="flex items-center gap-2">
          {scans.length > 1 && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="rounded border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
            >
              {expanded ? 'Hide' : 'Show'} history ({scans.length} runs)
            </button>
          )}
          <button
            onClick={() => onRerun(newest.id)}
            disabled={active}
            className="rounded border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40"
            title="Run the same configuration again"
          >
            Rerun
          </button>
          <ScanStatusBadge status={newest.status} />
        </div>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        {newest.completedCases}/{newest.totalCases} cases · {newest.algorithm} ·{' '}
        {scans.length} run{scans.length > 1 ? 's' : ''}
      </p>

      <div className="mt-3">
        <ToneProgress value={newest.progressPct} tone={active ? 'active' : newest.status === 'failed' ? 'bad' : 'good'} />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {active
            ? `${newest.progressPct}% — ${newest.completedCases} done`
            : `${newest.progressPct}%`}
        </span>
        {newest.status === 'completed' && newest.safetyScore !== null && (
          <span className="font-medium">Safety score: {newest.safetyScore}</span>
        )}
        {newest.status === 'failed' && (
          <span className="max-w-[50%] truncate text-red-600" title={newest.errorMessage ?? ''}>
            {newest.errorMessage ?? 'Scan failed'}
          </span>
        )}
      </div>

      {expanded && scans.length > 1 && (
        <div className="mt-3 border-t border-border pt-2">
          {history.map((run) => (
            <RunRow key={run.id} scan={run} />
          ))}
        </div>
      )}
    </div>
  )
}

export function ScansPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['scans'],
    queryFn: () => listScans({ pageSize: 100 }),
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

  // family grouping: familyId is the root scan id; NULL means the scan is its
  // own root (single run)
  const groups = new Map<number, Scan[]>()
  const singles: Scan[] = []
  for (const scan of data?.items ?? []) {
    const family = scan.familyId ?? scan.id
    if (scan.familyId === null) singles.push(scan)
    else {
      const bucket = groups.get(family) ?? []
      bucket.push(scan)
      groups.set(family, bucket)
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Scans</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Safety evaluation runs. Re-runs of a scan are grouped as its history.
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
        {singles.map((scan) => (
          <FamilyCard key={scan.id} scans={[scan]} onRerun={(id) => rerunMutation.mutate(id)} />
        ))}
        {[...groups.values()].map((bucket) => (
          <FamilyCard key={bucket[0].id} scans={bucket} onRerun={(id) => rerunMutation.mutate(id)} />
        ))}
      </div>
    </div>
  )
}
