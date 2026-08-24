import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { createJudge, deleteJudge, listJudges, updateJudge } from '@/api/judges'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { JudgeModel } from '@/types/judges'
import { JudgeFormDialog, optionsFromForm, type JudgeFormValues } from './components/JudgeFormDialog'

export function JudgesPage() {
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<JudgeModel | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<JudgeModel | null>(null)

  const { data: judges = [], isLoading, isError } = useQuery({
    queryKey: ['judges'],
    queryFn: listJudges,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['judges'] })

  const createMutation = useMutation({
    mutationFn: (values: JudgeFormValues) =>
      createJudge({
        name: values.name,
        description: values.description ?? '',
        base_url: values.baseUrl,
        model_name: values.modelName,
        api_key: values.apiKey || undefined,
        options: optionsFromForm(values),
      }),
    onSuccess: async () => {
      await invalidate()
      setFormOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: JudgeFormValues }) =>
      updateJudge(id, {
        name: values.name,
        description: values.description ?? '',
        base_url: values.baseUrl,
        model_name: values.modelName,
        api_key: values.apiKey || undefined,
        options: optionsFromForm(values),
      }),
    onSuccess: async () => {
      await invalidate()
      setFormOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteJudge(id),
    onSuccess: async () => {
      await invalidate()
      setConfirmDelete(null)
    },
  })

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Judge models</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Reusable evaluator endpoints. Scans reference one here — or use inline overrides in
            the wizard.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          New judge
        </button>
      </div>

      {isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading…</p>}
      {isError && <p className="mt-8 text-sm text-red-600">Failed to load judges.</p>}

      {!isLoading && !isError && judges.length === 0 && (
        <div className="mt-16 text-center text-sm text-muted-foreground">
          <p>No judge models yet.</p>
          <p className="mt-1">Add one (e.g. your local Ollama) to reuse it across scans.</p>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {judges.map((judge) => (
          <div
            key={judge.id}
            className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
          >
            <div>
              <p className="text-sm font-medium">
                {judge.name} <span className="text-muted-foreground">· {judge.modelName}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {judge.baseUrl} · key {judge.apiKeyMasked || '(none)'}
                {judge.description ? ` · ${judge.description}` : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditing(judge)
                  setFormOpen(true)
                }}
                className="rounded-md border border-border px-3 py-1.5 text-xs"
              >
                Edit
              </button>
              <button
                onClick={() => setConfirmDelete(judge)}
                className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 dark:border-red-800"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <JudgeFormDialog
        open={formOpen}
        judge={editing}
        onClose={() => setFormOpen(false)}
        onSubmit={async (values) => {
          if (editing) {
            await updateMutation.mutateAsync({ id: editing.id, values })
          } else {
            await createMutation.mutateAsync(values)
          }
        }}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        title={confirmDelete ? `Delete ${confirmDelete.name}?` : ''}
        description="Scans that already used this judge keep their snapshot configuration."
        pending={deleteMutation.isPending}
        onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  )
}
