import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { getDashboard } from '@/api/dashboard'
import { ToneProgress } from '@/components/ScanStatusBadge'
import type { ScanStatus } from '@/types/scans'
import { SCORE_TEXT, scoreTone } from '@/utils/score'

const STATUS_LABEL: Record<ScanStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  failed: 'Failed',
  completed: 'Completed',
}

export function DashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: (query) => {
      const running = query.state.data?.stats.runningScans ?? 0
      return running > 0 ? 5000 : false
    },
  })

  if (isLoading) return <p className="text-sm text-neutral-400">Loading…</p>
  if (isError) return <p className="text-sm text-red-600">Failed to load dashboard.</p>
  if (!data) return null

  const { stats, recentScans, riskByCategory } = data
  const avg = stats.avgSafetyScore
  const avgTone = avg === null ? 'warn' : scoreTone(avg)

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <p className="mt-1 text-sm text-neutral-500">Model safety at a glance.</p>
      </div>

      {/* stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total scans" value={String(stats.totalScans)} />
        <StatCard label="Completed" value={String(stats.completedScans)} />
        <StatCard
          label="Avg safety score"
          value={avg === null ? '—' : String(avg)}
          valueClass={avg === null ? undefined : SCORE_TEXT[avgTone]}
        />
        <StatCard
          label="High risk scans"
          value={String(stats.highRiskScans)}
          valueClass={stats.highRiskScans > 0 ? 'text-red-600 dark:text-red-400' : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* risk by category */}
        <section className="rounded-lg border border-border bg-surface p-5">
          <h3 className="text-sm font-medium">Risk by category</h3>
          {riskByCategory.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-400">
              No data yet — complete a scan to see risk distribution.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {riskByCategory.map((cat) => {
                const score = cat.avgScore
                const pct = score === null ? 0 : score * 10
                const tone = score === null ? 'warn' : scoreTone(100 - score * 10)
                return (
                  <div key={cat.datasetName}>
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{cat.datasetName}</span>
                      <span className="text-neutral-500">
                        avg {score ?? '—'}/10 · {cat.failed}/{cat.total} failed
                      </span>
                    </div>
                    <div className="mt-1">
                      <ToneProgress value={pct} tone={tone} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* recent scans */}
        <section className="rounded-lg border border-border bg-surface p-5">
          <h3 className="text-sm font-medium">Recent scans</h3>
          {recentScans.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-400">
              No scans yet —{' '}
              <Link to="/scans/new" className="text-primary">
                create one
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-neutral-100 dark:divide-neutral-800">
              {recentScans.map((scan) => (
                <li key={scan.id}>
                  <Link
                    to={`/scans/${scan.id}`}
                    className="flex items-center justify-between py-2.5 text-sm hover:text-primary"
                  >
                    <span className="truncate font-medium">{scan.name}</span>
                    <span className="ml-3 flex shrink-0 items-center gap-2 text-xs text-neutral-500">
                      {scan.status === 'completed' && scan.safetyScore !== null ? (
                        <span className={SCORE_TEXT[scoreTone(scan.safetyScore)]}>
                          {scan.safetyScore}
                        </span>
                      ) : (
                        <span>{STATUS_LABEL[scan.status]}</span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${valueClass ?? ''}`}>{value}</p>
    </div>
  )
}
