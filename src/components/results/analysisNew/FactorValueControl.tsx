/**
 * ⭐⭐ ONE CONTROL FOR "STATE THIS FACTOR'S VALUE" — #1491'S, EXTRACTED, NOT A
 * SECOND ONE.
 *
 * #1491 built this inline in `WhatIWasGivenSection.EstimatedFactorRow` for the
 * "What I estimated" list. The Reasoning tab's "Model gaps the analysis worked
 * around" rows need the SAME act: three of them end with the literal sentence
 * "Add its current value." and offered nothing to press.
 *
 * Copying that JSX would have minted the twin this estate is named for — two
 * spellings of one act, drifting the day either is adjusted (trap 12, and the
 * two `generateGraphHash` functions that cost a whole diagnosis). So it moved
 * here whole and both surfaces import it. Every behaviour below is #1491's,
 * unchanged; the only new thing is `testIdPrefix`, which lets each surface keep
 * its own handles.
 *
 * ⚠ WHAT THIS COMPONENT DOES *NOT* OWN, DELIBERATELY:
 *   · the WRITER — `useModelEditAuthority.proposeFactorValue`;
 *   · the PARSE RULE and the three-outcome contract — `useFactorValueCommit`;
 *   · the SCALE contract, the optimistic local write and the undo — the
 *     authority, via `buildFactorValueEditEvent`;
 *   · the WORDS — `ANALYSIS_NEW_COPY.modelStrip`, imported, never re-typed.
 * It supplies a number and an identity and decides nothing else.
 *
 * ⚠ `CANONICAL_EDIT_AUTHORITY.modelFactorValue` is `'server_graph'`, which is a
 * PRESENTATION authority — it says this control may present itself as an edit
 * to the saved shared model. It is not a writer gate and is not read here, per
 * its own header's explicit warning.
 */
import { useId, useState } from 'react'
import { Pencil } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { useCanvasStore } from '../../../canvas/store'
import { useOptionalConversationContext } from '../../../canvas/conversation/ConversationContext'
import { useShowToastSafe } from '../../../canvas/ToastContext'
import { useFactorValueCommit } from './useFactorValueCommit'
import { ANALYSIS_NEW_COPY } from './analysisNewCopy'

/**
 * ⚠⚠ THE PILL LOST ITS TINT, AND THAT IS A REPAIR THIS MOVE *REVEALED* RATHER
 * THAN CAUSED.
 *
 * As authored in #1491 both buttons were `bg-info/10 … text-info
 * hover:bg-info/20`. `reasoning-model-text-contrast-per-site.spec.ts` scans
 * `analysisNew/`, `model-tab-v2/` and `model-tab/` — and NOT
 * `contextIntegrity/`, where the control was written. So it was never measured,
 * and it ships today at **3.56:1** against SC 1.4.3's 4.5:1 on the "What I
 * estimated" list. Moving the file one directory brought it into scope and the
 * guard caught it on the first run.
 *
 * That is the guard's own stated failure mode, playing out again: a surface
 * that renders into the Reasoning tab escaped a Reasoning-tab guard by living
 * next door. The finding is the directory scope, not this control.
 *
 * A same-hue tint moves the GROUND TOWARDS the text, so the ratio falls
 * monotonically with alpha — `text-info` is 4.78:1 on a bare panel ground,
 * 4.05:1 inside `bg-info/10` and 3.56:1 inside `bg-info/20`. There is no
 * darker info token to reach for, so the tint had to go; a border carries the
 * affordance instead and leaves the ground alone. Both panel grounds clear
 * 4.5:1 for `text-info`, which is why this passes rather than being pinned.
 *
 * ⭐ IT IS FIXED HERE, ONCE, SO BOTH SURFACES GET IT. Repairing only the new
 * caller would have left the older one failing under a guard that still cannot
 * see it.
 */

export interface FactorValueControlProps {
  /**
   * The factor whose value this control writes.
   *
   * ⚠ IT IS RESOLVED AGAINST THE LIVE CANVAS BEFORE ANYTHING IS OFFERED, and
   * the reason is worth stating because it is NOT that the id is unreliable.
   * `proposeFactorValue` resolves with an EXACT `nodes.find(n => n.id === id)`
   * and answers `not_encodable` on a miss — there is no fuzzy match and no
   * fallback, so a divergent id CANNOT address a different factor. The failure
   * mode is "nothing happens", never "the wrong number was overwritten".
   *
   * What a divergent id WOULD leave behind is a button that does nothing, and
   * that is what the positive resolution below prevents.
   */
  nodeId: string
  /**
   * The factor's name, for the input's accessible label.
   *
   * ⚠ OPTIONAL, AND THE FALLBACK IS THE SANCTIONED ROUTE, NOT A GUESS. A caller
   * that already holds the name passes it. A caller that holds only a SENTENCE
   * about the factor must not pass that — "New value for Carrier Cut-off
   * Compliance has no current value recorded, so zero was assumed…" is what a
   * screen reader would then announce — so it passes nothing and the name is
   * resolved `nodeId` → graph store, which is the estate's one permitted label
   * route (never parsed out of prose).
   *
   * With no name from either source the control is NOT offered: an editor that
   * cannot say which factor it edits is worse than no editor.
   */
  label?: string
  /** Handles are `${testIdPrefix}-value-edit|-value-input|-value-save|-value-cancel`. */
  testIdPrefix: string
  /**
   * The calling surface's own opt-in. Default `true` because a caller that
   * renders this component at all has already decided to offer the act; the
   * parameter exists for surfaces that render the ROW unconditionally and gate
   * only the control.
   */
  enabled?: boolean
}

export function FactorValueControl({
  nodeId,
  label,
  testIdPrefix,
  enabled = true,
}: FactorValueControlProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputId = useId()
  const showToast = useShowToastSafe()

  // A POSITIVE match, per the note on `nodeId`. Selecting the boolean rather
  // than the array keeps this control out of every unrelated node update.
  const isInGraph = useCanvasStore((s) =>
    Array.isArray(s.nodes) ? s.nodes.some((n) => n.id === nodeId) : false,
  )
  /**
   * ⚠ A SEPARATE PRIMITIVE SELECTOR, NOT ONE SELECTOR RETURNING THE NODE. A
   * selector that returns an object allocates a new reference every store
   * update and re-renders this control on every unrelated node change; two
   * primitives compare by value and do not.
   */
  const storeLabel = useCanvasStore((s) => {
    const node = Array.isArray(s.nodes) ? s.nodes.find((n) => n.id === nodeId) : undefined
    const value = (node?.data as { label?: unknown } | undefined)?.label
    return typeof value === 'string' && value.trim().length > 0 ? value : undefined
  })
  const name = label ?? storeLabel

  /**
   * ⚠ NO CARRIER, NO CONTROL — and NOT a disabled one. A disabled button still
   * advertises the action, which is the defect this control exists to close,
   * inverted. Without a conversation the commit could only write locally, and a
   * local-only change to a number the surface has just called a placeholder is
   * precisely the claim these surfaces exist not to make.
   */
  const canReachOlumi = useOptionalConversationContext()?.sendSystemEvent !== undefined
  const offer = enabled && isInGraph && canReachOlumi && name !== undefined

  /**
   * ⚠ CALLED UNCONDITIONALLY AND PARAMETERISED BY THE ID — the hook's own
   * documented contract ("pass `null` when no edit is active"). Passing `null`
   * when we are not offering means a proposal could only ever answer
   * `not_encodable`, which is the honest answer.
   */
  const { commit } = useFactorValueCommit(offer ? nodeId : null)

  /**
   * ⚠ THE OUTCOME IS NEVER FLATTENED TO "SAVED". `proposeFactorValue` answers
   * `dispatched | local_only | not_encodable` precisely so a caller cannot claim
   * a server acceptance it did not observe; the three sentences are three
   * different truths. On `not_encodable` the editor STAYS OPEN — nothing was
   * written anywhere, so closing it would look like a success.
   */
  const commitValue = () => {
    const outcome = commit(draft)
    showToast(
      outcome === 'dispatched'
        ? ANALYSIS_NEW_COPY.modelStrip.valueDispatched
        : outcome === 'local_only'
          ? ANALYSIS_NEW_COPY.modelStrip.valueLocalOnly
          : ANALYSIS_NEW_COPY.modelStrip.valueNotEncodable,
    )
    if (outcome !== 'not_encodable') setEditing(false)
  }

  if (!offer) return null

  if (editing) {
    return (
      <span className="flex flex-none flex-wrap items-center gap-1">
        <label className="sr-only" htmlFor={inputId}>
          {ANALYSIS_NEW_COPY.modelStrip.valueInputLabel(name ?? '')}
        </label>
        <input
          id={inputId}
          type="number"
          inputMode="decimal"
          value={draft}
          autoFocus={true}
          data-testid={`${testIdPrefix}-value-input`}
          data-node-id={nodeId}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitValue()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              setEditing(false)
            }
          }}
          className={`${typography.panelBody} w-20 min-w-0 rounded border border-panel-border bg-panel px-1.5 py-0.5 text-text-header focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
        />
        <button
          type="button"
          onClick={commitValue}
          data-testid={`${testIdPrefix}-value-save`}
          data-node-id={nodeId}
          className={`${typography.panelMeta} inline-flex items-center rounded-full border border-info/40 px-2 py-0.5 text-info hover:border-info focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
        >
          {ANALYSIS_NEW_COPY.modelStrip.saveValue}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          data-testid={`${testIdPrefix}-value-cancel`}
          data-node-id={nodeId}
          className={`${typography.panelMeta} inline-flex items-center rounded-full px-2 py-0.5 text-text-light hover:text-text-header focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
        >
          {ANALYSIS_NEW_COPY.modelStrip.cancelValue}
        </button>
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        /* ⚠ THE FIELD OPENS EMPTY, NEVER SEEDED. On both surfaces the number
           in question is one the product supplied — an estimate on one, a
           placeholder zero on the other — so seeding would invite the reader to
           nudge OUR number rather than state THEIRS, which is the whole point
           of the act. Neither surface displays a figure whose scale a seed
           could inherit either. */
        setDraft('')
        setEditing(true)
      }}
      data-testid={`${testIdPrefix}-value-edit`}
      data-node-id={nodeId}
      className={`${typography.panelMeta} inline-flex flex-none items-center gap-1 rounded-full border border-info/40 px-2 py-0.5 text-info hover:border-info focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
    >
      <Pencil className="h-3 w-3" aria-hidden={true} />
      {ANALYSIS_NEW_COPY.modelStrip.changeValue}
    </button>
  )
}
