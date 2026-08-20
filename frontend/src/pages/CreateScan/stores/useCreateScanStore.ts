import { create } from 'zustand'

import type { DatasetRef } from '@/types/scans'

export interface CreateScanState {
  step: number
  applicationId: number | null
  algorithm: string
  datasetRefs: DatasetRef[]
  concurrency: number
  qpm: number
  failThreshold: number
  judgeId: number | null
  judgeBaseUrl: string
  judgeModel: string
  judgeApiKey: string
}

interface CreateScanActions {
  setStep: (step: number) => void
  next: () => void
  prev: () => void
  setApplication: (id: number | null) => void
  setAlgorithm: (algorithm: string) => void
  toggleDataset: (ref: DatasetRef) => void
  setAdvanced: (patch: Partial<Pick<CreateScanState, 'concurrency' | 'qpm' | 'failThreshold'>>) => void
  setJudgeId: (id: number | null) => void
  setJudgeConfig: (patch: Partial<Pick<CreateScanState, 'judgeBaseUrl' | 'judgeModel' | 'judgeApiKey'>>) => void
  reset: () => void
}

export const TOTAL_STEPS = 5

const initialState: CreateScanState = {
  step: 0,
  applicationId: null,
  algorithm: 'Default Tests',
  datasetRefs: [],
  concurrency: 4,
  qpm: 60,
  failThreshold: 5.0,
  judgeId: null,
  judgeBaseUrl: '',
  judgeModel: '',
  judgeApiKey: '',
}

export const useCreateScanStore = create<CreateScanState & CreateScanActions>((set) => ({
  ...initialState,
  setStep: (step) => set({ step }),
  next: () => set((s) => ({ step: Math.min(s.step + 1, TOTAL_STEPS - 1) })),
  prev: () => set((s) => ({ step: Math.max(s.step - 1, 0) })),
  setApplication: (applicationId) => set({ applicationId }),
  setAlgorithm: (algorithm) => set({ algorithm }),
  toggleDataset: (ref) =>
    set((s) => {
      const key = (r: DatasetRef) => `${r.source}:${r.ref}`
      const exists = s.datasetRefs.some((r) => key(r) === key(ref))
      return {
        datasetRefs: exists
          ? s.datasetRefs.filter((r) => key(r) !== key(ref))
          : [...s.datasetRefs, ref],
      }
    }),
  setAdvanced: (patch) => set(patch),
  setJudgeId: (judgeId) => set({ judgeId }),
  setJudgeConfig: (patch) => set(patch),
  reset: () => set(initialState),
}))
