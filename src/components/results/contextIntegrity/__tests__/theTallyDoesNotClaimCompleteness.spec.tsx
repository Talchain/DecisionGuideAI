/**
 * ROADMAP 2.1000 — THE FIGURE TALLY MAY NOT CLAIM COMPLETENESS OVER A
 * POPULATION IT CANNOT ENUMERATE.
 *
 * ── THE WITNESSED DEFECT ───────────────────────────────────────────────────
 * The Reasoning tab's "What you gave me, and what I did with it" rendered, in
 * its COLLAPSED state:
 *
 *     "All 5 figures you mentioned are in the model"
 *
 * "All" asserts completeness, and "you mentioned" says the set it is complete
 * over is the set of figures the USER WROTE. The panel does not know that set.
 * `quantities.total` is the number of figures CEE's extractor FOUND in
 * `brief_text`, which is a LOWER BOUND on what the user wrote. State six
 * figures, have five found, and the panel issues an all-clear over five while
 * one is silently missing.
 *
 * ── THE EXTRACTOR GAP, MEASURED ON REAL DEPLOYED BYTES ─────────────────────
 * Not assumed, and not taken from another lane's report. `b1`'s `brief_text` is
 * real deployed bytes (context-integrity trace 2026-08-08, CEE build 4b57b8f)
 * and its manifest is the deterministic output of CEE's own derivation over
 * exactly those bytes. The first case below walks the brief and finds the
 * number tokens NO item span covers. Three of them, and two are inside the
 * extractor's OWN declared search scope:
 *
 *     "2027"  in "So: Germany in 2027, or UK depth?"        a calendar date
 *     "9"     in "BaFin licensing will take 9 to 14 months"  a count + unit word
 *     "2025"  in "that's from the 2025 Gartner regtech sizing"
 *
 * `scope.searched` in that same manifest reads "money, percentages, counts with
 * a unit word, calendar dates and fiscal periods". So the gap is not exotic: a
 * range writes its low end without repeating the unit, and a bare year is a
 * date. The reconciliation seat's `4.20 pounds` is the same class.
 *
 * ── WHY A GUARD AND NOT JUST AN EDIT ───────────────────────────────────────
 * Nine arms share one noun phrase. An edit fixes today's nine and the tenth arm
 * written into that file reintroduces the claim with no red anywhere, which is
 * the hand-maintained mirror this estate keeps paying for (CLAUDE.md trap 12).
 * The domain-wide property lives in `figureTallySubtitle.spec.ts`, which walks
 * every cell; what lives HERE is the surface binding, on the real store, on the
 * literal rendered sentence.
 *
 * ── WHAT THIS FILE DELIBERATELY DOES NOT CLAIM ─────────────────────────────
 * It does not claim the extractor is now complete, and the repair does not
 * widen it. A wider regex is still not proof of completeness; it moves the
 * boundary and leaves the CLAIM TYPE untouched. What is fixed is the claim: the
 * sentence now quantifies over the set the panel can enumerate, which is also
 * the set it lists when opened.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

import { WhatIWasGivenSection } from '../WhatIWasGivenSection'
import { useCanvasStore } from '@/canvas/store'
import { useContextIntegrityStore } from '@/canvas/stores/contextIntegrityStore'
import { parseNotModelled } from '@/adapters/cee/notModelled'

import b1Fixture from './fixtures/b1-cold-read.not-modelled.json'

vi.mock('../../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusExistingTarget: vi.fn(),
  focusModelTarget: vi.fn(() => true),
}))

const LIVE_SCENARIO_ID = '11111111-1111-4111-8111-111111111111'

/**
 * A second-person attribution of the FIGURE POPULATION. `your brief` is not one
 * of these and must not be: the repair keeps the brief as the source and moves
 * only who did the counting.
 */
const USER_ATTRIBUTION = /\byou (?:mentioned|gave|wrote|said|told|listed)\b/i

/** The panel's own claim about who found the figures it is counting. */
const PANEL_ATTRIBUTION = 'I found in your brief'

/** Every number token in a brief, with its span. */
function numberSpans(brief: string): { token: string; start: number; end: number }[] {
  return [...brief.matchAll(/\d+(?:\.\d+)?/g)].map(m => {
    const start = m.index ?? 0
    return { token: m[0], start, end: start + m[0].length }
  })
}

/**
 * The number tokens no extracted item covers.
 *
 * By SPAN, not by string. A token test would score the `9` of "9 to 14 months"
 * as seen, because `9%` is extracted elsewhere in the same brief — a matcher
 * agreeing with itself on a different figure (CLAUDE.md trap 19: bind by
 * identity, never by a value another object satisfies).
 */
function uncoveredTokens(
  brief: string,
  items: readonly { literal: string; charOffset: number }[],
): string[] {
  const spans = items.map(i => [i.charOffset, i.charOffset + i.literal.length] as const)
  return numberSpans(brief)
    .filter(n => !spans.some(([s, e]) => !(n.end <= s || n.start >= e)))
    .map(n => n.token)
}

const b1 = b1Fixture as unknown as { brief_text: string; not_modelled: unknown }

function seed(briefText: string, notModelled: unknown): void {
  useContextIntegrityStore.getState().setContextIntegrity({
    scenarioId: LIVE_SCENARIO_ID,
    briefText,
    manifest: parseNotModelled(notModelled),
  })
}

/** A `derived` manifest through the REAL boundary parser, never hand-built. */
function derivedOver(
  items: { literal: string; kind: string; char_offset: number; verdict: string }[],
): unknown {
  return {
    schema: 'not_modelled.v1',
    status: 'derived',
    unavailable_reason: null,
    quantities: {
      total: items.length,
      in_model: items.filter(i => i.verdict === 'in_model').length,
      prose_only: items.filter(i => i.verdict === 'prose_only').length,
      absent: items.filter(i => i.verdict === 'absent').length,
      truncated: false,
      items: items.map(i => ({ ...i, matched_node_id: null })),
    },
    declared_exclusions: { status: 'none_reported', items: [] },
    inferred_factors: { status: 'not_recorded', items: [] },
    not_tracked: [],
  }
}

const subtitle = (): string => {
  render(<WhatIWasGivenSection />)
  return screen.getByTestId('what-i-was-given-summary').textContent ?? ''
}

beforeEach(() => {
  useContextIntegrityStore.getState().reset()
  useCanvasStore.setState({ currentScenarioId: LIVE_SCENARIO_ID } as never)
})
afterEach(() => {
  useContextIntegrityStore.getState().reset()
  useCanvasStore.setState({ currentScenarioId: null } as never)
  cleanup()
})

describe('THE PREMISE — the extractor does not see every figure a user writes', () => {
  it('MEASURED on the real b1 capture: three number tokens no item span covers', () => {
    const manifest = parseNotModelled(b1.not_modelled)
    expect(manifest?.status, 'the real parser must accept this capture').toBe('derived')
    const items = manifest!.quantities!.items

    // ⭐ CONTRAST CONTROL, in the same sweep. An absence claim is worth nothing
    // until the probe is shown detecting a presence, and a plausible-looking
    // count from a blind probe is the failure mode (CLAUDE.md trap 13e). These
    // ARE covered, by the same span arithmetic that reports the misses.
    const covered = numberSpans(b1.brief_text).filter(n =>
      items.some(i => !(n.end <= i.charOffset || n.start >= i.charOffset + i.literal.length)),
    )
    expect(covered.length, 'the span probe sees nothing at all').toBeGreaterThan(20)

    // ⚠ The offsets must actually align, or "uncovered" measures a shifted
    // ruler rather than a gap.
    for (const i of items) {
      expect(b1.brief_text.slice(i.charOffset, i.charOffset + i.literal.length)).toBe(i.literal)
    }

    expect(uncoveredTokens(b1.brief_text, items)).toEqual(['2025', '9', '2027'])
  })

  it('two of the three are INSIDE the extractor’s own declared search scope', () => {
    // The manifest declares it searched "calendar dates and fiscal periods" and
    // "counts with a unit word". It recorded `FY28` and `14 months` and missed
    // the year in "Germany in 2027" and the low end of "9 to 14 months".
    expect(b1.brief_text).toContain('Germany in 2027')
    expect(b1.brief_text).toContain('take 9 to 14 months')
    const literals = parseNotModelled(b1.not_modelled)!.quantities!.items.map(i => i.literal)
    expect(literals).toContain('14 months')
    expect(literals).not.toContain('9 to 14 months')
    expect(literals).not.toContain('2027')
  })
})

describe('THE DEFECT — an all-clear may not be issued over the user’s own words', () => {
  /**
   * ⭐ THE LOAD-BEARING CASE. A brief stating four figures, of which the
   * extractor finds three, all of them modelled. Every figure it found landed,
   * so the all-clear arm fires — and at pristine it fired as
   * "All 3 figures you mentioned are in the model", which is a false assurance
   * about the fourth.
   */
  const BRIEF = 'We hold unit cost at 4.20 pounds, with £4m of runway and 12 months to FY28.'
  const FOUND = [
    { literal: '£4m', kind: 'money', char_offset: BRIEF.indexOf('£4m'), verdict: 'in_model' },
    { literal: '12 months', kind: 'count', char_offset: BRIEF.indexOf('12 months'), verdict: 'in_model' },
    { literal: 'FY28', kind: 'period', char_offset: BRIEF.indexOf('FY28'), verdict: 'in_model' },
  ]

  it('PRECONDITION: the brief really states a figure the manifest does not carry', () => {
    // Stated in the fixture, measured here. Without this the case below could
    // pass over a brief with nothing missing, and would be asserting the copy
    // of a state it never reached.
    expect(BRIEF).toContain('4.20 pounds')
    expect(FOUND.map(f => f.literal)).not.toContain('4.20 pounds')
    expect(uncoveredTokens(BRIEF, FOUND.map(f => ({ literal: f.literal, charOffset: f.char_offset })))).toEqual(['4.20'])
    // And the arm under test really is the all-clear one.
    const q = parseNotModelled(derivedOver(FOUND))!.quantities!
    expect(q.total).toBe(3)
    expect(q.inModel).toBe(3)
  })

  it('THE FIX: the sentence does not attribute its count to what the user wrote', () => {
    seed(BRIEF, derivedOver(FOUND))
    expect(subtitle()).not.toMatch(USER_ATTRIBUTION)
  })

  it('THE FIX: the sentence attributes the count to what the panel found', () => {
    seed(BRIEF, derivedOver(FOUND))
    expect(subtitle()).toContain(PANEL_ATTRIBUTION)
  })

  it('THE FIX: the literal rendered sentence, on the real store', () => {
    // ⚠ The LITERAL sentence a user reads, taken off the rendered node. An
    // assertion against the module's return value would pass on a component
    // that stopped rendering it.
    seed(BRIEF, derivedOver(FOUND))
    expect(subtitle()).toBe('All 3 figures I found in your brief are in the model')
  })
})

describe('THE OPPOSITE-DIRECTION TWIN — the fix may not buy truth with vagueness', () => {
  /**
   * ⭐⭐ MANDATORY, and it is the mirror defect: a sentence made true by saying
   * nothing. When the extractor DID see everything, the reassuring state is
   * genuinely reassuring and the copy must still carry the count, the
   * quantifier and the verdict. A hedge here would pass every assertion in the
   * describe above.
   */
  const BRIEF = 'We have £3.1m cash and marketing is capped at £1.5m.'
  const FOUND = [
    { literal: '£3.1m', kind: 'money', char_offset: BRIEF.indexOf('£3.1m'), verdict: 'in_model' },
    { literal: '£1.5m', kind: 'money', char_offset: BRIEF.indexOf('£1.5m'), verdict: 'in_model' },
  ]

  it('PRECONDITION: on THIS brief the extractor missed nothing', () => {
    // The twin is only a twin if its premise is the opposite one. Measured with
    // the same instrument as the defect case, so the two cannot drift apart.
    expect(uncoveredTokens(BRIEF, FOUND.map(f => ({ literal: f.literal, charOffset: f.char_offset })))).toEqual([])
  })

  it('the count survives', () => {
    seed(BRIEF, derivedOver(FOUND))
    const s = subtitle()
    expect(/\d/.test(s), `the reassuring state stopped reporting a number: "${s}"`).toBe(true)
    expect(s).toContain('2 figures')
  })

  it('the all-clear survives, and stays positive', () => {
    seed(BRIEF, derivedOver(FOUND))
    const s = subtitle()
    expect(s.startsWith('All '), `the all-clear was hedged away: "${s}"`).toBe(true)
    expect(s).toContain('are in the model')
    expect(s).not.toContain("aren't")
  })

  it('the literal rendered sentence', () => {
    seed(BRIEF, derivedOver(FOUND))
    expect(subtitle()).toBe('All 2 figures I found in your brief are in the model')
  })

  it('a shortfall is still reported as a shortfall, not softened into the all-clear', () => {
    // The other direction of the same mirror: re-scoping the population must
    // not have made every state sound fine.
    const items = [
      { ...FOUND[0] },
      { ...FOUND[1], verdict: 'absent' },
    ]
    seed(BRIEF, derivedOver(items))
    const s = subtitle()
    expect(s).toBe("1 of 2 figures I found in your brief isn't in the model yet")
    expect(s.startsWith('All ')).toBe(false)
  })
})

describe('the instrument itself', () => {
  it('POSITIVE CONTROL: both attribution probes fire on the sentence that shipped', () => {
    // ⭐ The verdicts above are ABSENCE claims about a phrase. They are worth
    // nothing until the probes are shown detecting the PRESENCE they were
    // written to catch, and the presence is the deployed sentence.
    const SHIPPED = 'All 5 figures you mentioned are in the model'
    expect(USER_ATTRIBUTION.test(SHIPPED)).toBe(true)
    expect(SHIPPED.includes(PANEL_ATTRIBUTION)).toBe(false)
  })

  it('PRECISION: the user probe does not fire on "your brief"', () => {
    // ⚠ The repair KEEPS the brief as the source. A matcher that read any
    // second person as the defect would push an author to delete the one
    // grounding phrase in the sentence.
    expect(USER_ATTRIBUTION.test('All 5 figures I found in your brief are in the model')).toBe(false)
  })

  it('the uncovered-token probe discriminates, in both directions', () => {
    // One direction alone shows nothing: a probe returning everything passes
    // the miss case, and one returning nothing passes the complete case.
    const brief = 'Cap is 4.20 pounds against £4m.'
    const seen = [{ literal: '£4m', charOffset: brief.indexOf('£4m') }]
    expect(uncoveredTokens(brief, seen)).toEqual(['4.20'])
    expect(uncoveredTokens(brief, [...seen, { literal: '4.20', charOffset: brief.indexOf('4.20') }])).toEqual([])
  })
})
