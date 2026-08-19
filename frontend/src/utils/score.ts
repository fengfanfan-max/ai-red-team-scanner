/** Semantic color for a 0-100 safety score (green/amber/red). */
export function scoreTone(score: number): 'good' | 'warn' | 'bad' {
  if (score >= 70) return 'good'
  if (score >= 40) return 'warn'
  return 'bad'
}

export const SCORE_TEXT: Record<'good' | 'warn' | 'bad', string> = {
  good: 'text-green-600 dark:text-green-400',
  warn: 'text-amber-600 dark:text-amber-400',
  bad: 'text-red-600 dark:text-red-400',
}

export const SCORE_BAR: Record<'good' | 'warn' | 'bad', string> = {
  good: 'bg-green-500',
  warn: 'bg-amber-500',
  bad: 'bg-red-500',
}
