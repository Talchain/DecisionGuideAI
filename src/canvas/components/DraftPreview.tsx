import { useMemo } from 'react'
import { CloudOff } from 'lucide-react'
import type { CEEDraftResponse } from '../../adapters/cee/types'
import { typography } from '../../styles/typography'
import { Spinner } from '../../components/Spinner'
import { generateTemplatePreview } from '../utils/templatePreview'
import type { NodeKind } from '../../templates/blueprints/types'

interface DraftPreviewProps {
  draft: CEEDraftResponse | null | undefined
  loading?: boolean
  onAccept?: () => void
  onReject?: () => void
  // Summary mode props (for auto-apply flow)
  mode?: 'preview' | 'summary'
  isOnCanvas?: boolean
  onRemove?: () => void
  onReinstate?: () => void
  onClose?: () => void
}

function normalizeDraftType(node: { type?: string; kind?: string } | string | undefined): string {
  if (typeof node === 'string') return node.toLowerCase()
  return ((node?.kind || node?.type) || '').toLowerCase()
}

function mapDraftTypeToNodeKind(node: { type?: string; kind?: string }): NodeKind {
  const t = normalizeDraftType(node)
  if (t === 'goal') return 'goal'
  if (t === 'decision') return 'decision'
  if (t === 'option') return 'option'
  if (t === 'outcome') return 'outcome'
  if (t === 'risk') return 'risk'
  if (t === 'event') return 'event'
  if (t === 'factor') return 'event'
  return 'decision'
}

export function DraftPreview({
  draft,
  loading,
  onAccept,
  onReject,
  mode = 'preview',
  isOnCanvas = false,
  onRemove,
  onReinstate,
}: DraftPreviewProps) {
  // Null-safe derived values - prevent crashes when draft is missing or incomplete
  const nodes = draft?.nodes ?? []
  const edges = draft?.edges ?? []
  const previewUrl = useMemo(() => {
    if (!nodes.length) return null

    const blueprintNodes = nodes.map((n, index) => ({
      id: n.id || String(index),
      label: n.label,
      kind: mapDraftTypeToNodeKind(n),
    }))

    const blueprintEdges = edges.map((e, index) => ({
      id: `e-${index}`,
      from: e.from,
      to: e.to,
    }))

    try {
      return generateTemplatePreview(blueprintNodes as any, blueprintEdges as any)
    } catch {
      return null
    }
  }, [nodes, edges])

  // Empty/unavailable state - show friendly message instead of crashing
  if (!draft || nodes.length === 0) {
    return (
      <div className="space-y-4 p-4 bg-white rounded-lg border border-sand-200 shadow-panel" data-testid="draft-preview-empty">
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-paper-50 border-sand-200">
          <CloudOff className="w-5 h-5 text-ink-900" />
          <div className="flex-1">
            <p className={`${typography.label} text-ink-900`}>
              No draft available
            </p>
            <p className={`${typography.caption} text-ink-900`}>
              The AI assistant couldn't generate a draft. Try describing your decision differently or check your connection.
            </p>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button
            onClick={onReject}
            className={`
              ${typography.button} flex-1 py-2.5 rounded
              border border-sand-200 hover:bg-paper-50
              transition-colors
            `}
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 bg-white rounded-lg border border-sand-200 shadow-panel" data-testid="draft-preview">
      {/* Mini Graph Preview - only in preview mode */}
      {mode === 'preview' && (
        <div className="relative border border-sand-200 rounded-lg p-3 bg-canvas min-h-[200px] flex items-center justify-center">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Draft graph preview"
              className="max-w-full max-h-[180px] mx-auto"
            />
          ) : (
            <p className={`${typography.caption} text-ink-900 text-center py-8`}>
              Graph preview will appear on canvas
            </p>
          )}
        </div>
      )}

      {/* Actions - different buttons for preview vs summary mode */}
      <div className="flex gap-2 pt-2">
        {mode === 'preview' && onAccept && onReject ? (
          <>
            <button
              onClick={onAccept}
              disabled={loading}
              className={`
                ${typography.button} flex-1 py-2.5 rounded
                bg-mint-500 text-white hover:bg-mint-600
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
                'Add to canvas'
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
          </>
        ) : mode === 'summary' ? (
          <>
            <button
              onClick={isOnCanvas ? onRemove : onReinstate}
              className={`
                ${typography.button} px-4 py-2.5 rounded
                ${isOnCanvas
                  ? 'border border-carrot-300 text-carrot-700 hover:bg-carrot-50'
                  : 'border border-mint-300 text-mint-700 hover:bg-mint-50'
                }
                transition-colors
              `}
            >
              {isOnCanvas ? 'Remove' : 'Reinstate'}
            </button>
          </>
        ) : null}
      </div>

    </div>
  )
}
