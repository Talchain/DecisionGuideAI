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

/** Same binding the sibling spec uses: the mark's own testid, and the
 *  `aria-label` that carries the claim — the no-hover/no-focus channel. */
const mark = () => screen.queryByTestId('node-provenance-mark')
const label = () => mark()!.getAttribute('aria-label')!

/** A factor carrying a declared value — the shape that earns a `'value'` claim. */
const factorWith = (over: Record<string, unknown>) => ({
  label: 'Pro Plan Monthly Price',
  kind: 'factor',
  value: 49,
  unit: '£',
  ...over,
})

describe('the badge says whose NUMBER it is, not who named the node', () => {
  it('⭐ THE MEASURED CASE: model-named node, user-stated number ⇒ "From brief"', () => {
    render(
      <NodeProvenanceMark
        nodeType={'factor' as never}
        data={factorWith({
          provenance: 'ai_inferred',
          observedState: { value: 0.49, baseline: 49, source: 'brief_extraction', extractionType: 'explicit' },
        })}
      />,
    )
    expect(label()).toContain('From brief')
    // ⛔ The half that makes it a fix rather than a relabel.
    expect(label()).not.toContain('AI estimate')
  })

  /**
   * ⛔ CONTRAST ONE. Without it, a component hardcoded to say "From brief"
   * passes the row above — and that is the same lie pointed the other way,
   * told to the population the current code serves CORRECTLY.
   */
  it('⛔ CONTRAST: a genuinely model-supplied number still reads "AI estimate"', () => {
    render(
      <NodeProvenanceMark
        nodeType={'factor' as never}
        data={factorWith({
          provenance: 'ai_inferred',
          observedState: { value: 0.2, source: 'cee_hypothesis' },
        })}
      />,
    )
    expect(label()).toContain('AI estimate')
  })

  /**
   * ⛔⛔ CONTRAST TWO — THE THIRD POPULATION, AND THE ONE A TWO-ARM PAIR CANNOT SEE.
   *
   * `classifyValueProvenance` returns `null` for an absent or unrecognised
   * `source`. Reading it INSTEAD of node authorship would blank the badge here —
   * and for these nodes "AI estimate" is frequently TRUE, so that is not a safe
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
    expect(label()).toContain('AI estimate')
  })

  it('⛔⛔ CONTRAST: an UNRECOGNISED value source behaves the same as an absent one', () => {
    render(
      <NodeProvenanceMark
        nodeType={'factor' as never}
        data={factorWith({ provenance: 'ai_inferred', observedState: { value: 0.2, source: 'something_new' } })}
      />,
    )
    expect(label()).toContain('AI estimate')
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
