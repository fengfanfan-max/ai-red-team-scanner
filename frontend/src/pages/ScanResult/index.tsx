import { useParams } from 'react-router-dom'

/** Placeholder — full result page lands in M5. */
export function ScanResultPage() {
  const { scanId } = useParams()
  return (
    <div className="mx-auto max-w-4xl">
      <h2 className="text-xl font-semibold">Scan result</h2>
      <p className="mt-2 text-sm text-neutral-500">
        Scan #{scanId} — the full result page (safety score, risk distribution, failure cases)
        arrives in M5.
      </p>
    </div>
  )
}
