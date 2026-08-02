/**
 * CalibrateDrillIn — inline numeric calibration for one estimate.
 *
 * ⭐ ROADMAP 2.304 slice 1 — THIS COMMIT IS A REAL TURN, AND "CHECKED BY YOU"
 * IS GATED ON THE RECEIPT.
 *
 * What it used to be: `commitValue` / `commitConfirm` were pure
 * `useCanvasStore` writes. The number never left the browser, CEE's
 * `graph_hash` never moved, the re-run the panel invites returned the same
 * answer — and the row stamped **"checked by you"** on the strength of
 * nothing. That is the same store-only-edit class #513 closed for the
 * inspector and 2.121/2.129 closed for the Model tab, still live on the third
 * surface (design-s3-edit-persistence-2026-08-03.md §2 manifest).
 *
 * What it is now — the EXISTING `factor_value_edit` machinery, reused verbatim,
 * not a private path:
 *   `buildFactorValueEditEvent` (the one scale authority) → `sendSystemEvent`
 *   (so the edit rides the dispatcher's deferral buffer when an analysis holds
 *   the lock) → CEE's deterministic `set_factor_value` → fence + CAS at commit
 *   → an applied `graph_patch` receipt → `confirmOptimisticFactorEdit` writes
 *   the provenance stamp. A refusal (200, no receipt) reverts through
 *   `revertOptimisticFactorEdit`, exactly as it does for the other two
 *   surfaces.
 *
 * THE SPLIT THAT MATTERS: the NUMBER is written optimistically (the canvas
 * moves at once, even if the turn is slow) but the CLAIM is not. `source`
 * paints "checked by you" and drops the factor out of the "N to verify" count
 * — it is an assertion about what the ENGINE holds, so it waits for the
 * engine's receipt. Writing it at commit, or at dispatch, is the 2.304 defect.
 *
 * IN-FLIGHT PILL — the trade, and the alternative that was RULED OUT (#560).
 * While the turn is unanswered the row shows the user's number beside its
 * PRE-EXISTING pill (e.g. "Olumi estimate"), because `setObservedValue`
 * preserves `source`. The obvious alternative — writing a neutral placeholder
 * source ('not checked yet' / 'user_pending') for the in-flight window — was
 * considered and REJECTED: `observedState` is spread wholesale into the PLoT
 * payload by `extractObservedState` (`src/adapters/plot/v2/adapter.ts:913-937`),
 * so a placeholder would cross the wire untraced, and it would become PERMANENT
 * on every path where no receipt can arrive. If this window's presentation
 * needs changing, change the RENDER — never the stored `source`. Do not
 * re-propose the placeholder.
 *
 * NO GUEST ARM, deliberately. The `factor_value_edit` machinery has none:
 * `sendSystemEvent` → `sendTurn` → `callV5Turn` carries no auth gate, and CEE
 * commits the mutation server-side regardless of auth tier. Guests therefore
 * take this identical path and get identical receipts. No new copy is
 * introduced here for any tier.
 *
 * Value-scale guard: rows with canEditValue=false render confirm-only (no
 * numeric input) because only a normalised model-scale value exists.
 */

import { memo, useCallback, useState } from 'react'
import { Check } from 'lucide-react'
import Tooltip from '../../../../components/Tooltip'
import { typography, typo } from '../../../../styles/typography'
import { FIELD_FEEDBACK_COPY } from '../constants'
import { useCanvasStore } from '../../../store'
import { getObservedState, type ObservedStateData } from '../../../utils/observedStateHelpers'
import { useOptionalConversationContext } from '../../../conversation/ConversationContext'
import {
  buildFactorValueEditEvent,
  resolveValueInputSeed,
  type ValueInputSeedBasis,
} from '../../../conversation/factorValueEdit'
import { captureOptimisticFactorEdit } from '../../../conversation/optimisticFactorEdit'
import { useNodeMutations } from '../../../ui/inspector-v2/useInspectorMutations'
import { PanelIconButton } from '../ui/PanelIconButton'
import { parseSuccessTarget } from '../hero/parseSuccessTarget'
import type { EstimateRowModel } from '../types'

interface CalibrateDrillInProps {
  row: EstimateRowModel
  onDone: () => void
}

/**
 * The provenance stamps this surface earns on a receipt.
 *
 * Same two values the legacy handlers wrote, unchanged — only their TIMING
 * moves. `user_override` for a typed value, `user_confirmed` +
 * `extractionType: 'explicit'` for "Confirm as is", both members of
 * `isReviewedByUser`'s REVIEWED_SOURCES set, so the pill copy is untouched.
 */
const VALUE_STAMP = { source: 'user_override' } as const
const CONFIRM_STAMP = { source: 'user_confirmed', extractionType: 'explicit' } as const

/**
 * Range guard for normalised-scale-only factors — journey-walk 2026-08-03
 * gap #3 (ROADMAP 2.159/S1/S3 class), the witnessed `£60,000` → "6000000%"
 * chain.
 *
 * When a factor carries NO cap, NO unit and NO raw-value display anchor but
 * DOES carry a model-scale `value` in [0,1], the number this editor commits
 * IS the model-scale value (normaliseRawFactorValue returns it verbatim
 * without a cap) and every downstream surface treats it as 0–1 — the canvas
 * painted the walk's 60000 as "6000000%". The NL edit path already refuses
 * exactly this shape ("recorded without a unit … I haven't changed
 * anything"); this guard gives the direct editor the same discipline.
 *
 * Validation reads ONLY what the node data genuinely carries
 * (observedState value / raw_value / unit / cap) — ROADMAP 2.193: no
 * structured bound crosses the wire, so no server contract is invented.
 * Factors with a cap (raw/cap normalisation exists), a unit, a raw anchor,
 * or no value at all keep today's behaviour: for those, the typed number is
 * the factor's own display-scale anchor (pinned by
 * calibrateDrillInParse.spec.tsx).
 */
function refusesNormalisedScaleEntry(
  nodeData: unknown,
  cap: number | null,
  parsedValue: number,
): boolean {
  if (typeof cap === 'number' && Number.isFinite(cap) && cap > 0) return false
  const observed = getObservedState(nodeData)
  if (observed.unit != null && String(observed.unit).trim() !== '') return false
  if (observed.raw_value != null) return false
  const existing = observed.value
  const declaredNormalised =
    typeof existing === 'number' && Number.isFinite(existing) && existing >= 0 && existing <= 1
  if (!declaredNormalised) return false
  return parsedValue < 0 || parsedValue > 1
}

export const CalibrateDrillIn = memo(function CalibrateDrillIn({ row, onDone }: CalibrateDrillInProps) {
  const [draft, setDraft] = useState(row.rawPrefill != null ? String(row.rawPrefill) : '')
  const [hint, setHint] = useState<string | null>(null)

  // The sanctioned setter (the `NODE_SETTER_FIELDS` manifest the writtenFields
  // guard spec enforces), not a hand-rolled `updateNode` — the same one both
  // other value-committing surfaces use. It writes `observedState.value`,
  // `raw_value` and clears BOTH stale `display_value` copies in ONE update, so
  // the row cannot render CEE's prose for the previous number.
  const mutations = useNodeMutations(row.nodeId)

  // Optional by design, exactly as `FactorControllablePanel` and
  // `FactorsSection` do it: this panel renders in surfaces that are not inside
  // the ConversationProvider (and in unit tests), and a missing provider must
  // degrade to "local edit only", never throw. Routing through the context is
  // also what puts these edits behind `useConversation`'s deferral buffer — an
  // edit committed during a running analysis is queued and flushed when the
  // in-flight lock clears, rather than dropped.
  const sendSystemEvent = useOptionalConversationContext()?.sendSystemEvent

  /**
   * ONE commit path for both affordances.
   *
   * Building the event FIRST and feeding both the local write and the wire from
   * it is what makes the two structurally unable to disagree about the same
   * edit — the property the Model tab's nine hand-rolled handlers lacked.
   *
   * `seedBasis` is NOT a second scale rule: it tells the single scale authority
   * WHICH number the committing control was displaying, which is the one thing
   * that authority cannot derive for itself.
   * - the typed field passes `'raw_only'` — it is prefilled from
   *   `row.rawPrefill` (the node's `raw_value`, or EMPTY) and by design never
   *   shows the normalised model-scale `value`, so a stored `value` says
   *   nothing about the scale of what was typed. Reading it as the seed would
   *   classify a `£60,000` entry on a capped factor as a model-scale number —
   *   the 6000000% class the #559 entry guard exists to stop, re-entered
   *   through the scale module.
   * - "Confirm as is" passes the DEFAULT basis: the user typed nothing, they
   *   endorsed the numbers already stored, and `raw_value ?? value` is exactly
   *   what "the numbers already stored" means.
   *
   * `writeValue: false` is likewise not an optimisation. A confirmation changes
   * no number, and `setObservedValue` clears BOTH `display_value` copies — so
   * running it here would silently drop CEE's display prose off a row the user
   * asked to leave alone.
   */
  const commit = useCallback(
    (
      typedValue: number,
      reviewedStamp: Partial<ObservedStateData>,
      opts: { seedBasis?: ValueInputSeedBasis; writeValue: boolean },
    ): void => {
      const node = useCanvasStore.getState().nodes.find(n => n.id === row.nodeId)
      if (!node) return
      // The node's data as it is BEFORE the local write — its own cap/unit is
      // what decides the scale of what the user typed, and it is what the undo
      // snapshot must restore.
      const nodeData = node.data

      const event = buildFactorValueEditEvent({
        nodeId: row.nodeId,
        typedValue,
        nodeData,
        ...(opts.seedBasis ? { seedBasis: opts.seedBasis } : {}),
      })
      // Fail CLOSED: an unencodable edit (no id, non-finite number) writes
      // nothing rather than committing a number the wire cannot carry — and,
      // with no wire event, there can be no receipt and so no honest claim.
      if (!event) return
      const { value: modelValue, raw_value: rawMagnitude } = event.payload as {
        value: number
        raw_value?: number
      }

      // Captured BEFORE the write, from the same pre-write data the event was
      // built from. Carries the receipt-gated stamp: a refusal restores the
      // whole pre-edit observed state, an acceptance writes the stamp.
      const undo = captureOptimisticFactorEdit(row.nodeId, modelValue, nodeData, reviewedStamp)

      // The number moves now; the CLAIM does not. No `{ source }` option is
      // passed — that is the 2.304 fix in one line.
      if (opts.writeValue) mutations.setObservedValue(modelValue, rawMagnitude)

      if (!sendSystemEvent) return
      void Promise.resolve(
        // The undo (and its stamp) travel WITH the send: the dispatcher owns
        // the reply, including a DEFERRED edit's reply, which a `.then` here
        // could never see (that promise resolves with SEND_DEFERRED before the
        // turn exists).
        sendSystemEvent(event, undo ? { optimisticFactorEdit: undo } : undefined),
      ).catch(() => {
        // Swallowed deliberately: a genuine send failure is recorded by the
        // conversation's own failure channel (and, past the deferral attempt
        // cap, by `noticeForUnsentEdit`'s transcript line). A server REFUSAL is
        // not a failure and never reaches here — the dispatcher reverts.
      })
    },
    [row.nodeId, mutations, sendSystemEvent],
  )

  const save = () => {
    // Shares the hero field's parser (#396). The digit-strip this replaced
    // (`replace(/[^0-9.,-]/g,'').replace(/,/g,'')`) was byte-identical to the
    // `parseDisplayNumber` deleted from HeroSection: it dropped magnitude
    // suffixes and FUSED unrelated numbers, so "£500k" committed 500 and
    // "£500k within 12 months" committed 50012. This field writes through
    // `commit` into node observedState AND onto the wire, so those fabrications
    // reached the ANALYSIS, not just a label.
    //
    // parseSuccessTarget fails CLOSED on ambiguity (returns null), which is the
    // behaviour this call site wants: an unresolvable estimate must hint rather
    // than guess, exactly as the old unparseable branch did.
    //
    // `unit` is deliberately ignored — the scale comes from the factor's own
    // cap/unit inside `buildFactorValueEditEvent`, so consuming the parser's
    // unit here would add a second, conflicting scale authority.
    const parsed = parseSuccessTarget(draft)
    if (parsed === null) {
      setHint(FIELD_FEEDBACK_COPY.numberHint)
      return
    }
    // Walk gap #3: on a normalised-scale-only factor the committed number IS
    // the model-scale value — refuse out-of-range magnitudes at entry with
    // honest copy instead of painting them as absurd percentages.
    const node = useCanvasStore.getState().nodes.find(n => n.id === row.nodeId)
    if (node && refusesNormalisedScaleEntry(node.data, row.cap, parsed.value)) {
      setHint(FIELD_FEEDBACK_COPY.normalisedRangeHint)
      return
    }
    commit(parsed.value, VALUE_STAMP, { seedBasis: 'raw_only', writeValue: true })
    onDone()
  }

  /**
   * "Confirm as is" — the user endorses the number already on the row.
   *
   * It is the SAME turn, carrying the stored value, for one reason: a
   * confirmation is a claim about what the ENGINE holds, so the engine has to
   * answer it. CEE's `set_factor_value` emits a receipt either way —
   * `status: 'applied'` when the number moved, `status: 'noop'` when it did not
   * (`orchestrator-v5/tools/handlers/set-factor-value.ts`, the `noop`
   * predicate; the composer passes that status straight through to the boundary
   * `graph_patch` block). `responseAppliedFactorEdit` counts `noop` as applied
   * — its NOT_APPLIED set is closed over the genuinely-not-applied statuses and
   * fails SAFE on anything else — so a confirmed-unchanged value earns its
   * stamp, and only a genuine refusal (no receipt at all) withholds it.
   *
   * Fails CLOSED when the node carries no number: nothing to confirm means
   * nothing to receipt, and an unreceipted stamp is the defect. "Confirm as is"
   * is not offered on those rows anyway (`!row.needsValue`).
   */
  const confirmAsIs = () => {
    const node = useCanvasStore.getState().nodes.find(n => n.id === row.nodeId)
    const { seed } = resolveValueInputSeed(node?.data)
    if (seed == null) return
    commit(seed, CONFIRM_STAMP, { writeValue: false })
  }

  return (
    <div className="mb-2 ml-6 flex items-center gap-2" data-testid="pre-analysis-v3-drill">
      {row.canEditValue && (
        <>
          <input
            aria-label={`Your estimate for ${row.label}`}
            inputMode="decimal"
            className={`${typography.panelBody} h-7 w-28 rounded-lg border border-panel-border bg-panel px-2 text-text-header outline-none placeholder:text-text-light focus:border-info focus:ring-2 focus:ring-info/20`}
            placeholder="Set value"
            aria-invalid={hint ? true : undefined}
            value={draft}
            onChange={e => {
              setDraft(e.target.value)
              if (hint) setHint(null)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') onDone()
            }}
          />
          <Tooltip content="Save your estimate" delay={300}>
            <PanelIconButton variant="go" aria-label={`Save estimate for ${row.label}`} onClick={save}>
              <Check className="h-3.5 w-3.5" aria-hidden />
            </PanelIconButton>
          </Tooltip>
        </>
      )}
      {!row.needsValue && (
        <button
          type="button"
          onClick={() => {
            confirmAsIs()
            onDone()
          }}
          className={typo(
            'panelMeta',
            'rounded-full border border-panel-border bg-transparent px-2.5 py-1 text-text-body outline-none transition-colors hover:bg-panel-hover focus-visible:bg-panel-hover focus-visible:ring-2 focus-visible:ring-info/40',
          )}
          data-testid="pre-analysis-v3-confirm-as-is"
        >
          Confirm as is
        </button>
      )}
      {hint && (
        <span className={`${typography.panelMeta} text-warning`} role="status">
          {hint}
        </span>
      )}
    </div>
  )
})
