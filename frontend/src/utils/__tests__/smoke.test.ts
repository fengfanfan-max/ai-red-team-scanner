import { describe, expect, it } from 'vitest'

export function add(a: number, b: number): number {
  return a + b
}

describe('smoke', () => {
  it('runs tests', () => {
    expect(add(1, 2)).toBe(3)
  })
})
