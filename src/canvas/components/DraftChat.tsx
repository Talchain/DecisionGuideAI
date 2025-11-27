import { useState } from 'react'
import { useCEEDraft } from '../../hooks/useCEEDraft'
import { DraftPreview } from './DraftPreview'
import { ErrorAlert } from '../../components/ErrorAlert'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { CEEError } from '../../adapters/cee/client'

/** Check if error indicates CEE service is unavailable */
function isCEEUnavailable(error: CEEError | Error): boolean {
  if (error instanceof CEEError) {
    // HTTP 404 (not found) or 503 (service unavailable)
    return error.status === 404 || error.status === 503
  }
  // Network-level failures (no HTTP status) - treat as service unavailable
  // These typically indicate the service is not reachable at all
  const message = error.message?.toLowerCase() ?? ''
  if (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('connection refused') ||
    message.includes('dns') ||
    message.includes('econnrefused')
  ) {
    return true
  }
  return false
}

/** Format CEE error for user-friendly display + debug info */
function formatCEEError(error: CEEError | Error): { message: string; debugInfo?: string; isUnavailable?: boolean } {
  if (error instanceof CEEError) {
    // Check if service is unavailable (404/503)
    if (isCEEUnavailable(error)) {
      return {
        message: 'AI drafting is temporarily unavailable.',
        isUnavailable: true,
      }
    }

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

  // Check if non-CEEError is a network failure (treat as unavailable)
  if (isCEEUnavailable(error)) {
    return {
      message: 'AI drafting is temporarily unavailable.',
      isUnavailable: true,
    }
  }

  return { message: error.message }
}

export function DraftChat() {
  const [description, setDescription] = useState('')
  const { data: draft, loading, error, draft: generateDraft } = useCEEDraft()
  // React #185 FIX: Use individual selectors instead of destructuring from useCanvasStore()
  const showDraftChat = useCanvasStore(s => s.showDraftChat)
  const setShowDraftChat = useCanvasStore(s => s.setShowDraftChat)
  const addNodes = useCanvasStore(s => s.addNodes)
  const addEdges = useCanvasStore(s => s.addEdges)

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

            // Show helpful alternatives when CEE is unavailable
            if (formatted.isUnavailable) {
              return (
                <div className="p-3 bg-sun-50 border border-sun-200 rounded-lg space-y-2" data-testid="cee-unavailable-banner">
                  <p className={`${typography.body} text-sun-800 font-medium`}>
                    {formatted.message}
                  </p>
                  <p className={`${typography.bodySmall} text-sun-700`}>
                    Build your model manually using:
                  </p>
                  <ul className={`${typography.bodySmall} text-sun-700 list-disc list-inside space-y-0.5`}>
                    <li><strong>+ Node</strong> button to add factors</li>
                    <li><strong>Templates</strong> drawer for pre-built models</li>
                    <li>Right-click canvas for quick-add menu</li>
                  </ul>
                </div>
              )
            }

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
