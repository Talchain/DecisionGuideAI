/**
 * ActionChip — the single dispatching-chip primitive for the V5 Phase 3 block
 * renderers (ROADMAP 2.225).
 *
 * THE NO-INVENTION RULE, WHICH IS THE WHOLE POINT OF THIS COMPONENT.
 * Both strings it handles are the PRODUCER's:
 *   - `label`   — what the button SAYS   (contract `action_label`, a caption)
 *   - `message` — what the button SENDS  (contract `action_prompt`, prose)
 * The UI composes NOTHING. It does not template, interpolate, append context,
 * or "improve" the message. If the wording is wrong, the fix belongs at the
 * producer — rewriting it here re-creates the invented interpretation that
 * `action_prompt` exists to remove (@talchain/schemas 0.31.0,
 * CoachingBlockSchema.action_prompt).
 *
 * CALLERS MUST NOT SYNTHESISE `message`. This component cannot enforce that
 * — it takes a string — so the rule is enforced at each call site by only
 * rendering an ActionChip when the producer supplied a prompt. A card with a
 * label and no prompt renders its inert pill instead: that is the honest
 * degradation the contract prescribes, not a gap to paper over with the
 * label.
 *
 * ROUTING — EXISTING SEAMS ONLY (single-writer doctrine, post-#364). The
 * click goes through the guidance store's `_sendChip(label, message)` seam,
 * the SAME path V5HeldProposalBlock's confirm and EvidenceBlock's "Apply to
 * model" already use. It sends a turn; CEE decides what that turn means. The
 * chip mints no client-side graph mutation and calls no endpoint directly.
 *
 * FAIL-CLOSED, WITHOUT ACKNOWLEDGING. With no conversation host registered
 * there is nothing to send, so settling would be a false claim that a turn
 * went out. The click is a safe no-op and the affordance stays LIVE, so the
 * user can act once a host registers (the V5HeldProposalBlock precedent —
 * `if (!sendChip) return`).
 *
 * ACCESSIBILITY. A native <button> — so role, focusability, Enter/Space
 * activation and the disabled semantics are the platform's, not
 * re-implemented. The visible text IS the accessible name (WCAG 2.5.3 "Label
 * in Name" holds by construction), so no aria-label is added to compete with
 * it. Settled renders through the native `disabled` attribute, which
 * CHIP_CLASS styles distinctly.
 */
import { useCallback, useState, type ReactElement } from 'react'
import { useGuidanceStore } from '../../canvas/stores/guidanceStore'
import { CHIP_CLASS } from './chipClass'

export interface ActionChipProps {
  /** Producer's `action_label` — the caption, rendered verbatim. */
  label: string
  /** Producer's `action_prompt` — the turn text, dispatched verbatim. */
  message: string
  /** DOM test id for the chip. */
  testId: string
  /**
   * Producer's `action_intent` — a machine token, NEVER rendered as copy.
   *
   * ⚠⚠ IT USED TO RIDE ONLY AS A `data-*` ATTRIBUTE, AND THAT WAS THE WHOLE
   * DEFECT. CEE's widening card authors `action_intent: 'add_option'`; CEE's
   * add-option rail fires on `ingress.chip?.intent === 'add_option'`
   * (`route-v2.ts:2819`); and this component — the one that RENDERS that card's
   * chip — called `sendChip(label, message)` with no third argument. The
   * producer's typed intent reached the DOM and stopped there. So the user
   * clicked a chip the product itself had offered, the turn fell through to the
   * free-text edit lane, and it came back a refusal (ROADMAP 2.1288,
   * DOM-witnessed 2/2 on 17 Aug) — at the cost of the Run affordance, because
   * the recovery chips replaced the row.
   *
   * The transport was never a missing handler. It was this argument.
   */
  intent?: string
}

export function ActionChip({ label, message, testId, intent }: ActionChipProps): ReactElement {
  const sendChip = useGuidanceStore((s) => s._sendChip)
  const [settled, setSettled] = useState(false)

  const handleClick = useCallback(() => {
    // Bounded re-fire: one chip, one turn. Belt-and-braces with `disabled`
    // below, which already removes pointer events — this guard also covers a
    // programmatic click and any future path that renders the chip enabled.
    if (settled) return
    // Fail closed WITHOUT acknowledging (see header).
    if (!sendChip) return
    // The producer's typed intent travels as chip META, not just as a DOM
    // attribute. `buildV5Payload`'s send gate
    // (`KNOWN_INTENTS ∧ CEE_ACCEPTED_INTENTS`) still decides whether it reaches
    // the wire and still fails CLOSED, so this can only ever forward an intent
    // the PRODUCER declared and the deployed CEE routes.
    sendChip(label, message, intent ? { intent } : undefined)
    setSettled(true)
  }, [settled, sendChip, label, message, intent])

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={settled}
      data-testid={testId}
      {...(settled ? { 'data-settled': 'true' } : {})}
      {...(intent ? { 'data-action-intent': intent } : {})}
      className={CHIP_CLASS}
    >
      {label}
    </button>
  )
}

export default ActionChip
