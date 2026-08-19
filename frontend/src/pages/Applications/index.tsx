import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import {
  createApplication,
  deleteApplication,
  listApplications,
  updateApplication,
} from '@/api/applications'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { ApplicationPayload } from '@/types/applications'
import type { AIApplication } from '@/types/applications'
import type { ApplicationFormValues } from './applicationSchema'
import { ApplicationFormDialog } from './components/ApplicationFormDialog'
import { TestChatDialog } from './components/TestChatDialog'

export function ApplicationsPage() {
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AIApplication | null>(null)
  const [chatting, setChatting] = useState<AIApplication | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<AIApplication | null>(null)

  const { data: applications = [], isLoading, isError } = useQuery({
    queryKey: ['applications'],
    queryFn: listApplications,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['applications'] })

  const createMutation = useMutation({
    mutationFn: (values: ApplicationFormValues) =>
      createApplication({
        name: values.name,
        base_url: values.baseUrl,
        api_key: values.apiKey || undefined,
        model_name: values.modelName,
      } satisfies ApplicationPayload),
    onSuccess: async () => {
      await invalidate()
      setFormOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: ApplicationFormValues }) =>
      updateApplication(id, {
        name: values.name,
        base_url: values.baseUrl,
        api_key: values.apiKey || undefined,
        model_name: values.modelName,
      }),
    onSuccess: async () => {
      await invalidate()
      setFormOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteApplication(id),
    onSuccess: async () => {
      await invalidate()
      setConfirmDelete(null)
    },
  })

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">AI Applications</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Target models to scan. API keys are encrypted at rest and never shown again.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white"
        >
          New application
        </button>
      </div>

      {isLoading && <p className="mt-8 text-sm text-neutral-400">Loading…</p>}
      {isError && <p className="mt-8 text-sm text-red-600">Failed to load applications.</p>}

      {!isLoading && !isError && applications.length === 0 && (
        <div className="mt-16 text-center text-sm text-neutral-500">
          <p>No applications yet.</p>
          <p className="mt-1">Create one to start scanning your models.</p>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {applications.map((app) => (
          <div
            key={app.id}
            className="flex items-center justify-between rounded-lg border border-border bg-surface p-4"
          >
            <div>
              <p className="text-sm font-medium">
                {app.name} <span className="text-neutral-400">· {app.modelName}</span>
              </p>
              <p className="mt-0.5 text-xs text-neutral-500">
                {app.baseUrl} · key {app.apiKeyMasked || '(none)'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setChatting(app)}
                className="rounded-md border border-border px-3 py-1.5 text-xs"
              >
                Test chat
              </button>
              <button
                onClick={() => {
                  setEditing(app)
                  setFormOpen(true)
                }}
                className="rounded-md border border-border px-3 py-1.5 text-xs"
              >
                Edit
              </button>
              <button
                onClick={() => setConfirmDelete(app)}
                className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 dark:border-red-800"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <ApplicationFormDialog
        open={formOpen}
        application={editing}
        onClose={() => setFormOpen(false)}
        onSubmit={async (values) => {
          if (editing) {
            await updateMutation.mutateAsync({ id: editing.id, values })
          } else {
            await createMutation.mutateAsync(values)
          }
        }}
      />

      {chatting && <TestChatDialog application={chatting} onClose={() => setChatting(null)} />}

      <ConfirmDialog
        open={confirmDelete !== null}
        title={confirmDelete ? `Delete ${confirmDelete.name}?` : ''}
        description="This removes the application configuration. Past scan results are not deleted."
        pending={deleteMutation.isPending}
        onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  )
}
