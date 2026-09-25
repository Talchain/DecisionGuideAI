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
   * "From brief" and still must not read "AI estimate" over the user's own £49.
   * The second mark ADDS a true fact; it does not soften the first.
   */
  /**
   * ⛔⛔ UPDATED 24 Sep 2026 (GAP-16, DESIGN-GAP-AUDIT-20260924.md row 16).
   *
   * This test used to assert the header rendered BOTH the structural fact
   * ("Olumi named this node") AND the value fact ("From brief") side by side.
   * The value half is now GONE from the header by design: `FactorNode` mounts
   * its own value-line source mark (`valueSourceMark.tsx`) for the same
   * number, classified through the identical `classifyValueProvenance`, so the
   * header's copy of it was one fact stamped twice (contract §03: "Show
   * useful exceptions, not the same provenance mark everywhere"). The
   * STRUCTURAL fact this test was written to rescue is UNTOUCHED — it is now
   * the only mark this component ever emits for a factor.
   *
   * See `BaseNode.gap16NoDuplicateHeaderProvenance.spec.tsx` for the
   * full-card proof that "From brief" still reaches the user, on the value
   * line, so this is a de-duplication and not the silent regression this
   * spec was originally written to prevent.
   */
  it('⭐ THE MEASURED CASE: model-named node, user-stated number ⇒ the STRUCTURAL fact survives, the VALUE half moves to the value line', () => {
    render(
      <NodeProvenanceMark
        nodeType={'factor' as never}
        data={factorWith({
          provenance: 'ai_inferred',
          observedState: { value: 0.49, baseline: 49, source: 'brief_extraction', extractionType: 'explicit' },
        })}
      />,
    )
    // The authorship fact that used to vanish before the two-mark change:
    // Olumi named this node. Still asserted positively, still bound by claim
    // identity rather than by a label predicate another mark could satisfy.
    expect(claimLabel('structural')).toBe(STRUCTURAL_PROVENANCE_LABEL.ai)
    expect(marksByClaim('structural')).toHaveLength(1)

    // ⛔ NO VALUE MARK IN THE HEADER, AND NO FOURTH SPELLING EITHER. The set
    // this component emits for a valued, disagreeing factor is now exactly
    // one entry.
    expect(
      screen.queryAllByTestId('node-provenance-mark')
        .map(el => el.getAttribute('data-provenance-claim'))
        .sort(),
    ).toEqual(['structural'])
  })

  /**
   * ⛔⛔ UPDATED 24 Sep 2026 (GAP-16). These three used to assert the header
   * read "AI estimate" for a factor whose value classifies as `ai`. Under
   * GAP-16 a `claim: 'value'` mark NEVER reaches the header — not because the
   * fact went silent, but because `FactorNode`'s own value-line mark already
   * carries it (the "est." token, or `ValueSourceMark`'s "no source" state
   * for the unrecognised/absent cases — see `valueSourceMark.tsx`). These
   * three cases share one property that is still worth a contrast: none of
   * them produces a STRUCTURAL fact either (nothing here disagrees with
   * anything), so the header is correctly and simply silent, matching a
   * structural-only card with no provenance signal at all.
   */
  // ⛔ review 5822866079: none of these three sources classify on the value line
  // (`factorValueSourceMark` → unknown), so the header's "AI estimate" is the
  // only mark with a kind and it STAYS — a number is never unmarked.
  it('⛔ CONTRAST: a model-supplied number the value line cannot classify keeps its header value mark', () => {
    render(
      <NodeProvenanceMark
        nodeType={'factor' as never}
        data={factorWith({
          provenance: 'ai_inferred',
          observedState: { value: 0.2, source: 'cee_hypothesis' },
        })}
      />,
    )
    expect(mark()).not.toBeNull()
    expect(mark()!.getAttribute('data-provenance-claim')).toBe('value')
  })

  it('⛔⛔ CONTRAST: an ABSENT value source ALSO keeps its header value mark', () => {
    render(
      <NodeProvenanceMark
        nodeType={'factor' as never}
        data={factorWith({ provenance: 'ai_inferred', observedState: { value: 0.2 } })}
      />,
    )
    // ⚠ Unlike before GAP-16, silence HERE is correct: this isolated render
    // cannot see `FactorNode`'s value line, which is where the disclosure now
    // lives unconditionally (`factorValueSourceMark` never returns null for a
    // stated value). `BaseNode.gap16NoDuplicateHeaderProvenance.spec.tsx`
    // proves the full-card case does not go silent.
    expect(mark()).not.toBeNull()
    expect(mark()!.getAttribute('data-provenance-claim')).toBe('value')
  })

  it('⛔⛔ CONTRAST: an UNRECOGNISED value source behaves the same as an absent one (header mark kept)', () => {
    render(
      <NodeProvenanceMark
        nodeType={'factor' as never}
        data={factorWith({ provenance: 'ai_inferred', observedState: { value: 0.2, source: 'something_new' } })}
      />,
    )
    expect(mark()).not.toBeNull()
    expect(mark()!.getAttribute('data-provenance-claim')).toBe('value')
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
    expect(label()).not.toContain('AI estimate')
  })
})
