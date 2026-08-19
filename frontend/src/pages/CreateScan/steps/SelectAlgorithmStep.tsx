import { ALGORITHMS } from '../constants'
import { useCreateScanStore } from '../stores/useCreateScanStore'

export function SelectAlgorithmStep() {
  const algorithm = useCreateScanStore((s) => s.algorithm)
  const setAlgorithm = useCreateScanStore((s) => s.setAlgorithm)

  return (
    <div className="space-y-3">
      {ALGORITHMS.map((algo) => (
        <button
          key={algo.id}
          type="button"
          onClick={() => setAlgorithm(algo.id)}
          className={`w-full rounded-lg border p-4 text-left transition-colors ${
            algorithm === algo.id
              ? 'border-primary bg-primary/5'
              : 'border-border bg-surface hover:border-neutral-300'
          }`}
        >
          <p className="text-sm font-medium">{algo.id}</p>
          <p className="mt-1 text-xs text-neutral-500">{algo.description}</p>
        </button>
      ))}
    </div>
  )
}
