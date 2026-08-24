import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { JudgeModel } from '@/types/judges'

const judgeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(300).optional().default(''),
  baseUrl: z.string().min(4, 'Base URL is required').max(500),
  modelName: z.string().min(1, 'Model name is required').max(200),
  apiKey: z.string().max(500).optional().default(''),
})

export type JudgeFormValues = z.input<typeof judgeSchema>

interface Props {
  open: boolean
  judge?: JudgeModel | null
  onClose: () => void
  onSubmit: (values: JudgeFormValues) => Promise<void>
}

const inputClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring'

export function JudgeFormDialog({ open, judge, onClose, onSubmit }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<JudgeFormValues>({
    resolver: zodResolver(judgeSchema),
    defaultValues: { name: '', description: '', baseUrl: '', modelName: '', apiKey: '' },
  })

  useEffect(() => {
    if (open) {
      reset({
        name: judge?.name ?? '',
        description: judge?.description ?? '',
        baseUrl: judge?.baseUrl ?? '',
        modelName: judge?.modelName ?? '',
        apiKey: '',
      })
    }
  }, [open, judge, reset])

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{judge ? `Edit ${judge.name}` : 'New judge model'}</DialogTitle>
          <DialogDescription>
            A reusable judge endpoint (OpenAI-compatible). Cheap or local models are great for
            judging; keys are encrypted and never shown again.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={handleSubmit(async (values) => {
            await onSubmit(values)
            reset()
          })}
        >
          <div>
            <label htmlFor="jname" className="mb-1 block text-sm text-muted-foreground">
              Name
            </label>
            <input id="jname" autoComplete="off" {...register('name')} className={inputClass} placeholder="Local Qwen Judge" />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>
          <div>
            <label htmlFor="jdesc" className="mb-1 block text-sm text-muted-foreground">
              Description
            </label>
            <input
              id="jdesc"
              autoComplete="off"
              {...register('description')}
              className={inputClass}
              placeholder="cheap local judge"
            />
          </div>
          <div>
            <label htmlFor="jbase" className="mb-1 block text-sm text-muted-foreground">
              Base URL
            </label>
            <input
              id="jbase"
              autoComplete="off"
              {...register('baseUrl')}
              className={inputClass}
              placeholder="http://localhost:11434/v1"
            />
            {errors.baseUrl && <p className="mt-1 text-xs text-red-600">{errors.baseUrl.message}</p>}
          </div>
          <div>
            <label htmlFor="jmodel" className="mb-1 block text-sm text-muted-foreground">
              Model name
            </label>
            <input
              id="jmodel"
              autoComplete="off"
              {...register('modelName')}
              className={inputClass}
              placeholder="qwen2.5:7b"
            />
            {errors.modelName && (
              <p className="mt-1 text-xs text-red-600">{errors.modelName.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="jkey" className="mb-1 block text-sm text-muted-foreground">
              API key {judge ? '(leave blank to keep current)' : ''}
            </label>
            <input
              id="jkey"
              type="password"
              autoComplete="new-password"
              {...register('apiKey')}
              className={inputClass}
              placeholder={judge ? judge.apiKeyMasked || '(none)' : 'optional — local endpoints need none'}
            />
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-input px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {isSubmitting ? 'Saving…' : judge ? 'Save changes' : 'Create'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
