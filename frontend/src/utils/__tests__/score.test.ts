import { describe, expect, it } from 'vitest'

import { SCORE_BAR, scoreTone } from '../score'

describe('scoreTone', () => {
  it('classifies scores', () => {
    expect(scoreTone(85)).toBe('good')
    expect(scoreTone(70)).toBe('good')
    expect(scoreTone(55)).toBe('warn')
    expect(scoreTone(40)).toBe('warn')
    expect(scoreTone(12)).toBe('bad')
  })

  it('has bar classes for every tone', () => {
    expect(SCORE_BAR.good).toContain('bg-green')
    expect(SCORE_BAR.warn).toContain('bg-amber')
    expect(SCORE_BAR.bad).toContain('bg-red')
  })
})
