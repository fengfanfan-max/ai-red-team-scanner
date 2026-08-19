import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { createScan } from '@/api/scans'
import { STEP_TITLES } from './constants'
import { TOTAL_STEPS, useCreateScanStore } from './stores/useCreateScanStore'
import { AdvancedSettingsStep } from './steps/AdvancedSettingsStep'
import { SelectAlgorithmStep } from './steps/SelectAlgorithmStep'
import { SelectApplicationStep } from './steps/SelectApplicationStep'
import { SelectDatasetsStep } from './steps/SelectDatasetsStep'
import { TestChatStep } from './steps/TestChatStep'

export function CreateScanPage() {
  const navigate = useNavigate()
  const store = useCreateScanStore()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: () =>
      createScan({
        name: `scan-${new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-')}`,
        application_id: store.applicationId!,
        algorithm: store.algorithm,
        datasets: store.datasetRefs,
        concurrency: store.concurrency,
        qpm: store.qpm,
        fail_threshold: store.failThreshold,
        judge:
          store.judgeBaseUrl && store.judgeModel
            ? {
                base_url: store.judgeBaseUrl,
                model: store.judgeModel,
                api_key: store.judgeApiKey,
              }
            : undefined,
      }),
    onSuccess: (scan) => {
      store.reset()
      navigate('/scans')
      void scan
    },
  })

  const canNext =
    store.step === 0 ? store.applicationId !== null
    : store.step === 2 ? store.datasetRefs.length > 0
    : true

  const canSubmit =
    store.applicationId !== null &&
    store.datasetRefs.length > 0 &&
    store.concurrency >= 1 &&
    store.concurrency <= 32 &&
    store.qpm >= 1 &&
    store.qpm <= 10000 &&
    store.failThreshold >= 0 &&
    store.failThreshold <= 10

  const steps = [
    <SelectApplicationStep key="app" />,
    <SelectAlgorithmStep key="algo" />,
    <SelectDatasetsStep key="ds" />,
    <TestChatStep key="chat" />,
    <AdvancedSettingsStep key="adv" />,
  ]

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-xl font-semibold">New scan</h2>

      {/* step indicator */}
      <ol className="mt-4 flex items-center gap-1 text-xs">
        {STEP_TITLES.map((title, i) => (
          <li key={title} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => store.setStep(i)}
              className={`rounded-full px-2.5 py-1 ${
                i === store.step
                  ? 'bg-primary text-white'
                  : i < store.step
                    ? 'text-primary'
                    : 'text-neutral-400'
              }`}
            >
              {i + 1}. {title}
            </button>
            {i < TOTAL_STEPS - 1 && <span className="text-neutral-300">→</span>}
          </li>
        ))}
      </ol>

      <div className="mt-6">{steps[store.step]}</div>

      {submitError && <p className="mt-4 text-sm text-red-600">{submitError}</p>}

      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={store.prev}
          disabled={store.step === 0}
          className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-40"
        >
          Back
        </button>

        {store.step < TOTAL_STEPS - 1 ? (
          <button
            type="button"
            onClick={() => {
              setSubmitError(null)
              store.next()
            }}
            disabled={!canNext}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            disabled={!canSubmit || createMutation.isPending}
            onClick={() => {
              setSubmitError(null)
              createMutation.mutate(undefined, {
                onError: (err) =>
                  setSubmitError(err instanceof Error ? err.message : 'Failed to start scan'),
              })
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {createMutation.isPending ? 'Starting…' : 'Start scan'}
          </button>
        )}
      </div>
    </div>
  )
}
