import { useQuery } from '@tanstack/react-query'

import { listDatasets } from '@/api/datasets'
import type { DatasetRef } from '@/types/scans'
import { useCreateScanStore } from '../stores/useCreateScanStore'

export function SelectDatasetsStep() {
  const datasetRefs = useCreateScanStore((s) => s.datasetRefs)
  const toggleDataset = useCreateScanStore((s) => s.toggleDataset)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['datasets'],
    queryFn: listDatasets,
  })

  const isSelected = (ref: DatasetRef) =>
    datasetRefs.some((r) => r.source === ref.source && r.ref === ref.ref)

  const rowClass = (ref: DatasetRef) =>
    `flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors ${
      isSelected(ref)
        ? 'border-primary bg-primary/5'
        : 'border-border bg-surface hover:border-neutral-300'
    }`

  if (isLoading) return <p className="text-sm text-neutral-400">Loading…</p>
  if (isError) return <p className="text-sm text-red-600">Failed to load datasets.</p>

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        ⚠️ Built-in datasets contain sensitive test prompts (self-harm, violence, PII
        extraction…). Cloud providers may block these requests or flag the account —
        we recommend a small custom dataset first when testing an online model.
      </div>

      <section>
        <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Built-in</h3>
        <div className="mt-2 space-y-2">
          {data?.builtin.map((d) => {
            const count = d.subcategories.reduce((n, s) => n + s.prompts.length, 0)
            const ref: DatasetRef = { source: 'builtin', ref: d.name }
            return (
              <button key={d.name} type="button" onClick={() => toggleDataset(ref)} className={rowClass(ref)}>
                <span>
                  <span className="block text-sm font-medium">{d.name}</span>
                  <span className="block text-xs text-neutral-500">
                    {d.subcategories.length} subcategories · {count} prompts
                  </span>
                </span>
                <span className="text-xs">{isSelected(ref) ? '✓ selected' : ''}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Custom</h3>
        {!data || data.custom.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-400">
            No custom datasets — import one on the{' '}
            <a href="/datasets" className="text-primary">
              Datasets
            </a>{' '}
            page.
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {data.custom.map((d) => {
              const ref: DatasetRef = { source: 'custom', ref: String(d.id) }
              return (
                <button key={d.id} type="button" onClick={() => toggleDataset(ref)} className={rowClass(ref)}>
                  <span>
                    <span className="block text-sm font-medium">{d.name}</span>
                    <span className="block text-xs text-neutral-500">
                      {d.subcategoryCount} subcategories · {d.promptCount} prompts
                    </span>
                  </span>
                  <span className="text-xs">{isSelected(ref) ? '✓ selected' : ''}</span>
                </button>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
