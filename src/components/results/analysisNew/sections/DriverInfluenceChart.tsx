/**
 * ⭐⭐ THE INFLUENCE CHART — the tornado's idea, without the tornado's claim.
 *
 * WHAT THE OLD CHART DOES AND WHY THIS IS NOT A PORT OF IT
 * `TornadoChart.tsx` draws, per factor, an outcome LOW and an outcome HIGH.
 * Those come from `OutputsDock.tsx:1039`:
 *
 *     lowOutcome  = expected - influence * (expected - p10)
 *     highOutcome = expected + influence * (p90 - expected)
 *
 * `expected`, `p10` and `p90` are the RECOMMENDED OPTION's, read once outside
 * the loop — so both ranges are the SAME CONSTANT for every row, and each bar
 * is the influence score wearing outcome units. The component's own header
 * agrees: "a proportional presentation-layer approximation, not authoritative
 * per-factor outcome bounds from PLoT". Producer-checked at the bytes:
 * `factor_sensitivity[]` carries `{factor_id, elasticity, direction}` —
 * elasticity, not bounds — and `factorLow`/`factorHigh` appear in ZERO files
 * (contrast control: `flip_value`, 47). The bounds do not exist to draw.
 *
 * So this chart draws the quantity we ACTUALLY have — a within-run influence
 * rank — under its own name, and spends the second axis on the thing the old
 * chart has and never renders: DIRECTION.
 *
 * ⚠ AND IT FIXES A DEFECT THE OLD CHART STILL SHIPS. `TornadoRow.direction` is
 * populated and the renderer branches only on GOAL direction, so a
 * negative-direction factor (cost, churn) draws on the wrong side today. Here
 * the side comes from the factor's own direction, narrowed by
 * `isDirectionalFactor` in the builder — `mixed`/`unknown`/absent get a CENTRED
 * bar, never a guessed side.
 *
 * ⭐ WHY IT IS A TOOL AND NOT A PICTURE. The old chart's two affordances are
 * structurally dormant (`PLOT_BOUNDS_WIRED = false`): drag previews an
 * outcome-space value that cannot be written back to factor space, so "Apply
 * and rerun" can never fire. That was never buildable. What IS buildable, and
 * is new since that component was written, is a real factor-space write
 * authority — so a row here opens the SAME editor the model strip uses, on the
 * SAME `useFactorValueCommit` hook, and dispatches a real edit. Ranked by what
 * moves the answer most, editable in place: a worklist, not a diagram.
 */
import { useState } from 'react'
import { ArrowLeft, ArrowRight, Minus } from 'lucide-react'
import { typography } from '../../../../styles/typography'
import { useFactorValueCommit } from '../useFactorValueCommit'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import type { DriverInfluenceRow } from '../analysisNewTypes'

export interface DriverInfluenceChartProps {
  rows: DriverInfluenceRow[]
  /** Focus the factor on the canvas. */
  onFocusTarget?: (targetId: string) => void
  /** Report the outcome of a commit. The caller owns the toast vocabulary. */
  onCommitOutcome: (outcome: 'dispatched' | 'local_only' | 'not_encodable') => void
  testId: string
}

/**
 * ⚠ THE BAR OCCUPIES ONE HALF, NEVER THE WHOLE TRACK. Both halves are always
 * drawn, so the centre line sits in the same place on every row and the eye
 * reads the sides as a comparison. A bar that grew across the full width would
 * make a strong "lowers" row look like a strong "raises" row.
 */
const HALF = 'w-1/2 flex items-center'

export function DriverInfluenceChart({
  rows,
  onFocusTarget,
  onCommitOutcome,
  testId,
}: DriverInfluenceChartProps) {
  /**
   * ⚠ THE ROW ID, NOT A BOOLEAN — the model strip's rule, for the same reason.
   * A boolean leaves the editor open over whichever row happens to be under it
   * when the list re-orders, which it does on every re-run.
   */
  const [editingFor, setEditingFor] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const { commit } = useFactorValueCommit(editingFor)

  if (rows.length === 0) return null

  const submit = () => {
    const outcome = commit(draft)
    onCommitOutcome(outcome)
    // ⚠ STAYS OPEN ON `not_encodable` — nothing was written anywhere, so
    // closing would read as a success.
    if (outcome !== 'not_encodable') {
      setEditingFor(null)
      setDraft('')
    }
  }

  return (
    <div data-testid={testId} className="mb-3">
      {/* The axis legend. It names both sides ONCE, so no row has to repeat a
          direction word — the side IS the word. */}
      <div
        className={`${typography.panelMeta} text-text-light flex items-center justify-between mb-1.5 px-0.5`}
        data-testid={`${testId}-axis`}
      >
        <span className="flex items-center gap-1">
          <ArrowLeft className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          {COPY.driverChart.lowers}
        </span>
        <span className="flex items-center gap-1">
          {COPY.driverChart.raises}
          <ArrowRight className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
        </span>
      </div>

      <ul className="space-y-1">
        {rows.map((row) => {
          const isEditing = editingFor === row.id
          const pct = Math.round(row.fraction * 100)
          const width = `${pct}%`
          return (
            <li key={row.id} data-testid={`${testId}-row`} data-node-id={row.id}>
              <button
                type="button"
                onClick={() => {
                  if (isEditing) {
                    setEditingFor(null)
                    return
                  }
                  setEditingFor(row.id)
                  setDraft('')
                  if (row.targetId) onFocusTarget?.(row.targetId)
                }}
                aria-expanded={isEditing}
                className="w-full text-left rounded px-1 py-0.5 hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
                data-testid={`${testId}-bar`}
                data-direction={row.direction ?? 'none'}
                data-fraction={pct}
              >
                <span
                  className={`${typography.panelBody} text-text-body block truncate`}
                  title={row.label}
                >
                  {row.label}
                </span>
                {/* ⚠ `aria-hidden`: the bar is a redraw of `data-fraction` and
                    of the row's position in a sorted list. Announcing a
                    decorative div would add noise, not information — the
                    ordering already carries the ranking for a screen reader,
                    and the direction is spoken by the text below. */}
                <span className="flex items-stretch h-2 mt-0.5" aria-hidden="true">
                  <span className={`${HALF} justify-end`}>
                    {row.direction === 'negative' ? (
                      <span
                        className="h-full rounded-l-sm bg-warning"
                        style={{ width }}
                        data-testid={`${testId}-bar-lowers`}
                      />
                    ) : null}
                  </span>
                  <span className="w-px bg-panel-border flex-shrink-0" />
                  <span className={HALF}>
                    {row.direction === 'positive' ? (
                      <span
                        className="h-full rounded-r-sm bg-success"
                        style={{ width }}
                        data-testid={`${testId}-bar-raises`}
                      />
                    ) : null}
                  </span>
                </span>
                {/* ⚠⚠ THE NON-DIRECTIONAL STATE IS SAID, NOT LEFT BLANK. An
                    empty row where two neighbours have bars reads as "no
                    influence", which is the opposite of the truth: the producer
                    MEASURED this factor and declined to assert a direction. A
                    centred mark plus the sentence keeps the magnitude visible
                    and refuses the side. */}
                {row.direction === null ? (
                  <span
                    className={`${typography.panelMeta} text-text-light flex items-center gap-1 mt-0.5`}
                    data-testid={`${testId}-no-direction`}
                  >
                    <Minus className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                    {COPY.driverChart.directionNotEstablished}
                  </span>
                ) : null}
              </button>

              {isEditing ? (
                <div className="pl-1 pt-1 flex items-center gap-1.5" data-testid={`${testId}-editor`}>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        submit()
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault()
                        setEditingFor(null)
                      }
                    }}
                    aria-label={COPY.modelStrip.valueInputLabel(row.label)}
                    className={`${typography.panelBody} min-w-0 flex-1 rounded border border-panel-border bg-surface px-1.5 py-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                    data-testid={`${testId}-input`}
                  />
                  <button
                    type="button"
                    onClick={submit}
                    className={`${typography.panelMeta} rounded px-2 py-0.5 bg-primary text-text-on-color focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                    data-testid={`${testId}-save`}
                  >
                    {COPY.modelStrip.saveValue}
                  </button>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
