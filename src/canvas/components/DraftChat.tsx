import { useState } from 'react'
import { useCEEDraft } from '../../hooks/useCEEDraft'
import { DraftPreview } from './DraftPreview'
import { ErrorAlert } from '../../components/ErrorAlert'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { CEEError } from '../../adapters/cee/client'

/** Format CEE error for user-friendly display + debug info */
function formatCEEError(error: CEEError | Error): { message: string; debugInfo?: string } {
  if (error instanceof CEEError) {
    // Map error codes to user-friendly messages
    const friendlyMessages: Record<string, string> = {
      'openai_response_invalid_schema': 'The AI service returned an unexpected response format. This is a temporary backend issue.',
      'timeout': 'The request took too long. The AI service may be starting up - please try again.',
      'rate_limit': 'Too many requests. Please wait a moment and try again.',
    }

    const friendlyMessage = friendlyMessages[error.message] || error.message
    const debugParts = [`Code: ${error.message}`, `Status: ${error.status}`]
    if (error.correlationId) {
      debugParts.push(`ID: ${error.correlationId.slice(0, 8)}...`)
    }

    return {
      message: friendlyMessage,
      debugInfo: debugParts.join(' | '),
    }
  }

  return { message: error.message }
}

export function DraftChat() {
  const [description, setDescription] = useState('')
  const { data: draft, loading, error, draft: generateDraft } = useCEEDraft()
  const { showDraftChat, setShowDraftChat, addNodes, addEdges } = useCanvasStore()

  const handleDraft = async () => {
    if (!description.trim()) return

    try {
      await generateDraft(description)
    } catch (err) {
      console.error('Draft failed:', err)
    }
  }

  const handleAccept = () => {
    // Null-safe: bail out if draft or nodes/edges are missing
    if (!draft?.nodes?.length) return

    // Convert CEE nodes to canvas nodes
    const nodes = draft.nodes.map(n => ({
      id: n.id,
      type: n.type,
      position: { x: 0, y: 0 }, // Layout algorithm will position
      data: {
        label: n.label,
        uncertainty: n.uncertainty,
      },
    }))

    const edges = (draft.edges ?? []).map((e, i) => ({
      id: `e-${i}`,
      source: e.from,
      target: e.to,
      type: 'default',
    }))

    addNodes(nodes)
    addEdges(edges)
    setShowDraftChat(false)
  }

  const handleReject = () => {
    setShowDraftChat(false)
  }

  // Don't render if panel is closed
  if (!showDraftChat) {
    return null
  }

  return (
    <div className="fixed left-1/2 -translate-x-1/2 z-[2000] w-full max-w-xl px-4"
         style={{ bottom: 'calc(var(--bottombar-h) + 1rem)' }}>

      {!draft ? (
        /* Input Form */
        <div className="bg-white rounded-lg border border-sand-200 shadow-panel p-4 space-y-4">
          <div>
            <label className={`${typography.label} block mb-2`}>
              Describe your decision
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="E.g., We're deciding whether to increase our SaaS pricing from £40/month to £50/month. Key factors include competitor pricing, customer churn risk, and revenue impact..."
              rows={4}
              className={`
                ${typography.body} w-full p-3 rounded border border-sand-200
                focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20
                resize-none
              `}
            />
            <p className={`${typography.caption} text-ink-900/50 mt-2`}>
              Include your options, key factors, and what you're trying to achieve
            </p>
          </div>

          {error && (() => {
            const formatted = formatCEEError(error)
            return (
              <ErrorAlert
                title="Draft failed"
                message={formatted.message}
                severity="error"
                debugInfo={formatted.debugInfo}
                action={{
                  label: 'Try again',
                  onClick: handleDraft
                }}
              />
            )
          })()}

          <div className="flex gap-2">
            <button
              onClick={handleDraft}
              disabled={loading || !description.trim()}
              className={`
                ${typography.button} flex-1 py-2.5 rounded
                bg-sky-500 text-white hover:bg-sky-600
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors
              `}
            >
              {loading ? 'Drafting...' : 'Draft Model'}
            </button>

            <button
              onClick={() => setShowDraftChat(false)}
              className={`
                ${typography.button} px-6 py-2.5 rounded
                border border-sand-200 hover:bg-paper-50
              `}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        /* Preview */
        <DraftPreview
          draft={draft}
          onAccept={handleAccept}
          onReject={handleReject}
        />
      )}
    </div>
  )
}
