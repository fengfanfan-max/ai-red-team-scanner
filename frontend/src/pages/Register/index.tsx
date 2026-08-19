import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { api, ApiError } from '@/api/client'
import { useSessionStore, type SessionUser } from '@/stores/useSessionStore'

export function RegisterPage() {
  const navigate = useNavigate()
  const setSession = useSessionStore((s) => s.setSession)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setSubmitting(true)
    try {
      const data = await api<{ accessToken: string; user: SessionUser }>('/auth/register', {
        method: 'POST',
        body: { name, email, password },
      })
      setSession(data.accessToken, data.user)
      navigate('/home')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-base font-medium">Create account</h2>
      <div>
        <label htmlFor="name" className="mb-1 block text-sm text-neutral-600 dark:text-neutral-300">
          Name
        </label>
        <input
          id="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm text-neutral-600 dark:text-neutral-300">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm text-neutral-600 dark:text-neutral-300">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>
      <div>
        <label htmlFor="confirm" className="mb-1 block text-sm text-neutral-600 dark:text-neutral-300">
          Confirm password
        </label>
        <input
          id="confirm"
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {submitting ? 'Creating…' : 'Create account'}
      </button>
      <p className="text-sm text-neutral-500">
        Already have an account?{' '}
        <Link to="/login" className="text-primary">
          Sign in
        </Link>
      </p>
    </form>
  )
}
