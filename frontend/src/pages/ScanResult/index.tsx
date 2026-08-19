import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { getScan } from '@/api/scans'
import { getScanResults } from '@/api/results'
import type { FailureCase, ScanResults } from '@/types/results'
import type { ScanStatus } from '@/types/scans'
import { SCORE_BAR, SCORE_TEXT, scoreTone } from '@/utils/score'

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

export function ScanResultPage() {
  const { scanId } = useParams()
  const id = Number(scanId)
  const [selected, setSelected] = useState<FailureCase | null>(null)

  const { data: scan, isLoading: scanLoading, isError: scanError } = useQuery({
    queryKey: ['scans', id],
    queryFn: () => getScan(id),
    enabled: Number.isFinite(id),
  })

  const active = scan?.status === 'pending' || scan?.status === 'running'
  const { data: results, isLoading: resultsLoading } = useQuery({
    queryKey: ['scan-results', id],
    queryFn: () => getScanResults(id),
    enabled: Number.isFinite(id) && scan?.status !== undefined,
    refetchInterval: active ? 2000 : false,
  })

  if (scanLoading) return <p className="text-sm text-neutral-400">Loading…</p>
  if (scanError || !scan) return <p className="text-sm text-red-600">Scan not found.</p>

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* header */}
      <div className="flex items-start justify-between">
        <div>
          <Link to="/scans" className="text-xs text-neutral-400 hover:text-primary">
            ← All scans
          </Link>
          <h2 className="mt-1 text-xl font-semibold">{scan.name}</h2>
          <p className="mt-1 text-xs text-neutral-500">
            {scan.algorithm} · app #{scan.applicationId} · concurrency {scan.concurrency} · qpm{' '}
            {scan.qpm} · threshold {scan.failThreshold}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[scan.status]}`}>
          {STATUS_LABEL[scan.status]}
        </span>
      </div>

      {scan.status === 'failed' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {scan.errorMessage ?? 'Scan failed'}
        </div>
      )}

      {resultsLoading && <p className="text-sm text-neutral-400">Loading results…</p>}
      {!resultsLoading && results && (
        <>
          <ScoreOverview results={results} />

          <section className="rounded-lg border border-border bg-surface p-5">
            <h3 className="text-sm font-medium">Failure cases ({results.failures.length})</h3>
            {results.failures.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-400">
                {active ? 'No failures so far…' : 'No failures — the model passed every case 🎉'}
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-neutral-500">
                      <th className="py-2 pr-3 font-medium">Dataset</th>
                      <th className="py-2 pr-3 font-medium">Subcategory</th>
                      <th className="py-2 pr-3 font-medium">Prompt</th>
                      <th className="py-2 pr-3 font-medium">Score</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.failures.map((f, i) => (
                      <tr
                        key={`${f.datasetName}-${f.subcategory}-${i}`}
                        onClick={() => setSelected(f)}
                        className="cursor-pointer border-b border-neutral-100 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50"
                      >
                        <td className="py-2 pr-3">{f.datasetName}</td>
                        <td className="py-2 pr-3">{f.subcategory}</td>
                        <td className="max-w-[280px] truncate py-2 pr-3 text-neutral-600 dark:text-neutral-300">
                          {f.prompt}
                        </td>
                        <td className="py-2 pr-3">
                          {f.judgeScore === null ? (
                            <span className="text-neutral-400">—</span>
                          ) : (
                            <span className={SCORE_TEXT[scoreTone(100 - f.judgeScore * 10)]}>
                              {f.judgeScore}
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-xs">
                          {f.judgeStatus === 'failed' ? (
                            <span className="text-red-600 dark:text-red-400">failed</span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400">
                              {f.judgeStatus}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {selected && (
            <FailureDrawer failure={selected} onClose={() => setSelected(null)} />
          )}
        </>
      )}
    </div>
  )
}

function ScoreOverview({ results }: { results: ScanResults }) {
  const score = results.safetyScore
  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface p-5">
        <p className="text-xs text-neutral-500">Safety score</p>
        {score === null ? (
          <p className="mt-2 text-sm text-neutral-400">Pending…</p>
        ) : (
          <>
            <p className={`mt-1 text-4xl font-bold ${SCORE_TEXT[scoreTone(score)]}`}>{score}</p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
              <div
                className={`h-full rounded-full ${SCORE_BAR[scoreTone(score)]}`}
                style={{ width: `${score}%` }}
              />
            </div>
          </>
        )}
      </div>

      <div className="space-y-2 rounded-lg border border-border bg-surface p-5">
        <h3 className="text-sm font-medium">Risk by category</h3>
        {results.byCategory.length === 0 ? (
          <p className="text-sm text-neutral-400">No results yet.</p>
        ) : (
          results.byCategory.map((cat) => {
            const avg = cat.avgScore
            const tone = avg === null ? 'warn' : scoreTone(100 - avg * 10)
            return (
              <div key={cat.datasetName} className="flex items-center gap-3 text-xs">
                <span className="w-40 shrink-0 truncate font-medium">{cat.datasetName}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                  <div
                    className={`h-full rounded-full ${SCORE_BAR[tone]}`}
                    style={{ width: `${(avg ?? 0) * 10}%` }}
                  />
                </div>
                <span className="w-32 shrink-0 text-right text-neutral-500">
                  avg {avg ?? '—'} · {cat.failed}/{cat.total} failed
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function FailureDrawer({ failure, onClose }: { failure: FailureCase; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col overflow-y-auto bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Failure detail</h3>
          <button onClick={onClose} className="text-sm text-neutral-400 hover:text-neutral-700">
            Close
          </button>
        </div>

        <dl className="mt-4 space-y-4 text-sm">
          <div>
            <dt className="text-xs text-neutral-500">Dataset / subcategory</dt>
            <dd className="mt-1">
              {failure.datasetName} · {failure.subcategory}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Prompt</dt>
            <dd className="mt-1 whitespace-pre-wrap rounded-lg border border-border bg-neutral-50 p-3 dark:bg-neutral-800">
              {failure.prompt}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Model answer</dt>
            <dd className="mt-1 whitespace-pre-wrap rounded-lg border border-border bg-neutral-50 p-3 dark:bg-neutral-800">
              {failure.answer ?? <span className="text-neutral-400">(no answer — target error)</span>}
            </dd>
          </div>
          <div className="flex gap-6">
            <div>
              <dt className="text-xs text-neutral-500">Judge score</dt>
              <dd className="mt-1 font-semibold">
                {failure.judgeScore === null ? '—' : `${failure.judgeScore}/10`}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Status</dt>
              <dd className="mt-1">{failure.judgeStatus}</dd>
            </div>
          </div>
          {failure.judgeReason && (
            <div>
              <dt className="text-xs text-neutral-500">Judge reason</dt>
              <dd className="mt-1">{failure.judgeReason}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}
