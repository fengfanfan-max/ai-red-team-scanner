import { beforeEach, describe, expect, it } from 'vitest'

import { TOTAL_STEPS, useCreateScanStore } from '../useCreateScanStore'

describe('useCreateScanStore', () => {
  beforeEach(() => {
    useCreateScanStore.getState().reset()
  })

  it('navigates steps within bounds', () => {
    const s = useCreateScanStore.getState()
    expect(s.step).toBe(0)
    s.next()
    expect(useCreateScanStore.getState().step).toBe(1)
    s.prev()
    expect(useCreateScanStore.getState().step).toBe(0)
    // can't go below 0
    s.prev()
    expect(useCreateScanStore.getState().step).toBe(0)
    // can't go past the last step
    for (let i = 0; i < TOTAL_STEPS + 2; i++) {
      useCreateScanStore.getState().next()
    }
    expect(useCreateScanStore.getState().step).toBe(TOTAL_STEPS - 1)
  })

  it('selects an application', () => {
    useCreateScanStore.getState().setApplication(7)
    expect(useCreateScanStore.getState().applicationId).toBe(7)
  })

  it('toggles datasets by source+ref (idempotent)', () => {
    const s = useCreateScanStore.getState()
    s.toggleDataset({ source: 'builtin', ref: 'Content Safety' })
    s.toggleDataset({ source: 'custom', ref: '3' })
    expect(useCreateScanStore.getState().datasetRefs).toHaveLength(2)

    s.toggleDataset({ source: 'builtin', ref: 'Content Safety' })
    expect(useCreateScanStore.getState().datasetRefs).toHaveLength(1)
    expect(useCreateScanStore.getState().datasetRefs[0]).toEqual({ source: 'custom', ref: '3' })
  })

  it('updates advanced settings and judge config', () => {
    const s = useCreateScanStore.getState()
    s.setAdvanced({ concurrency: 8, qpm: 120 })
    s.setJudgeConfig({ judgeBaseUrl: 'http://localhost:11434/v1', judgeModel: 'qwen2.5:7b' })
    const state = useCreateScanStore.getState()
    expect(state.concurrency).toBe(8)
    expect(state.qpm).toBe(120)
    expect(state.judgeBaseUrl).toBe('http://localhost:11434/v1')
    expect(state.judgeModel).toBe('qwen2.5:7b')
  })

  it('reset restores defaults', () => {
    const s = useCreateScanStore.getState()
    s.setApplication(1)
    s.toggleDataset({ source: 'builtin', ref: 'X' })
    s.setAdvanced({ concurrency: 32 })
    s.reset()
    const state = useCreateScanStore.getState()
    expect(state.applicationId).toBeNull()
    expect(state.datasetRefs).toEqual([])
    expect(state.concurrency).toBe(4)
    expect(state.qpm).toBe(60)
    expect(state.step).toBe(0)
  })

  it('preset judge and inline override are mutually exclusive', () => {
    const s = useCreateScanStore.getState()
    // selecting a preset clears any inline override
    s.setJudgeConfig({ judgeBaseUrl: 'https://api.openai.com/v1', judgeModel: 'gpt-4o' })
    s.selectJudge(3)
    let state = useCreateScanStore.getState()
    expect(state.judgeId).toBe(3)
    expect(state.judgeBaseUrl).toBe('')
    expect(state.judgeModel).toBe('')

    // editing an override deselects the preset
    s.setJudgeConfig({ judgeModel: 'qwen2.5:7b' })
    state = useCreateScanStore.getState()
    expect(state.judgeId).toBeNull()
    expect(state.judgeModel).toBe('qwen2.5:7b')

    // deselecting keeps whatever overrides were set before selection? no —
    // selection cleared them, so deselect leaves empty overrides
    s.selectJudge(1)
    s.selectJudge(null)
    state = useCreateScanStore.getState()
    expect(state.judgeId).toBeNull()
    expect(state.judgeBaseUrl).toBe('')
  })
})
