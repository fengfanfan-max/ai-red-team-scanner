import { useQuery } from '@tanstack/react-query'

import { listAttacks } from '@/api/scans'
import { useCreateScanStore } from '../stores/useCreateScanStore'

export function SelectAlgorithmStep() {
  const attackKeys = useCreateScanStore((s) => s.attackKeys)
  const toggleAttack = useCreateScanStore((s) => s.toggleAttack)
  const { data: attacks = [], isLoading } = useQuery({ queryKey: ['attacks'], queryFn: listAttacks })

  if (isLoading) return <p className="text-sm text-neutral-400">Loading…</p>

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Choose one or more attack techniques. Each selected attack runs the dataset through
        that transformation (baseline = no attack). The model is probed under every combo.
      </p>
      {attacks.map((attack) => {
        const checked = attackKeys.includes(attack.key)
        return (
          <button
            key={attack.key}
            type="button"
            onClick={() => toggleAttack(attack.key)}
            className={`w-full rounded-lg border p-4 text-left transition-colors ${
              checked ? 'border-primary bg-primary/5' : 'border-border bg-surface hover:border-neutral-300'
            }`}
          >
            <p className="text-sm font-medium">
              {attack.name} {checked && <span className="text-xs text-primary">· selected</span>}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{attack.description}</p>
          </button>
        )
      })}
    </div>
  )
}
