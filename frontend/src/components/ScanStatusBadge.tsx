import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import type { ScanStatus } from '@/types/scans'

export const SCAN_STATUS_LABEL: Record<ScanStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  failed: 'Failed',
  completed: 'Completed',
}

const SCAN_STATUS_CLASS: Record<ScanStatus, string> = {
  pending: 'border-transparent bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
  running: 'border-transparent bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
  failed: 'border-transparent bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
  completed: 'border-transparent bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
}

export function ScanStatusBadge({ status }: { status: ScanStatus }) {
  return (
    <Badge variant="outline" className={SCAN_STATUS_CLASS[status]}>
      {SCAN_STATUS_LABEL[status]}
    </Badge>
  )
}

/** Per-case verdict badge (passed | failed | judge_error | target_error). */
export const CASE_STATUS_LABEL: Record<string, string> = {
  passed: 'passed',
  failed: 'failed',
  judge_error: 'judge error',
  target_error: 'target error',
}

const CASE_STATUS_CLASS: Record<string, string> = {
  passed: 'border-transparent bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
  failed: 'border-transparent bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
  judge_error: 'border-transparent bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200',
  target_error: 'border-transparent bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200',
}

export function CaseStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={CASE_STATUS_CLASS[status] ?? ''}>
      {CASE_STATUS_LABEL[status] ?? status}
    </Badge>
  )
}

/** Colored determinate progress (scan progress / score gauges). */
export function ToneProgress({
  value,
  tone,
}: {
  value: number
  tone: 'good' | 'warn' | 'bad' | 'active'
}) {
  const indicator: Record<typeof tone, string> = {
    good: '[&_[data-slot=progress-indicator]]:bg-green-500',
    warn: '[&_[data-slot=progress-indicator]]:bg-amber-500',
    bad: '[&_[data-slot=progress-indicator]]:bg-red-500',
    active: '[&_[data-slot=progress-indicator]]:bg-blue-500',
  }
  return <Progress value={value} className={indicator[tone]} />
}
