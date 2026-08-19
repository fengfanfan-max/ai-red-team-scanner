import { useState } from 'react'

import { testChat } from '@/api/applications'
import type { AIApplication } from '@/types/applications'

interface Props {
  application: AIApplication
  onClose: () => void
}

export function TestChatDialog({ application, onClose }: Props) {
  const [message, setMessage] = useState('')
  const [reply, setReply] = useState<string | null>(null)
  const [simulated, setSimulated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  async function handleSend() {
    if (!message.trim()) return
    setError(null)
    setReply(null)
    setSending(true)
    try {
      const result = await testChat(application.id, message)
      setReply(result.reply)
      setSimulated(result.simulated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test chat failed')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex h-[480px] w-full max-w-lg flex-col rounded-xl border border-border bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold">
            Test chat — {application.name} ({application.modelName})
          </h2>
          <p className="text-xs text-neutral-500">{application.baseUrl}</p>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5 text-sm">
          {message && (
            <div className="ml-auto w-fit max-w-[85%] rounded-lg bg-primary px-3 py-2 text-white">
              {message}
            </div>
          )}
          {reply !== null && (
            <div className="mr-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-lg border border-border bg-neutral-50 px-3 py-2 dark:bg-neutral-800">
              {reply}
              {simulated && (
                <span className="mt-1 block text-xs text-amber-600">(simulated reply)</span>
              )}
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex gap-2 border-t border-border p-4">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSend()
              }
            }}
            placeholder="Say something to the model…"
            className="flex-1 rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={() => void handleSend()}
            disabled={sending || !message.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
          <button onClick={onClose} className="rounded-md border border-border px-3 py-2 text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
