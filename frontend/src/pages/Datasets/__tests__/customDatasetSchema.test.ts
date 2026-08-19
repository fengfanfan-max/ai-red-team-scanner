import { describe, expect, it } from 'vitest'

import { customDatasetSchema } from '../customDatasetSchema'

const valid = {
  name: 'My Set',
  description: 'test',
  subcategories: [
    { name: 'A', prompts: ['p1', 'p2'] },
    { name: 'B', prompts: ['p3'] },
  ],
}

describe('customDatasetSchema', () => {
  it('accepts a valid dataset', () => {
    expect(customDatasetSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects missing name / empty subcategories', () => {
    expect(customDatasetSchema.safeParse({ ...valid, name: '' }).success).toBe(false)
    expect(customDatasetSchema.safeParse({ ...valid, subcategories: [] }).success).toBe(false)
    expect(
      customDatasetSchema.safeParse({
        ...valid,
        subcategories: [{ name: 'A', prompts: [] }],
      }).success
    ).toBe(false)
  })

  it('rejects too many subcategories', () => {
    const many = {
      ...valid,
      subcategories: Array.from({ length: 21 }, (_, i) => ({
        name: `s${i}`,
        prompts: ['p'],
      })),
    }
    expect(customDatasetSchema.safeParse(many).success).toBe(false)
  })

  it('rejects too many total prompts', () => {
    const big = {
      ...valid,
      subcategories: Array.from({ length: 20 }, (_, i) => ({
        name: `s${i}`,
        prompts: Array.from({ length: 200 }, (_, j) => `p${i}-${j}`),
      })),
    }
    expect(customDatasetSchema.safeParse(big).success).toBe(false)
  })
})
