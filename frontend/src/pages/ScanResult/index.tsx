import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { getScan } from '@/api/scans'
import { getScanResults, listScanCases } from '@/api/results'
import { CaseStatusBadge, ScanStatusBadge, ToneProgress } from '@/components/ScanStatusBadge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { FailureCase, ScanCase, ScanResults } from '@/types/results'
import type { Scan } from '@/types/scans'
import { SCORE_TEXT, scoreTone } from '@/utils/score'

interface CaseDetail {
  datasetName: string
  subcategory: string
  prompt: string
  answer: string | null
  judgeScore: number | null
  judgeReason: string | null
  judgeStatus: string
}

export function ScanResultPage() {
  const { scanId } = useParams()
  const id = Number(scanId)
  const [selected, setSelected] = useState<CaseDetail | null>(null)

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
    <div className="mx-auto max-w-6xl space-y-6">
      <ScanHeader scan={scan} />

      {scan.status === 'failed' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {scan.errorMessage ?? 'Scan failed'}
        </div>
      )}

      {resultsLoading && <p className="text-sm text-neutral-400">Loading results…</p>}
      {!resultsLoading && results && (
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="cases">All cases</TabsTrigger>
            <TabsTrigger value="failures">Failures ({results.failures.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <ScoreOverview results={results} />
          </TabsContent>

          <TabsContent value="cases" className="mt-4">
            <CasesTable scanId={id} active={active} onSelect={setSelected} />
          </TabsContent>

          <TabsContent value="failures" className="mt-4">
            <FailuresTable failures={results.failures} active={active} onSelect={setSelected} />
          </TabsContent>
        </Tabs>
      )}

      {selected && <CaseDrawer detail={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

/* ---------------- header ---------------- */

function ScanHeader({ scan }: { scan: Scan }) {
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—')
  return (
    <div>
      <Link to="/scans" className="text-xs text-muted-foreground hover:text-primary">
        ← All scans
      </Link>
      <div className="mt-1 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{scan.name}</h2>
          <dl className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
            <div>
              <dt className="font-medium text-foreground">Application</dt>
              <dd>#{scan.applicationId}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Algorithm</dt>
              <dd>{scan.algorithm}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Settings</dt>
              <dd>
                concurrency {scan.concurrency} · qpm {scan.qpm} · threshold {scan.failThreshold}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Judge</dt>
              <dd>
                {scan.judgeModel ? (
                  <>
                    {scan.judgeModel}
                    {scan.judgeBaseUrl ? ` @ ${scan.judgeBaseUrl}` : ''}
                  </>
                ) : (
                  'follows target'
                )}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Datasets</dt>
              <dd>{scan.datasets.map((d) => (d.source === 'builtin' ? d.ref : `custom#${d.ref}`)).join(', ')}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Timeline</dt>
              <dd>
                created {fmt(scan.createdAt)}
                {scan.finishedAt ? ` · finished ${fmt(scan.finishedAt)}` : ''}
              </dd>
            </div>
          </dl>
        </div>
        <ScanStatusBadge status={scan.status} />
      </div>
    </div>
  )
}

/* ---------------- overview ---------------- */

function ScoreOverview({ results }: { results: ScanResults }) {
  const score = results.safetyScore
  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card p-5">
        <p className="text-xs text-muted-foreground">Safety score</p>
        {score === null ? (
          <p className="mt-2 text-sm text-muted-foreground">Pending…</p>
        ) : (
          <>
            <p className={`mt-1 text-4xl font-bold ${SCORE_TEXT[scoreTone(score)]}`}>{score}</p>
            <div className="mt-3">
              <ToneProgress value={score} tone={scoreTone(score)} />
            </div>
          </>
        )}
      </div>

      <div className="space-y-2 rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-medium">Risk by category</h3>
        {results.byCategory.length === 0 ? (
          <p className="text-sm text-muted-foreground">No results yet.</p>
        ) : (
          results.byCategory.map((cat) => {
            const avg = cat.avgScore
            const tone = avg === null ? 'warn' : scoreTone(100 - avg * 10)
            return (
              <div key={cat.datasetName} className="flex items-center gap-3 text-xs">
                <span className="w-40 shrink-0 truncate font-medium">{cat.datasetName}</span>
                <div className="flex-1">
                  <ToneProgress value={(avg ?? 0) * 10} tone={tone} />
                </div>
                <span className="w-32 shrink-0 text-right text-muted-foreground">
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

/* ---------------- all cases ---------------- */

const STATUS_FILTERS = ['all', 'passed', 'failed', 'errors'] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

function CasesTable({
  scanId,
  active,
  onSelect,
}: {
  scanId: number
  active: boolean
  onSelect: (detail: CaseDetail) => void
}) {
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['scan-cases', scanId, filter, page],
    queryFn: () => listScanCases(scanId, { page, pageSize: 20, status: filter }),
    refetchInterval: active ? 2000 : false,
  })

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => {
              setFilter(f)
              setPage(1)
            }}
            className={`rounded-full px-3 py-1 text-xs ${
              filter === f
                ? 'bg-primary text-primary-foreground'
                : 'border border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && <p className="text-sm text-red-600">Failed to load cases.</p>}
      {data && data.items.length === 0 && (
        <p className="text-sm text-muted-foreground">No cases match this filter.</p>
      )}

      {data && data.items.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dataset</TableHead>
                <TableHead>Subcategory</TableHead>
                <TableHead>Prompt</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Latency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((caseRow: ScanCase) => (
                <TableRow
                  key={caseRow.id}
                  className="cursor-pointer"
                  onClick={() => onSelect(caseRow)}
                >
                  <TableCell>{caseRow.datasetName}</TableCell>
                  <TableCell>{caseRow.subcategory}</TableCell>
                  <TableCell className="max-w-[280px] truncate text-muted-foreground">
                    {caseRow.prompt}
                  </TableCell>
                  <TableCell>
                    {caseRow.judgeScore === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className={SCORE_TEXT[scoreTone(100 - caseRow.judgeScore * 10)]}>
                        {caseRow.judgeScore}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <CaseStatusBadge status={caseRow.judgeStatus} />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {caseRow.latencyMs}ms
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {data.pagination.totalItems} cases · page {data.pagination.currentPage}/
              {data.pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={!data.pagination.prevPage}
                onClick={() => setPage((p) => p - 1)}
                className="rounded border border-border px-2 py-1 disabled:opacity-40"
              >
                ← Prev
              </button>
              <button
                disabled={!data.pagination.nextPage}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-border px-2 py-1 disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ---------------- failures ---------------- */

function FailuresTable({
  failures,
  active,
  onSelect,
}: {
  failures: FailureCase[]
  active: boolean
  onSelect: (detail: CaseDetail) => void
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      {failures.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">
          {active ? 'No failures so far…' : 'No failures — the model passed every case 🎉'}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dataset</TableHead>
              <TableHead>Subcategory</TableHead>
              <TableHead>Prompt</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {failures.map((f, i) => (
              <TableRow
                key={`${f.datasetName}-${f.subcategory}-${i}`}
                className="cursor-pointer"
                onClick={() => onSelect(f)}
              >
                <TableCell>{f.datasetName}</TableCell>
                <TableCell>{f.subcategory}</TableCell>
                <TableCell className="max-w-[280px] truncate text-muted-foreground">
                  {f.prompt}
                </TableCell>
                <TableCell>
                  {f.judgeScore === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span className={SCORE_TEXT[scoreTone(100 - f.judgeScore * 10)]}>
                      {f.judgeScore}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <CaseStatusBadge status={f.judgeStatus} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

/* ---------------- case detail drawer ---------------- */

function CaseDrawer({ detail, onClose }: { detail: CaseDetail; onClose: () => void }) {
  return (
    <Sheet open onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Case detail</SheetTitle>
        </SheetHeader>

        <dl className="mt-4 space-y-4 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Dataset / subcategory</dt>
            <dd className="mt-1">
              {detail.datasetName} · {detail.subcategory}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Prompt</dt>
            <dd className="mt-1 whitespace-pre-wrap rounded-lg border border-border bg-muted p-3">
              {detail.prompt}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Model answer</dt>
            <dd className="mt-1 whitespace-pre-wrap rounded-lg border border-border bg-muted p-3">
              {detail.answer ?? (
                <span className="text-muted-foreground">(no answer — target error)</span>
              )}
            </dd>
          </div>
          <div className="flex gap-6">
            <div>
              <dt className="text-xs text-muted-foreground">Judge score</dt>
              <dd className="mt-1 font-semibold">
                {detail.judgeScore === null ? '—' : `${detail.judgeScore}/10`}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Status</dt>
              <dd className="mt-1">
                <CaseStatusBadge status={detail.judgeStatus} />
              </dd>
            </div>
          </div>
          {detail.judgeReason && (
            <div>
              <dt className="text-xs text-muted-foreground">Judge reason</dt>
              <dd className="mt-1">{detail.judgeReason}</dd>
            </div>
          )}
        </dl>
      </SheetContent>
    </Sheet>
  )
}
