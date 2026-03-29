import { useState } from 'react'
import { ChevronDown, ChevronRight, CheckCircle, AlertTriangle } from 'lucide-react'
import { typography } from '../../styles/typography'
import { GraphLink } from '../../components/results/GraphLink'
import { highlightNode, clearHighlight } from '../utils/highlightHelpers'
import { useCanvasStore } from '../store'
import type { Transition } from './types'

interface TransitionCardProps {
  transition: Transition
  startOpen: boolean
  showExpert: boolean
  allDeltas: number[]
  registerRef?: (key: string, el: HTMLDivElement | null) => void
}

function DeltaBar({ value, maxAbs }: { value: number; maxAbs: number }) {
  const pos = value >= 0
  const w = Math.min((Math.abs(value) / Math.max(maxAbs, 20)) * 100, 100)

  return (
    <div className="inline-flex items-center gap-1">
      <div className="w-11 h-[5px] rounded-sm bg-panel-border/50 overflow-hidden relative">
        <div
          className={`absolute top-0 h-full rounded-sm ${pos ? 'left-0 bg-success' : 'right-0 bg-danger'}`}
          style={{ width: `${w}%` }}
        />
      </div>
    </div>
  )
}

const MAGNITUDE_LABELS: Record<string, string> = {
  major: 'Major shift',
  refinement: 'Refinement',
  minor: 'Minor adjustment',
}

export function TransitionCard({
  transition: tr,
  startOpen,
  showExpert,
  allDeltas,
  registerRef,
}: TransitionCardProps) {
  const [open, setOpen] = useState(startOpen)
  const cardKey = `${tr.fromRunNumber}-${tr.toRunNumber}`
  const maxAbs = Math.max(20, ...allDeltas.map(d => Math.abs(d)))

  // Hover handler for edit area
  const handleEditsHover = () => {
    if (tr.affectedFactorIds.length > 0) {
      useCanvasStore.getState().setHighlightedNodes(tr.affectedFactorIds)
    }
  }

  return (
    <div
      ref={el => registerRef?.(cardKey, el)}
      className="border border-panel-border rounded-lg mb-1.5 overflow-hidden"
      data-testid={`transition-card-${tr.fromRunNumber}-${tr.toRunNumber}`}
    >
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 px-2.5 py-2 bg-transparent border-none cursor-pointer text-left"
      >
        {open
          ? <ChevronDown size={11} className="text-text-light" />
          : <ChevronRight size={11} className="text-text-light" />
        }
        <span className={typography.panelBody}>
          <strong>{tr.isCumulative ? 'Cumulative: ' : ''}Run {tr.fromRunNumber} → {tr.toRunNumber}</strong>
        </span>
        {!open && (
          <span className={`${typography.panelMeta} ml-1`}>
            {tr.winnerProbDelta >= 0 ? '+' : ''}{tr.winnerProbDelta}pp
          </span>
        )}
        <span className={`${typography.panelMeta} ml-auto inline-flex items-center px-2 py-px rounded-full border border-panel-border bg-transparent text-text-body whitespace-nowrap`}>
          {MAGNITUDE_LABELS[tr.magnitude] ?? tr.magnitude}
        </span>
      </button>

      {open && (
        <div className="px-2.5 pb-2.5">
          {/* Edits */}
          <div
            onMouseEnter={handleEditsHover}
            onMouseLeave={clearHighlight}
          >
            {tr.edits.map((e, i) => (
              <div key={i} className={typography.panelBody}>• {e}</div>
            ))}
          </div>

          <div className="h-2" />

          {/* Impact */}
          <div className="flex items-center gap-1.5">
            <span className={typography.panelBody}>
              {tr.winnerProbDelta >= 0 ? '+' : ''}{tr.winnerProbDelta}pp
            </span>
            <DeltaBar value={tr.winnerProbDelta} maxAbs={maxAbs} />
          </div>
          {tr.robustnessChanged && (
            <div className={`${typography.panelBody} mt-0.5`}>
              Recommendation stability: {tr.robustnessFrom} → {tr.robustnessTo}
            </div>
          )}
          {tr.goalProbDelta != null && tr.goalProbDelta !== 0 && (
            <div className={`${typography.panelBody} mt-0.5`}>
              Goal probability: {tr.goalProbDelta >= 0 ? '+' : ''}{tr.goalProbDelta}pp
            </div>
          )}

          {/* Warnings resolved */}
          {tr.warningsResolved.length > 0 && (
            <>
              <div className="h-2" />
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg border border-panel-border">
                <CheckCircle size={11} className="text-text-light" />
                <span className={typography.panelBody}>
                  {tr.warningsResolved.length} inference warning{tr.warningsResolved.length > 1 ? 's' : ''} resolved
                </span>
              </div>
            </>
          )}

          {/* Structure caveat */}
          {tr.structureChanged && (
            <>
              <div className="h-2" />
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg border border-panel-border">
                <AlertTriangle size={11} className="text-text-light" />
                <span className={typography.panelBody}>
                  Structure changed — comparison is directional only
                </span>
              </div>
            </>
          )}

          {/* Cumulative caveats */}
          {tr.isCumulative && tr.cumulativeCaveats.length > 0 && (
            <>
              <div className="h-2" />
              {tr.cumulativeCaveats.map((caveat, i) => (
                <div key={i} className={`${typography.panelMeta} mt-0.5`}>
                  • {caveat}
                </div>
              ))}
            </>
          )}

          <div className="h-2" />

          {/* Affected factors */}
          {tr.affectedFactorIds.length > 0 && (
            <div className={typography.panelBody}>
              Affected:{' '}
              {tr.affectedFactorIds.map((id, i) => (
                <span key={id}>
                  <span
                    onMouseEnter={() => highlightNode(id)}
                    onMouseLeave={clearHighlight}
                  >
                    <GraphLink nodeId={id} label={tr.affectedFactorLabels[i]} />
                  </span>
                  {i < tr.affectedFactorIds.length - 1 ? ', ' : ''}
                </span>
              ))}
            </div>
          )}

          {/* Deterministic anchor */}
          {tr.deterministicAnchor && (
            <div className={`${typography.panelMeta} mt-0.5`}>
              {tr.deterministicAnchor}
            </div>
          )}

          <div className="h-2" />

          {/* AI reason (when available — null until prompt update) */}
          {tr.reason && (
            <div className={typography.panelBody}>{tr.reason}</div>
          )}

          {/* E-value insight (standard mode: <2.0 only; expert: always) */}
          {tr.eValue != null && (showExpert || tr.eValue < 2.0) && (
            <div className={`${typography.panelBody} mt-1`}>
              The {tr.eValueEdge} assumption would only need to be {tr.eValue}x wrong to change the recommendation.
            </div>
          )}

          {/* Conditional winner */}
          {tr.conditionalWinner && (
            <div className={`${typography.panelBody} mt-1`}>
              {tr.conditionalWinner}
            </div>
          )}

          {/* AI context (when available — null until prompt update) */}
          {tr.aiContext && (
            <div className={`${typography.panelBody} mt-1 italic`}>
              {tr.aiContext}
            </div>
          )}

          {/* Expert: full deterministic facts */}
          {showExpert && (
            <div className={`${typography.panelMeta} mt-1.5`}>
              {tr.eValue != null && `E-value: ${tr.eValue} (${tr.eValueEdge})`}
              {tr.conditionalWinner ? ' · Conditional flip: yes' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
