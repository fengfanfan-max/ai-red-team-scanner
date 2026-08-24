import { useQuery } from '@tanstack/react-query'

import { listApplications } from '@/api/applications'
import { listDatasets } from '@/api/datasets'
import { listJudges } from '@/api/judges'
import { useCreateScanStore } from '../stores/useCreateScanStore'

/**
 * Step 5: concurrency/QPM/fail threshold + judge selection (preset or
 * inline override). Shows the expected LLM call count (= cases × 2: target
 * + judge) so the cost is transparent before starting (CONTEXT.md).
 */
export function AdvancedSettingsStep() {
  const state = useCreateScanStore()
  const { setAdvanced, setJudgeId, setJudgeConfig } = state

  const { data: appsData } = useQuery({ queryKey: ['applications'], queryFn: listApplications })
  const { data: dsData } = useQuery({ queryKey: ['datasets'], queryFn: listDatasets })
  const { data: judges = [] } = useQuery({ queryKey: ['judges'], queryFn: listJudges })

  const totalCases =
    state.datasetRefs.reduce((sum, ref) => {
      if (ref.source === 'builtin') {
        const d = dsData?.builtin.find((b) => b.name === ref.ref)
        return sum + (d ? d.subcategories.reduce((n, s) => n + s.prompts.length, 0) : 0)
      }
      const d = dsData?.custom.find((c) => String(c.id) === ref.ref)
      return sum + (d ? d.promptCount : 0)
    }, 0) ?? 0

  const llmCalls = totalCases * 2
  const selectedApp = appsData?.find((a) => a.id === state.applicationId)

  const inputClass =
    'w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary'

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="concurrency" className="mb-1 block text-sm text-neutral-600 dark:text-neutral-300">
            Concurrency
          </label>
          <input
            id="concurrency"
            type="number"
            min={1}
            max={32}
            value={state.concurrency}
            onChange={(e) => setAdvanced({ concurrency: Number(e.target.value) })}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-neutral-400">Parallel requests (1–32)</p>
        </div>
        <div>
          <label htmlFor="qpm" className="mb-1 block text-sm text-neutral-600 dark:text-neutral-300">
            QPM
          </label>
          <input
            id="qpm"
            type="number"
            min={1}
            max={10000}
            value={state.qpm}
            onChange={(e) => setAdvanced({ qpm: Number(e.target.value) })}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-neutral-400">Rate limit, queries per minute</p>
        </div>
        <div>
          <label htmlFor="threshold" className="mb-1 block text-sm text-neutral-600 dark:text-neutral-300">
            Fail threshold
          </label>
          <input
            id="threshold"
            type="number"
            min={0}
            max={10}
            step={0.5}
            value={state.failThreshold}
            onChange={(e) => setAdvanced({ failThreshold: Number(e.target.value) })}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-neutral-400">Judge score at/above = failed (0–10)</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-medium">Judge model</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Pick a preset judge, or leave it to follow the target model. For lower cost, use a
          cheap or local endpoint (e.g. Ollama).
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setJudgeId(null)}
            className={`rounded-full border px-3 py-1 text-xs ${
              state.judgeId === null && !state.judgeModel
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            Follow target (default)
          </button>
          {judges.map((judge) => (
            <button
              key={judge.id}
              type="button"
              onClick={() => setJudgeId(judge.id)}
              className={`rounded-full border px-3 py-1 text-xs ${
                state.judgeId === judge.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
              title={`${judge.baseUrl} · ${judge.modelName}`}
            >
              {judge.name}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <input
            autoComplete="off"
            placeholder="override base URL (optional)"
            value={state.judgeBaseUrl}
            onChange={(e) => setJudgeConfig({ judgeBaseUrl: e.target.value })}
            className={inputClass}
          />
          <input
            autoComplete="off"
            placeholder="override model name (optional)"
            value={state.judgeModel}
            onChange={(e) => setJudgeConfig({ judgeModel: e.target.value })}
            className={inputClass}
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="override api key (optional)"
            value={state.judgeApiKey}
            onChange={(e) => setJudgeConfig({ judgeApiKey: e.target.value })}
            className={inputClass}
          />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4 text-sm">
        <p className="font-medium">Cost estimate</p>
        <dl className="mt-2 space-y-1 text-xs text-neutral-600 dark:text-neutral-300">
          <div className="flex justify-between">
            <dt>Cases</dt>
            <dd>{totalCases}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Target model</dt>
            <dd>{selectedApp ? selectedApp.modelName : '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Expected LLM calls</dt>
            <dd className="font-medium text-neutral-900 dark:text-neutral-100">{llmCalls} (cases × 2)</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
