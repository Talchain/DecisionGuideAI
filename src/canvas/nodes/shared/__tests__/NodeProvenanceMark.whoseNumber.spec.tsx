/**
 * ⛔⛔ UNRUN IN THIS SESSION — CI IS THE AUTHORITY.
 * The 18 Sep re-point below (`'node'` -> `'structural'`) and the set assertion
 * added with it were written under a hard no-execution constraint: no vitest,
 * no typecheck, no install was run against this tree. Nothing here has been
 * observed to pass OR to fail. Treat the "Staging Tests" run on this branch as
 * the only evidence about these assertions.
 */
/**
 * ⭐⭐⭐ "AI ESTIMATE" OVER THE USER'S OWN £49 — the founder saw this himself.
 *
 * Settled at a captured wire body served by build `1690c1f`: factor `6d9a37f3`
 * "Pro Plan Monthly Price" carried `provenance: "ai_inferred"` AND
 * `observed_state: { baseline 49, source "brief_extraction", extractionType
 * "explicit" }`. Both true; they answer different questions. `provenance` is
 * **who authored the NODE** — and that label really is the model's, because the
 * user wrote "increase the Pro plan price from £49 to £59" and never coined the
 * name. The badge was relabelling it as a claim about the NUMBER.
 *
 * ⚠ Three diagnoses preceded this one and all three were wrong — an absent
 * `extractionType`, a positive confirmation-demote, and the wrong writer
 * function. None was settled by derivation; the wire body settled it. These
 * fixtures therefore carry the MEASURED shape, not a plausible one.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NodeProvenanceMark } from '../NodeProvenanceMark'
import { STRUCTURAL_PROVENANCE_LABEL } from '../../../domain/nodeProvenanceClaim'
import type { NodeProvenanceClaim } from '../../../domain/nodeProvenanceClaim'

/** Same binding the sibling spec uses: the mark's own testid, and the
 *  `aria-label` that carries the claim — the no-hover/no-focus channel. */
const mark = () => screen.queryByTestId('node-provenance-mark')
const label = () => mark()!.getAttribute('aria-label')!

/**
 * ⚠ ADDED 18 Sep 2026. Where node authorship and value basis DISAGREE the card
 * now renders BOTH facts, so `queryByTestId` throws on multiple matches and
 * "the label" is no longer a single thing. These bind a mark to WHICH QUESTION
 * it answers, via `data-provenance-claim`, rather than to its position — with
 * two marks present, position is not identity (trap 19).
 *
 * Every OTHER test in this file is untouched and still uses `label()`: their
 * fixtures agree (`ai_inferred` + `cee_hypothesis`), or carry no value source,
 * so exactly one mark renders and the old binding remains exact.
 *
 * ⛔⛔ RE-POINTED 18 Sep 2026 TO THE DOMAIN VOCABULARY, AND THE HELPER'S OWN TYPE
 * WAS HALF THE DEFECT. This read `(claim: 'node' | 'value')` while the card's
 * authorship mark emitted `data-provenance-claim="node"` — a fourth value in a
 * vocabulary whose owner declares three (`NodeProvenanceClaim = 'value' |
 * 'structural' | 'none'`). Spec and component AGREED on a spelling the domain
 * type, the label builder and six other assertions all reject, so the split was
 * cemented on both sides and no assertion anywhere could see it. Typing the
 * helper from the DOMAIN rather than from the component's argument is what makes
 * a future re-split a type error here as well as at the card.
 */
type MarkClaim = Exclude<NodeProvenanceClaim, 'none'>
const marksByClaim = (claim: MarkClaim) =>
  screen.queryAllByTestId('node-provenance-mark')
    .filter(el => el.getAttribute('data-provenance-claim') === claim)
const claimLabel = (claim: MarkClaim) => {
  const found = marksByClaim(claim)
  expect(found, `expected exactly one "${claim}" mark`).toHaveLength(1)
  return found[0].getAttribute('aria-label')!
}

/** A factor carrying a declared value — the shape that earns a `'value'` claim. */
const factorWith = (over: Record<string, unknown>) => ({
  label: 'Pro Plan Monthly Price',
  kind: 'factor',
  value: 49,
  unit: '£',
  ...over,
})

describe('the badge says whose NUMBER it is, not who named the node', () => {
  /**
   * ⚠ WIDENED 18 Sep 2026 ON A FOUNDER RULING, AND THE ORIGINAL CLAIM IS INTACT.
   *
   * This case is the ONE where the two facts disagree, so it is the only test in
   * this file whose output changed: the card now renders BOTH marks instead of
   * letting the value answer silence the authorship one.
   *
   * Paul, 18 Sep: *"These are not from the user. These are the AI adding value,
   * so they need to be displayed in a different way."* The old single mark said
   * "From brief" and dropped the fact that **Olumi named this node** — the user
   * wrote "increase the Pro plan price from £49 to £59" and never coined "Pro
   * Plan Monthly Price". Answering only the number's question left his own
   * question — *did Olumi suggest this, or did I bring it?* — unanswerable.
   *
   * ⭐ THE ORIGINAL FIX IS ASSERTED UNCHANGED BELOW: the VALUE mark still reads
   * "From brief" and still must not read "Olumi estimate" over the user's own £49.
   * The second mark ADDS a true fact; it does not soften the first.
   */
  it('⭐ THE MEASURED CASE: model-named node, user-stated number ⇒ BOTH facts', () => {
    render(
      <NodeProvenanceMark
        nodeType={'factor' as never}
        data={factorWith({
          provenance: 'ai_inferred',
          observedState: { value: 0.49, baseline: 49, source: 'brief_extraction', extractionType: 'explicit' },
        })}
      />,
    )
    // The number's basis — the original claim of this spec, unchanged.
    expect(claimLabel('value')).toContain('From brief')
    // ⛔ The half that makes it a fix rather than a relabel.
    expect(claimLabel('value')).not.toContain('Olumi estimate')
    // The authorship fact that used to vanish: Olumi named this node.
    //
    // ⭐ ASSERTED POSITIVELY, AND THAT IS THE POINT. `not.toContain('From
    // brief')` — what this line said until the type error below was found —
    // passes on an EMPTY label, on a garbled one, and on any wrong-but-
    // different sentence. It cannot distinguish "the authorship mark says the
    // right thing" from "the authorship mark says nothing at all", which is
    // the exact failure the two-mark change exists to prevent.
    //
    // ⚠ It also could not see a real defect that shipped past it: the first
    // argument was `'node'`, which is not a member of
    // `Exclude<NodeProvenanceClaim, 'none'>` — a TS2345 that reddened the
    // typecheck gate while this assertion stayed green, because a type error
    // still renders SOMETHING and that something did not contain "From brief".
    // A negative assertion is satisfied by every wrong answer but one.
    expect(claimLabel('structural')).toBe(STRUCTURAL_PROVENANCE_LABEL.ai)
    expect(marksByClaim('structural')).toHaveLength(1)

    // ⛔ AND NO FOURTH SPELLING. The two assertions above bind by identity, but
    // each only proves its OWN claim is present — neither can see a mark
    // carrying a value outside the domain vocabulary, which is precisely what
    // shipped (`"node"`). This pins the EXACT SET the card emits, so a fourth
    // spelling REDs here as well as at the compiler.
    expect(
      screen.queryAllByTestId('node-provenance-mark')
        .map(el => el.getAttribute('data-provenance-claim'))
        .sort(),
    ).toEqual(['structural', 'value'])
  })

  /**
   * ⛔ CONTRAST ONE. Without it, a component hardcoded to say "From brief"
   * passes the row above — and that is the same lie pointed the other way,
   * told to the population the current code serves CORRECTLY.
   */
  it('⛔ CONTRAST: a genuinely model-supplied number still reads "Olumi estimate"', () => {
    render(
      <NodeProvenanceMark
        nodeType={'factor' as never}
        data={factorWith({
          provenance: 'ai_inferred',
          observedState: { value: 0.2, source: 'cee_hypothesis' },
        })}
      />,
    )
    expect(label()).toContain('Olumi estimate')
  })

  /**
   * ⛔⛔ CONTRAST TWO — THE THIRD POPULATION, AND THE ONE A TWO-ARM PAIR CANNOT SEE.
   *
   * `classifyValueProvenance` returns `null` for an absent or unrecognised
   * `source`. Reading it INSTEAD of node authorship would blank the badge here —
   * and for these nodes "Olumi estimate" is frequently TRUE, so that is not a safe
   * default but a LOST DISCLOSURE. The identical regression stopped the CEE-side
   * attempt: 20 assertions' worth of honest disclosures went silent.
   *
   * ⭐ ASSERTED DELIBERATELY, NOT INHERITED. The rule is that the value answer
   * wins only where it positively exists; absent ⇒ today's behaviour, unchanged.
   * So this must keep saying exactly what it says today.
   */
  it('⛔⛔ CONTRAST: an ABSENT value source keeps today’s answer — it does not go silent', () => {
    render(
      <NodeProvenanceMark
        nodeType={'factor' as never}
        data={factorWith({ provenance: 'ai_inferred', observedState: { value: 0.2 } })}
      />,
    )
    expect(mark(), 'the badge went silent — a true disclosure was lost').not.toBeNull()
    expect(label()).toContain('Olumi estimate')
  })

  it('⛔⛔ CONTRAST: an UNRECOGNISED value source behaves the same as an absent one', () => {
    render(
      <NodeProvenanceMark
        nodeType={'factor' as never}
        data={factorWith({ provenance: 'ai_inferred', observedState: { value: 0.2, source: 'something_new' } })}
      />,
    )
    expect(label()).toContain('Olumi estimate')
  })

  /**
   * ⚠ THE STRUCTURAL CLAIM IS UNTOUCHED. A goal's badge is about who put the
   * element on the board, which `provenance` answers correctly — and it reads a
   * different label table entirely ("Olumi suggested this", never "AI
   * estimate"). Routing a value answer into it would be this same defect
   * inverted.
   */
  it('a node with NO declared value still answers the structural question', () => {
    render(
      <NodeProvenanceMark
        nodeType={'outcome' as never}
        data={{ label: 'Revenue grows', kind: 'outcome', provenance: 'ai_inferred' }}
      />,
    )
    expect(label()).not.toContain('Olumi estimate')
  })
})
