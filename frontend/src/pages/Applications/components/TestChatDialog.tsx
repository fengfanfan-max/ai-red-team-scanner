import { useState } from 'react'

import { testChat } from '@/api/applications'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex h-[480px] max-w-lg flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border px-5 py-3 text-left">
          <DialogTitle>
            Test chat — {application.name} ({application.modelName})
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{application.baseUrl}</p>
        </DialogHeader>

        <div className="flex-1 space-y-3 overflow-y-auto p-5 text-sm">
          {message && (
            <div className="ml-auto w-fit max-w-[85%] rounded-lg bg-primary px-3 py-2 text-primary-foreground">
              {message}
            </div>
          )}
          {reply !== null && (
            <div className="mr-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-lg border border-border bg-muted px-3 py-2">
              {reply}
              {simulated && (
                <span className="mt-1 block text-xs text-amber-600">(simulated reply)</span>
              )}
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter className="gap-2 border-t border-border p-4 sm:flex-row">
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
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={() => void handleSend()}
            disabled={sending || !message.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
          <button onClick={onClose} className="rounded-md border border-input px-3 py-2 text-sm">
            Close
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
