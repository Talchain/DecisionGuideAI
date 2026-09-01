import { classifyNodeProvenance, VALUE_PROVENANCE_LABEL } from '../../domain/valueProvenance'
import { typography } from '../../../styles/typography'

/**
 * ⭐⭐ WHO PUT THIS ELEMENT HERE — on the card, at a fixed position, on every
 * node type.
 *
 * THE PROBLEM THIS ANSWERS, from driving deployed staging: **every element on a
 * canvas card is a CONCLUSION.** `Influence 100%`, `Ahead 48%`, `Strength 50%`,
 * a `#1` rank badge — six type sizes on one card and all of them results.
 * Nothing on the card says where any of it CAME FROM. The only provenance
 * signal a card carried was `est.`, rendered at 7px: **the thing that should be
 * loudest was the smallest thing there.**
 *
 * A user therefore could not tell their own model from Olumi's guesses at a
 * glance — which is the difference between a diagram of a brief and a surface
 * you can review. The founder's own reframe: the analysis's job is to drive the
 * user to check what the AI generated and what they supplied, so the canvas
 * should lead with *"here is what I made up — check it"*.
 *
 * ⚠ NOTHING HERE IS NEW, AND THAT IS DELIBERATE. Every part of this already
 * existed and only the inspector and the pre-analysis panels were using it:
 *   · `classifyNodeProvenance` — the ONE authority on what a `CEEProvenance`
 *     literal means (`user_set` → human, `from_brief` → brief, `ai_inferred` →
 *     ai). Not re-decided here; a change to the vocabulary reaches this mark
 *     for free.
 *   · `VALUE_PROVENANCE_LABEL` — the canonical copy. A second spelling of
 *     "AI estimate" on the canvas is how one idea comes to have two names.
 *   · the border palette is the same mapping `SourceProvenancePill` uses in the
 *     Reasoning tab, so the two surfaces cannot drift apart on colour either.
 * The field itself arrives on the wire and `mapDraftNodeToCanvas` already
 * spreads it onto `data` — nothing is minted, plumbed or invented.
 *
 * ⛔ ABSENT PROVENANCE RENDERS NOTHING, NEVER A GUESS. `classifyNodeProvenance`
 * returns null for any literal it does not recognise, and this returns null with
 * it. A mark that defaulted to "AI estimate" would be inventing an attribution —
 * the exact class of claim this component exists to make honest. Fail-closed is
 * the whole point: silence is a state a reader can interpret, a wrong
 * attribution is not.
 *
 * ⚠ NOT A BUTTON AND NOT FOCUSABLE, matching `EstimateMarker`'s recorded
 * reasoning: it is a status marker, the detail behind it is reachable through
 * the node's quick actions and the inspector (both keyboard-reachable), and a
 * second tab stop per node would cost more than it gives. The `title` carries
 * the raw literal for anyone debugging what the producer actually sent.
 */
const BORDER: Record<string, string> = {
  brief: 'border-info/40 text-info',
  ai: 'border-warning/40 text-warning',
  human: 'border-success/40 text-success',
  confirmed: 'border-success/40 text-success',
  edited: 'border-success/40 text-success',
  assumption: 'border-success/40 text-success',
  panel: 'border-info/40 text-info',
}

export interface NodeProvenanceMarkProps {
  /** The node's raw `provenance` literal, straight off `data`. */
  provenance: unknown
}

export function NodeProvenanceMark({ provenance }: NodeProvenanceMarkProps) {
  // ⚠ THIS TYPE GUARD IS DEFENSIVE, NOT LOAD-BEARING, and a mutation test
  // proved it: removing it kills no assertion. `classifyNodeProvenance`
  // compares with `===` against three string literals, so a number, an object
  // or undefined all fall through to its `return null` and this component
  // returns null with it — the guard changes nothing observable.
  //
  // Recorded rather than quietly counted as a third biting mutant. An
  // equivalent mutant has to be DEMONSTRATED, and the demonstration is: the
  // only other use of `raw` is the `title`, which is never reached when `cls`
  // is null. It stays because it makes the contract legible at the call site
  // (`data.provenance` is `unknown`), not because a test depends on it.
  const raw = typeof provenance === 'string' ? provenance : null
  const cls = classifyNodeProvenance(raw)
  if (!cls) return null

  return (
    <span
      data-testid="node-provenance-mark"
      data-provenance-kind={cls.kind}
      title={`${VALUE_PROVENANCE_LABEL[cls.kind]} — source: ${raw}`}
      className={`${typography.edgeLabel} inline-flex shrink-0 items-center rounded-full border bg-transparent px-1.5 leading-none ${BORDER[cls.kind] ?? 'border-panel-border text-text-light'}`}
    >
      {VALUE_PROVENANCE_LABEL[cls.kind]}
    </span>
  )
}
