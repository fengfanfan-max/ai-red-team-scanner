import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  applicationSchema,
  type ApplicationFormValues,
} from '../applicationSchema'
import type { AIApplication } from '@/types/applications'

interface Props {
  open: boolean
  /** When set, the dialog edits this application; otherwise it creates. */
  application?: AIApplication | null
  onClose: () => void
  onSubmit: (values: ApplicationFormValues) => Promise<void>
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm text-muted-foreground">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

const inputClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring'

export function ApplicationFormDialog({ open, application, onClose, onSubmit }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      name: '',
      baseUrl: '',
      apiKey: '',
      modelName: '',
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        name: application?.name ?? '',
        baseUrl: application?.baseUrl ?? '',
        // api key is write-only: never prefill the masked value
        apiKey: '',
        modelName: application?.modelName ?? '',
      })
    }
  }, [open, application, reset])

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{application ? `Edit ${application.name}` : 'New AI application'}</DialogTitle>
          <DialogDescription>
            Connect an OpenAI-compatible model endpoint. API keys are encrypted and never shown
            again.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={handleSubmit(async (values) => {
            await onSubmit(values)
            reset()
          })}
        >
          <Field label="Name" htmlFor="name" error={errors.name?.message}>
            <input id="name" {...register('name')} className={inputClass} placeholder="My GPT" />
          </Field>
          <Field label="Base URL" htmlFor="baseUrl" error={errors.baseUrl?.message}>
            <input
              id="baseUrl"
              {...register('baseUrl')}
              className={inputClass}
              placeholder="https://api.openai.com/v1"
            />
          </Field>
          <Field label="Model name" htmlFor="modelName" error={errors.modelName?.message}>
            <input
              id="modelName"
              {...register('modelName')}
              className={inputClass}
              placeholder="gpt-4o-mini"
            />
          </Field>
          <Field
            label={application ? 'API key (leave blank to keep current)' : 'API key'}
            htmlFor="apiKey"
            error={errors.apiKey?.message}
          >
            <input
              id="apiKey"
              type="password"
              {...register('apiKey')}
              className={inputClass}
              placeholder="sk-…"
            />
          </Field>
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
              {isSubmitting ? 'Saving…' : application ? 'Save changes' : 'Create'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
