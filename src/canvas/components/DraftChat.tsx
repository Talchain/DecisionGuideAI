import { useState, useEffect } from 'react'
import { useCEEDraft } from '../../hooks/useCEEDraft'
import { DraftPreview } from './DraftPreview'
import { ErrorAlert } from '../../components/ErrorAlert'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { CEEClient } from '../../adapters/cee/client'
import type { CEEFramingFeedback } from '../../adapters/cee/types'

export function DraftChat() {
  const [description, setDescription] = useState('')
  const [feedback, setFeedback] = useState<CEEFramingFeedback | null>(null)
  const { data: draft, loading, error, draft: generateDraft } = useCEEDraft()
  const { showDraftChat, setShowDraftChat, addNodes, addEdges } = useCanvasStore()

  const client = new CEEClient()

  // Phase 2: Real-time framing feedback (debounced)
  useEffect(() => {
    if (description.length < 20) {
      setFeedback(null)
      return
    }

    const timer = setTimeout(() => {
      client.framingFeedback(description)
        .then(setFeedback)
        .catch(() => setFeedback(null))
    }, 500)

    return () => clearTimeout(timer)
  }, [description])

  const handleDraft = async () => {
    if (!description.trim()) return

    try {
      await generateDraft(description)
    } catch (err) {
      console.error('Draft failed:', err)
    }
  }

  const handleAccept = () => {
    if (!draft) return

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

    const edges = draft.edges.map((e, i) => ({
      id: `e-${i}`,
      source: e.from,
      target: e.to,
      type: 'default',
    }))

    addNodes(nodes)
    addEdges(edges)
    setShowDraftChat(false)

    // Trigger ISL validation after 500ms
    setTimeout(() => {
      // ISL validation will auto-trigger via useEffect in DiagnosticsTab
    }, 500)
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

          {/* Phase 2: Real-time framing feedback */}
          {feedback && (
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded ${
                feedback.status === 'good'
                  ? 'bg-mint-50 border border-mint-200'
                  : feedback.status === 'needs_improvement'
                  ? 'bg-sun-50 border border-sun-200'
                  : 'bg-carrot-50 border border-carrot-200'
              }`}
            >
              <span className={`${typography.bodySmall}`}>
                {feedback.message}
              </span>
            </div>
          )}

          {error && (
            <ErrorAlert
              message={error.message}
              severity="error"
              action={{
                label: 'Try again',
                onClick: handleDraft
              }}
            />
          )}

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
