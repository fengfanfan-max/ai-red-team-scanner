import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { api, ApiError } from '@/api/client'
import { useSessionStore, type SessionUser } from '@/stores/useSessionStore'

export function LoginPage() {
  const navigate = useNavigate()
  const setSession = useSessionStore((s) => s.setSession)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const data = await api<{ accessToken: string; user: SessionUser }>('/auth/login', {
        method: 'POST',
        body: { email, password },
      })
      setSession(data.accessToken, data.user)
      navigate('/home')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-base font-medium">Sign in</h2>
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
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="text-sm text-neutral-500">
        No account?{' '}
        <Link to="/register" className="text-primary">
          Register
        </Link>
      </p>
    </form>
  )
}
