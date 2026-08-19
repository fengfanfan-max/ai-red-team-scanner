import { useState, type FormEvent } from 'react'

import { api, ApiError } from '@/api/client'
import { useSessionStore } from '@/stores/useSessionStore'

export function SettingsPage() {
  const user = useSessionStore((s) => s.user)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    if (newPassword.length < 8) {
      setMessage({ kind: 'error', text: 'New password must be at least 8 characters' })
      return
    }
    setSubmitting(true)
    try {
      await api<void>('/auth/change-password', {
        method: 'POST',
        body: { old_password: oldPassword, new_password: newPassword },
      })
      setMessage({ kind: 'ok', text: 'Password updated' })
      setOldPassword('')
      setNewPassword('')
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof ApiError ? err.message : 'Failed' })
    } finally {
      setSubmitting(false)
    }
  }

  if (user?.guest) {
    return (
      <div className="mx-auto max-w-md">
        <p className="text-sm text-neutral-500">
          Running in no-auth mode (AUTH_MODE=disabled) — no password to change.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md">
      <h2 className="text-xl font-semibold">Settings</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Signed in as <span className="font-medium">{user?.email}</span>
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-lg border border-border bg-surface p-5">
        <h3 className="text-sm font-medium">Change password</h3>
        <div>
          <label htmlFor="old" className="mb-1 block text-sm text-neutral-600 dark:text-neutral-300">
            Current password
          </label>
          <input
            id="old"
            type="password"
            required
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label htmlFor="new" className="mb-1 block text-sm text-neutral-600 dark:text-neutral-300">
            New password
          </label>
          <input
            id="new"
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        {message && (
          <p className={message.kind === 'ok' ? 'text-sm text-green-600' : 'text-sm text-red-600'}>
            {message.text}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {submitting ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  )
}
