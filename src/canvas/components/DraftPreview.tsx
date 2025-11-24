import { useMemo } from 'react'
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react'
import type { CEEDraftResponse } from '../../adapters/cee/types'
import { typography } from '../../styles/typography'
import { Spinner } from '../../components/Spinner'

interface DraftPreviewProps {
  draft: CEEDraftResponse
  loading?: boolean
  onAccept: () => void
  onReject: () => void
}

// Tailwind-safe quality config with static class names
function getQualityConfig(quality: number) {
  if (quality >= 7) {
    return {
      containerClasses: 'bg-mint-50 border-mint-200',
      iconClasses: 'text-mint-600',
      icon: CheckCircle,
      label: 'Ready to use',
      actionText: 'Accept Draft',
    }
  } else if (quality >= 4) {
    return {
      containerClasses: 'bg-sun-50 border-sun-200',
      iconClasses: 'text-sun-600',
      icon: AlertTriangle,
      label: 'Review recommended',
      actionText: 'Review & Edit',
    }
  } else {
    return {
      containerClasses: 'bg-carrot-50 border-carrot-200',
      iconClasses: 'text-carrot-600',
      icon: AlertCircle,
      label: 'Needs improvement',
      actionText: 'Improve & Retry',
    }
  }
}

export function DraftPreview({ draft, loading, onAccept, onReject }: DraftPreviewProps) {
  const config = useMemo(() => getQualityConfig(draft.quality_overall), [draft.quality_overall])
  const Icon = config.icon

  const uncertainNodes = useMemo(
    () => draft.nodes.filter(n => n.uncertainty > 0.4),
    [draft.nodes]
  )

  return (
    <div className="space-y-4 p-4 bg-white rounded-lg border border-sand-200 shadow-panel">
      {/* Quality Badge */}
      <div className={`
        flex items-center gap-3 p-3 rounded-lg border
        ${config.containerClasses}
      `}>
        <Icon className={`w-5 h-5 ${config.iconClasses}`} />
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className={typography.label}>
              Draft Quality: {draft.quality_overall}/10
            </span>
            <span className={`${typography.caption} text-ink-900/60`}>
              {config.label}
            </span>
          </div>
        </div>
      </div>

      {/* Graph Summary */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className={typography.label}>Graph Structure</span>
          <span className={`${typography.caption} text-ink-900/60`}>
            {draft.nodes.length} nodes · {draft.edges.length} edges
          </span>
        </div>

        {/* Uncertain Nodes Warning */}
        {uncertainNodes.length > 0 && (
          <div className="flex items-start gap-2 p-2 bg-sun-50 rounded">
            <AlertTriangle className="w-4 h-4 text-sun-600 mt-0.5 flex-shrink-0" />
            <p className={`${typography.bodySmall} text-sun-800`}>
              {uncertainNodes.length} node{uncertainNodes.length !== 1 ? 's' : ''} marked as uncertain
              (shown with dotted borders)
            </p>
          </div>
        )}

        {/* Structural Warnings */}
        {draft.draft_warnings.structural.length > 0 && (
          <div className="flex items-start gap-2 p-2 bg-sun-50 border border-sun-200 rounded">
            <AlertCircle className="w-4 h-4 text-sun-700 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className={`${typography.bodySmall} text-sun-800`}>
                {draft.draft_warnings.structural.length} structural issue
                {draft.draft_warnings.structural.length !== 1 ? 's' : ''} detected
              </p>
              <button className={`${typography.caption} text-sky-600 underline hover:text-sky-700`}>
                View details
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mini Graph Preview */}
      <div className="relative border border-sand-200 rounded-lg p-4 bg-canvas-25 min-h-[200px]">
        <p className={`${typography.caption} text-ink-900/50 text-center py-8`}>
          Graph preview will appear on canvas
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={onAccept}
          disabled={loading}
          className={`
            ${typography.button} flex-1 py-2.5 rounded
            bg-sky-500 text-white hover:bg-sky-600
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
          `}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner size="sm" className="text-white" />
              <span>Adding to canvas...</span>
            </span>
          ) : (
            config.actionText
          )}
        </button>

        <button
          onClick={onReject}
          disabled={loading}
          className={`
            ${typography.button} px-6 py-2.5 rounded
            border border-sand-200 hover:bg-paper-50
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
          `}
        >
          Cancel
        </button>
      </div>

      {/* Low Quality Help */}
      {draft.quality_overall < 4 && draft.draft_warnings.completeness.length > 0 && (
        <div className="space-y-2 p-3 bg-paper-50 rounded border-l-4 border-sky-500">
          <p className={`${typography.label} text-ink-900`}>
            💡 To improve quality, consider including:
          </p>
          <ul className="space-y-1">
            {draft.draft_warnings.completeness.slice(0, 5).map((suggestion, i) => (
              <li key={i} className={`${typography.bodySmall} text-ink-900/70`}>
                • {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
