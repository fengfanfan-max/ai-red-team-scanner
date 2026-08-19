import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { getApplication } from '@/api/applications'
import { testChat } from '@/api/applications'
import { useCreateScanStore } from '../stores/useCreateScanStore'

/**
 * Optional connectivity check: one chat turn against the selected
 * application before starting the scan.
 */
export function TestChatStep() {
  const applicationId = useCreateScanStore((s) => s.applicationId)
  const [message, setMessage] = useState('Hello!')
  const [reply, setReply] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const { data: application } = useQuery({
    queryKey: ['applications', applicationId],
    queryFn: () => getApplication(applicationId!),
    enabled: applicationId !== null,
  })

  async function handleSend() {
    if (!applicationId) return
    setError(null)
    setReply(null)
    setSending(true)
    try {
      const result = await testChat(applicationId, message)
      setReply(result.reply)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test chat failed')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <p className="text-sm font-medium">Test the connection (optional)</p>
      <p className="mt-1 text-xs text-neutral-500">
        {application ? (
          <>
            Sending to <span className="font-medium">{application.name}</span> (
            {application.modelName})
          </>
        ) : (
          'Select an application on step 1 first.'
        )}
      </p>

      <div className="mt-4 flex gap-2">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="flex-1 rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={() => void handleSend()}
          disabled={sending || !applicationId}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {reply !== null && (
        <div className="mt-3 whitespace-pre-wrap rounded-lg border border-border bg-neutral-50 p-3 text-sm dark:bg-neutral-800">
          {reply}
        </div>
      )}
      {!applicationId && (
        <p className="mt-3 text-xs text-neutral-400">This step is optional — you can skip it.</p>
      )}
    </div>
  )
}
