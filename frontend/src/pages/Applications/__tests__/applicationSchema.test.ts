import { describe, expect, it } from 'vitest'

import { applicationSchema } from '../applicationSchema'

describe('applicationSchema', () => {
  it('accepts a valid payload', () => {
    const result = applicationSchema.safeParse({
      name: 'My GPT',
      baseUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4o-mini',
      apiKey: 'sk-123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name and model name', () => {
    const result = applicationSchema.safeParse({
      name: '',
      baseUrl: 'https://api.openai.com/v1',
      modelName: '',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path[0])).toEqual(
        expect.arrayContaining(['name', 'modelName'])
      )
    }
  })

  it('rejects a too-short base URL', () => {
    const result = applicationSchema.safeParse({
      name: 'X',
      baseUrl: 'abc',
      modelName: 'm',
    })
    expect(result.success).toBe(false)
  })
})
