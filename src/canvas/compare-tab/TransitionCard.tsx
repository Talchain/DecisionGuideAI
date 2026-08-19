import { useState } from 'react'
import { ChevronDown, ChevronRight, CheckCircle, AlertTriangle } from 'lucide-react'
import { typography } from '../../styles/typography'
import { GraphLink } from '../../components/results/GraphLink'
import { highlightNode, clearHighlight } from '../utils/highlightHelpers'
import { useCanvasStore } from '../store'
import { fieldDisplayLabel, formatChangeValue } from './graphChangeDiff'
import type { Transition } from './types'

interface TransitionCardProps {
  transition: Transition
  startOpen: boolean
  showExpert: boolean
  /** Only the MEASURED deltas — nulls are excluded by TransitionsSection. */
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

/**
 * The estate's standing absence token — the same string RunPairCompare,
 * TrajectorySection's expert table and the Compare hero use.
 */
const NOT_ASSESSED = 'Not assessed'

/**
 * The leader's movement, or an honest statement that it is not measurable
 * (ROADMAP 2.835).
 *
 * `winnerProbDelta` became `number | null` when the tab stopped subtracting
 * client-side argmaxes: a delta needs the SAME option scored at BOTH ends.
 * Rendering a null through the old template produced `+nullpp` beside a
 * zero-width `DeltaBar` — a template literal coerces null to the string
 * "null" and TypeScript cannot catch it inside one.
 */
function deltaText(delta: number | null): string {
  return delta != null ? `${delta >= 0 ? '+' : ''}${delta}pp` : NOT_ASSESSED
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
  const hasDetail =
    tr.changeVerdict.fieldChanges.length > 0 || tr.changeVerdict.membershipChanges.length > 0

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
            {deltaText(tr.winnerProbDelta)}
          </span>
        )}
        <span className={`${typography.panelMeta} ml-auto inline-flex items-center px-2 py-px rounded-full border border-panel-border bg-transparent text-text-body whitespace-nowrap`}>
          {/* ROADMAP 2.835: magnitude is a band over the delta, so it is null
              exactly when the delta is. `MAGNITUDE_LABELS[null]` would render
              nothing, leaving an empty pill that reads as a badge the code
              forgot to fill rather than as a fact nobody measured. */}
          {tr.magnitude != null ? (MAGNITUDE_LABELS[tr.magnitude] ?? tr.magnitude) : NOT_ASSESSED}
        </span>
      </button>

      {open && (
        <div className="px-2.5 pb-2.5">
          {/* Edits */}
          <div
            onMouseEnter={handleEditsHover}
            onMouseLeave={clearHighlight}
          >
            {/*
              ROADMAP 2.578 — ONE description of the change, never two.
              When the canonical diff has detail, IT is the description: the
              exact element, the exact field, before → after, by IDENTITY. That
              is what makes Compare an audit trail — "why did the recommendation
              change?" answered with "strength 0.5 → 0.8 on this relationship"
              rather than a magnitude adjective.
              `tr.edits` carries the same facts as prose and is the fallback for
              the cases with no detail to show (a provably identical rerun, or a
              run whose graph was never recorded). Rendering both would print
              every change twice.
            */}
            {hasDetail ? (
              <>
                {tr.changeVerdict.membershipChanges.map((c) => (
                  <div
                    key={`m-${c.element}-${c.id}`}
                    className={typography.panelBody}
                    data-testid={`change-${c.element}-${c.id}-${c.op}`}
                  >
                    • {c.op === 'added' ? 'Added' : 'Removed'} {c.element} “{c.label}”
                  </div>
                ))}
                {tr.changeVerdict.fieldChanges.map((c) => (
                  <div
                    key={`f-${c.element}-${c.id}-${c.field}`}
                    className={typography.panelBody}
                    data-testid={`change-${c.element}-${c.id}-${c.field}`}
                  >
                    • {c.label} · {fieldDisplayLabel(c.field)} {formatChangeValue(c.before)} → {formatChangeValue(c.after)}
                  </div>
                ))}
              </>
            ) : (
              tr.edits.map((e, i) => (
                <div key={i} className={typography.panelBody}>• {e}</div>
              ))
            )}
          </div>

          <div className="h-2" />

          {/* Impact */}
          <div className="flex items-center gap-1.5">
            <span className={typography.panelBody}>
              {deltaText(tr.winnerProbDelta)}
            </span>
            {/* No bar for an unmeasurable movement. A zero-width bar is still a
                BAR — it reads as "measured, and it did not move", which is the
                claim we do not have. */}
            {tr.winnerProbDelta != null && (
              <DeltaBar value={tr.winnerProbDelta} maxAbs={maxAbs} />
            )}
          </div>
          {tr.robustnessChanged && (
            <div className={`${typography.panelBody} mt-0.5`}>
              Result stability: {tr.robustnessFrom} → {tr.robustnessTo}
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
              The {tr.eValueEdge} assumption would only need to be {tr.eValue}x wrong to change the result.
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
