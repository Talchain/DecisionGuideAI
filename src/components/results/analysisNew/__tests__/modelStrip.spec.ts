/**
 * "Your model so far" — what it reports, and the claim it must never make.
 *
 * The load-bearing test here is the LAST one. Everything else checks grouping;
 * that one checks that the strip cannot grow a provenance claim without a test
 * going red, which is the constraint the component exists under.
 */

import { describe, expect, it } from 'vitest'

import { buildModelStrip, MARK_CAP } from '../buildModelStrip'
// The product's own "N to verify" function, imported so the two counts are
// compared rather than re-stated — see the union assertion at the foot.
import { countFactorsToVerify } from '../../../../canvas/components/model-tab/utils'

const node = (id: string, type: string, label?: string) => ({
  id,
  type,
  data: label === undefined ? {} : { label },
})

describe('grouping and the header', () => {
  it('groups by kind, in the design order, with counts', () => {
    const strip = buildModelStrip([
      node('o1', 'option', 'Adopt Segment'),
      node('f1', 'factor', 'Annual cost'),
      node('r1', 'risk', 'Migration delay'),
      node('o2', 'option', 'Adopt RudderStack'),
      node('u1', 'outcome', 'GDPR compliance'),
    ])
    expect(strip.rows.map((r) => r.kind)).toEqual(['option', 'factor', 'risk', 'outcome'])
    expect(strip.rows.find((r) => r.kind === 'option')?.nodes).toHaveLength(2)
    expect(strip.total).toBe(5)
  })

  it('the goal is the header, never a row — it is a binary, not a set', () => {
    const strip = buildModelStrip([
      node('g1', 'goal', 'Replace CDP within budget'),
      node('o1', 'option', 'Adopt Segment'),
    ])
    expect(strip.goalLabel).toBe('Replace CDP within budget')
    expect(strip.rows.map((r) => r.kind)).not.toContain('goal')
  })

  it('falls back to the decision node when no goal node names the question', () => {
    const strip = buildModelStrip([
      node('d1', 'decision', 'Replace the customer data platform'),
      node('o1', 'option', 'Adopt Segment'),
    ])
    expect(strip.goalLabel).toBe('Replace the customer data platform')
  })

  /**
   * ⚠ An empty row is a CLAIM. "Risks 0" reads as "your model has no risks",
   * which is a finding; the truth is only that the kind is absent from the
   * canvas. Other surfaces on this panel exist to say what is missing.
   */
  it('drops kinds that are absent rather than rendering them at zero', () => {
    const strip = buildModelStrip([node('o1', 'option', 'Adopt Segment')])
    expect(strip.rows).toHaveLength(1)
    expect(strip.rows[0].kind).toBe('option')
  })

  it('an unrecognised node type is skipped, not guessed at', () => {
    const strip = buildModelStrip([node('x1', 'sticky-note', 'A note'), node('o1', 'option')])
    expect(strip.total).toBe(1)
  })

  it('a label that is merely the id is treated as no label, never leaked', () => {
    const strip = buildModelStrip([node('f_budget', 'factor', 'f_budget')])
    expect(strip.rows[0].nodes[0].label).toBe('')
  })
})

describe('the density threshold', () => {
  const factors = (n: number) =>
    Array.from({ length: n }, (_, i) => node(`f${i}`, 'factor', `Factor ${i}`))

  it('stays as individual marks at the cap', () => {
    const strip = buildModelStrip(factors(MARK_CAP))
    expect(strip.rows[0].overCap).toBe(false)
  })

  /**
   * ⚠ THIS CASE WAS NAMED "switches to a bar one past the cap" AND THE BAR IS
   * THE ONE THING THIS SURFACE MUST NEVER RENDER — it reads as a proportion of
   * a denominator nobody measured, and it was rejected in review. The code has
   * never drawn one; the name and its comment were the last places still
   * describing it, in the file a builder reads to learn what `overCap` means.
   * Renamed to what the flag actually does. See the note on `MARK_CAP`.
   */
  it('flags the row for capped display one past the cap, and keeps the exact count', () => {
    const strip = buildModelStrip(factors(MARK_CAP + 1))
    expect(strip.rows[0].overCap).toBe(true)
    // Every node survives the flag: the renderer draws the first `MARK_CAP` and
    // states how many it is withholding, so the count must stay complete.
    expect(strip.rows[0].nodes).toHaveLength(MARK_CAP + 1)
  })

  it('a realistic large model does not lose nodes', () => {
    const strip = buildModelStrip(factors(40))
    expect(strip.rows[0].nodes).toHaveLength(40)
    expect(strip.total).toBe(40)
  })
})

describe('⭐ the strip makes no provenance claim, and cannot grow one silently', () => {
  /**
   * The design draws these marks filled-or-hollow to say which inputs are the
   * user's and which are Olumi's. That distinction is NOT AVAILABLE:
   * `provenance_class` returns zero files in this repo, CEE can send an
   * intervention as a bare number carrying no source, and PLoT stamps
   * unrecognised values as `user_specified` (PR #353, open) — the strongest
   * claim of human authorship on a value Olumi invented.
   *
   * So the row model carries `id`, `label` and `needsCheck` — and nothing
   * else. If a later change adds a provenance-ish field here, this test REDs
   * and whoever added it has to come and read the paragraph above before
   * shipping a fill.
   *
   * ⚠⚠ `needsCheck` WAS ADDED DELIBERATELY, PAST THIS TRIPWIRE, AND IT IS NOT
   * A PROVENANCE FIELD. The tripwire fired, which is what it is for; this is
   * the reading it demanded. `needsCheck` is `factorIsConfirmable` — "there is
   * a number here and nobody has confirmed it" — which does NOT partition
   * nodes by who authored them, and the pair below proves that by execution
   * rather than by assertion: a value the USER confirmed and a value extracted
   * from the brief land on the SAME side of it, and a producer-stamped value
   * and a value with no source at all land together on the other. A provenance
   * fill would separate exactly the pairs this field joins.
   */
  it('a strip node exposes an identity, a name and the verify state — no source or fill', () => {
    const strip = buildModelStrip([node('f1', 'factor', 'Annual cost')])
    expect(Object.keys(strip.rows[0].nodes[0]).sort()).toEqual(['id', 'label', 'needsCheck'])
  })

  it('every node of a kind is indistinguishable from every other', () => {
    const strip = buildModelStrip([
      node('f1', 'factor', 'Set by the user'),
      node('f2', 'factor', 'Invented by Olumi'),
    ])
    const [a, b] = strip.rows[0].nodes
    // Same shape, same fields — the only difference is identity and name.
    expect(Object.keys(a)).toEqual(Object.keys(b))
  })

  /**
   * ⭐ THE DISCRIMINATION THAT PROVES `needsCheck` IS NOT AUTHORSHIP.
   *
   * ⚠ AND IT PINS A KNOWN LENIENCY RATHER THAN HIDING IT. `brief_extraction`
   * is Olumi's reading of the user's own words, and `factorNeedsVerification`
   * — the canonical predicate, owned by `canvas/domain/valueProvenance.ts` —
   * treats ANY source other than absent-or-`cee_inference` as no longer
   * needing a check. So the worklist this strip offers is a FLOOR, not a
   * total: it can under-count, never over-claim. That is deliberate, because
   * the alternative is a second, disagreeing count of one question
   * (CLAUDE.md trap 12) — the Model tab's live "N to verify" is this same
   * predicate. If this case REDs because the owner TIGHTENED the predicate,
   * that is an improvement and this expectation should follow it.
   */
  it('does not partition by author — a confirmed value and a brief-extracted one agree', () => {
    const strip = buildModelStrip([
      { id: 'f1', type: 'factor', data: {
        label: 'Confirmed by a person',
        observed_state: { value: 0.6, source: 'user_confirmed' },
      } },
      { id: 'f2', type: 'factor', data: {
        label: 'Extracted from the brief by Olumi',
        observed_state: { value: 0.6, source: 'brief_extraction' },
      } },
      { id: 'f3', type: 'factor', data: {
        label: 'Invented by the producer',
        observed_state: { value: 0.6, source: 'cee_inference' },
      } },
      { id: 'f4', type: 'factor', data: {
        label: 'A number from nowhere',
        observed_state: { value: 0.6 },
      } },
    ])
    const byId = new Map(strip.rows[0].nodes.map((n) => [n.id, n.needsCheck]))
    // Different authors, same answer — on BOTH sides.
    expect(byId.get('f1')).toBe(false)
    expect(byId.get('f2')).toBe(false)
    expect(byId.get('f3')).toBe(true)
    expect(byId.get('f4')).toBe(true)
    expect(strip.needsCheckTotal).toBe(2)
  })
})

describe('⭐ the verify count is the PRODUCT’s count, not a second one', () => {
  /**
   * ⭐⭐ A DERIVED UNION ASSERTION, NOT A COPIED EXPECTATION. `needsCheckTotal`
   * and `countFactorsToVerify` must agree over the same graph BY CONSTRUCTION
   * — same predicate, same domain — and this asserts it against the product's
   * own function rather than against a number written here. A guard that
   * hard-coded "2" would keep passing while the two surfaces drifted apart,
   * which is exactly the mirror this estate pays for (CLAUDE.md trap 12).
   *
   * ⚠ AND IT IS NOT VACUOUS: the graph below is built so the naive readings
   * DISAGREE with the right one — 5 factors, 4 with an observed state, 3 with
   * a number, and only 2 the write authority would accept a confirmation for.
   */
  const MIXED = [
    { id: 'g1', type: 'goal', data: { label: 'A goal' } },
    { id: 'o1', type: 'option', data: { label: 'An option' } },
    { id: 'f1', type: 'factor', data: {
      label: 'Producer estimate', observed_state: { value: 0.7, source: 'cee_inference' } } },
    { id: 'f2', type: 'factor', data: {
      label: 'Number, no source', observed_state: { value: 0.4 } } },
    { id: 'f3', type: 'factor', data: {
      label: 'Confirmed', observed_state: { value: 0.9, source: 'user_confirmed' } } },
    { id: 'f4', type: 'factor', data: {
      label: 'Source, nothing to ratify', observed_state: { source: 'cee_inference' } } },
    { id: 'f5', type: 'factor', data: { label: 'Nothing at all' } },
  ]

  it('agrees with `countFactorsToVerify` over the same graph', () => {
    const strip = buildModelStrip(MIXED)
    const factorNodes = MIXED.filter((n) => n.type === 'factor')
    expect(strip.needsCheckTotal).toBe(countFactorsToVerify(factorNodes))
    // Non-vacuity: the naive readings would be 5, 4 and 3 respectively.
    expect(factorNodes).toHaveLength(5)
    expect(strip.needsCheckTotal).toBe(2)
  })

  /**
   * ⭐ THE DOMAIN GUARD, AND IT IS THE ONE THAT KEEPS THE TWO COUNTS EQUAL.
   * `factorIsConfirmable` is about an `observed_state` a factor carries; an
   * option does not have one to confirm. A strip that applied it to every kind
   * would print a number the Model tab's badge disagrees with for the same
   * model — and would be asserting confirmability of a thing with nothing to
   * confirm (the review doctrine's "audit the predicate's DOMAIN").
   */
  it('an OPTION carrying an unconfirmed number is still not counted', () => {
    const strip = buildModelStrip([
      { id: 'o1', type: 'option', data: {
        label: 'An option wearing a factor’s clothes',
        observed_state: { value: 0.7, source: 'cee_inference' },
      } },
      { id: 'f1', type: 'factor', data: {
        label: 'A real factor', observed_state: { value: 0.7, source: 'cee_inference' } } },
    ])
    expect(strip.needsCheckTotal).toBe(1)
    expect(strip.rows.find((r) => r.kind === 'option')!.nodes[0].needsCheck).toBe(false)
    expect(strip.rows.find((r) => r.kind === 'factor')!.nodes[0].needsCheck).toBe(true)
  })
})
