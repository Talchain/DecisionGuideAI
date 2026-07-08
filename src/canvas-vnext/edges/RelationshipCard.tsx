// Relationship Card — the edge's meaning, rendered as a small anchored card.
//
// Two modes:
//   hover  → role="tooltip", read-only summary, no actions
//   pinned → role="dialog" (aria-modal=false), focus moves in, Escape closes
//            and returns focus, click-outside closes, actions row renders
//
// Rendered inside EdgeLabelRenderer by VNextEdge (positioning owned there).
// Content comes exclusively from the RelationshipCardVM (UI-SEM-074): the
// why-it-matters block only exists for real signals, and result-derived
// lines dim + carry the "From a previous run" marker when stale (UI-SEM-076).

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { prefillChatText } from '../vm/useGraphExperienceVM'
import { useViewLevelStore } from '../state/viewLevelStore'
import { STALE_CLAIM_MARKER, WHY_FRAGILE } from '../vm/strings'
import type { RelationshipCardVM, RelationshipAction } from '../vm/types'

export interface RelationshipCardProps {
  card: RelationshipCardVM
  mode: 'hover' | 'pinned'
  onClose: () => void
  /** Centre the viewport on this edge (wired by VNextEdge). */
  onFocusEdge: () => void
}

function formatSigned(value: number): string {
  const rounded = Math.round(value * 100) / 100
  return rounded > 0 ? `+${rounded}` : `${rounded}`
}

export function RelationshipCard({ card, mode, onClose, onFocusEdge }: RelationshipCardProps) {
  const level = useViewLevelStore((s) => s.level)
  const [showEvidence, setShowEvidence] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  // Pinned mode: move focus in, Escape closes + returns focus, click-outside
  // closes.
  useEffect(() => {
    if (mode !== 'pinned') return
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    cardRef.current?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    const onPointerDown = (e: MouseEvent) => {
      if (cardRef.current && e.target instanceof Node && !cardRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
      restoreFocusRef.current?.focus()
    }
  }, [mode, onClose])

  const detailWords: string[] = []
  if (card.strengthLabel != null) {
    detailWords.push(
      level === 'detailed' && card.strengthValue != null
        ? `${card.strengthLabel} (${formatSigned(card.strengthValue)})`
        : card.strengthLabel,
    )
  }
  if (card.confidenceLabel != null) {
    detailWords.push(
      level === 'detailed' && card.confidenceValue != null
        ? `${card.confidenceLabel} confidence (${Math.round(card.confidenceValue * 100)}%)`
        : `${card.confidenceLabel} confidence`,
    )
  }

  const dimWhy = card.whyIsResultDerived && card.isStaleResult
  const whyIsFragile = card.whyItMatters === WHY_FRAGILE

  const handleAction = (action: RelationshipAction) => {
    if (action.availability !== 'wired') return
    switch (action.kind) {
      case 'focus':
        onFocusEdge()
        break
      case 'evidence':
        setShowEvidence((v) => !v)
        break
      case 'challenge':
        if (card.challengePrompt != null && prefillChatText(card.challengePrompt)) {
          onClose()
        }
        break
      default:
        break
    }
  }

  return (
    <div
      ref={cardRef}
      role={mode === 'pinned' ? 'dialog' : 'tooltip'}
      aria-modal={mode === 'pinned' ? false : undefined}
      aria-label={card.sentence}
      tabIndex={mode === 'pinned' ? -1 : undefined}
      data-testid={`vnext-relationship-card-${card.edgeId}`}
      className="w-60 rounded-lg border border-panel-border bg-panel p-3 shadow-lg outline-none"
      style={{ pointerEvents: 'all' }}
    >
      <p className="text-sm font-medium text-text-body">{card.sentence}</p>

      {detailWords.length > 0 && (
        <p data-testid="vnext-relationship-words" className="mt-1 text-xs text-text-light">
          {detailWords.join(' · ')}
        </p>
      )}

      {card.whyItMatters != null && (
        <div className="mt-2">
          <div
            data-testid="vnext-relationship-why"
            className={`border-l-[3px] ${whyIsFragile ? 'border-warning' : 'border-info'} bg-panel pl-2 ${dimWhy ? 'opacity-60' : ''}`}
          >
            <p className="flex items-start gap-1 text-xs text-text-body">
              {whyIsFragile && <AlertTriangle size={12} className="mt-0.5 shrink-0 text-warning" aria-hidden />}
              <span>
                {card.whyItMatters}
                {level === 'detailed' && card.whyDetailPct != null && (
                  <> Changes the leader in {card.whyDetailPct}% of stress tests.</>
                )}
              </span>
            </p>
          </div>
          {dimWhy && (
            <p data-testid="vnext-relationship-stale-marker" className="mt-1 text-xs italic text-text-light">
              {STALE_CLAIM_MARKER}
            </p>
          )}
        </div>
      )}

      {showEvidence && card.evidence.length > 0 && (
        <ul data-testid="vnext-relationship-evidence" className="mt-2 space-y-1">
          {card.evidence.map((item, i) => (
            <li key={i} className="text-xs text-text-body">
              {item.statement}
              {item.source && <span className="block text-text-light">— {item.source}</span>}
            </li>
          ))}
        </ul>
      )}

      {mode === 'pinned' && (
        <div data-testid="vnext-relationship-actions" className="mt-3 flex flex-wrap gap-1.5">
          {card.actions.map((action) => (
            <button
              key={action.kind}
              type="button"
              disabled={action.availability === 'disabled'}
              title={action.availability === 'disabled' ? action.disabledHint : undefined}
              onClick={() => handleAction(action)}
              className={`rounded-full border px-2 py-0.5 text-xs ${
                action.availability === 'wired'
                  ? 'border-info/30 bg-transparent text-text-body hover:bg-panel-hover'
                  : 'cursor-not-allowed border-panel-border bg-transparent text-text-light'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
