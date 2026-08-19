import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { createCustomDataset, deleteCustomDataset, listDatasets } from '@/api/datasets'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { CustomDatasetPayload } from '@/types/datasets'
import { customDatasetSchema, type CustomDatasetFormValues } from './customDatasetSchema'

export function DatasetsPage() {
  const queryClient = useQueryClient()
  const [json, setJson] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['datasets'],
    queryFn: listDatasets,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['datasets'] })

  const createMutation = useMutation({
    mutationFn: (payload: CustomDatasetPayload) => createCustomDataset(payload),
    onSuccess: async () => {
      await invalidate()
      setJson('')
      setError(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCustomDataset(id),
    onSuccess: async () => {
      await invalidate()
      setConfirmDelete(null)
    },
  })

  function handleUpload() {
    setError(null)
    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch {
      setError('Invalid JSON')
      return
    }
    const result = customDatasetSchema.safeParse(parsed)
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid dataset structure')
      return
    }
    const values: CustomDatasetFormValues = result.data
    createMutation.mutate({
      name: values.name,
      description: values.description,
      subcategories: values.subcategories,
    })
  }

  const totalBuiltinPrompts =
    data?.builtin.reduce(
      (n, d) => n + d.subcategories.reduce((m, s) => m + s.prompts.length, 0),
      0
    ) ?? 0

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Datasets</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Built-in risk prompts ship with the repo (MIT); import your own as JSON.
        </p>
      </div>

      {isLoading && <p className="text-sm text-neutral-400">Loading…</p>}
      {isError && <p className="text-sm text-red-600">Failed to load datasets.</p>}

      {data && (
        <>
          <section>
            <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
              Built-in ({data.builtin.length} datasets · {totalBuiltinPrompts} prompts)
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {data.builtin.map((d) => (
                <div key={d.name} className="rounded-lg border border-border bg-surface p-4">
                  <p className="text-sm font-medium">{d.name}</p>
                  <p className="mt-1 text-xs text-neutral-500">{d.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {d.subcategories.map((s) => (
                      <span
                        key={s.name}
                        className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                      >
                        {s.name} · {s.prompts.length}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
              Custom ({data.custom.length})
            </h3>
            {data.custom.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-400">No custom datasets yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {data.custom.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{d.name}</p>
                      <p className="text-xs text-neutral-500">
                        {d.subcategoryCount} subcategories · {d.promptCount} prompts
                        {d.description ? ` · ${d.description}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => setConfirmDelete({ id: d.id, name: d.name })}
                      className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 dark:border-red-800"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
              Import custom dataset (JSON)
            </h3>
            <div className="mt-3 rounded-lg border border-border bg-surface p-4">
              <textarea
                value={json}
                onChange={(e) => setJson(e.target.value)}
                rows={7}
                spellCheck={false}
                placeholder={'{\n  "name": "My Risks",\n  "description": "…",\n  "subcategories": [\n    {"name": "Sub A", "prompts": ["prompt 1", "prompt 2"]}\n  ]\n}'}
                className="w-full rounded-md border border-border bg-neutral-50 p-3 font-mono text-xs outline-none focus:border-primary dark:bg-neutral-900"
              />
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
              {createMutation.isError && (
                <p className="mt-2 text-sm text-red-600">
                  {createMutation.error instanceof Error
                    ? createMutation.error.message
                    : 'Import failed'}
                </p>
              )}
              <div className="mt-3 flex justify-end">
                <button
                  onClick={handleUpload}
                  disabled={createMutation.isPending || !json.trim()}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Importing…' : 'Import'}
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title={confirmDelete ? `Delete ${confirmDelete.name}?` : ''}
        description="Scans that already used this dataset keep their results."
        pending={deleteMutation.isPending}
        onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  )
}
