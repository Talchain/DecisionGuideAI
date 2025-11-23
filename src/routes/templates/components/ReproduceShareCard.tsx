import { memo, useCallback } from 'react'
import type { ReportV1, TemplateDetail } from '../../../adapters/plot'

interface ReproduceShareCardProps {
  report: ReportV1
  template: TemplateDetail
  seed: number
  onCopySeed?: () => void
  onCopyHash?: () => void
  onAddToNote?: () => void
}

const formatHash = (hash: string): string => {
  if (hash.length <= 16) return hash
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`
}

export const ReproduceShareCard = memo<ReproduceShareCardProps>(({
  report,
  template,
  seed,
  onCopySeed,
  onCopyHash,
  onAddToNote
}) => {
  const handleCopySeed = useCallback(() => {
    navigator.clipboard.writeText(seed.toString())
    onCopySeed?.()
  }, [seed, onCopySeed])

  const handleCopyHash = useCallback(() => {
    if (report.model_card?.response_hash) {
      navigator.clipboard.writeText(report.model_card.response_hash)
      onCopyHash?.()
    }
  }, [report.model_card?.response_hash, onCopyHash])

  return (
    <div className="bg-white border rounded-lg p-6" data-testid="reproduce-card">
      <h3 className="text-lg font-semibold mb-4">Reproduce and share</h3>
      
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Template</span>
          <span className="text-sm font-mono">{template.name} @ {template.version}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Seed</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono">{seed}</span>
            <button
              onClick={handleCopySeed}
              className="text-xs text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded px-1"
              data-testid="copy-seed"
              aria-label="Copy seed"
            >
              Copy
            </button>
          </div>
        </div>

        {report.model_card?.response_hash && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Verification Hash</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono">
                {formatHash(report.model_card.response_hash)}
              </span>
              <button
                onClick={handleCopyHash}
                className="text-xs text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded px-1"
                data-testid="copy-hash"
                aria-label="Copy verification hash"
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={onAddToNote}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        data-testid="add-to-note"
      >
        Add note
      </button>
    </div>
  )
})

ReproduceShareCard.displayName = 'ReproduceShareCard'
