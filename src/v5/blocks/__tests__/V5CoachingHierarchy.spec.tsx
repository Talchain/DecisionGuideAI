/**
 * PR3 (living reasoning workspace) — the coaching card learns to say WHAT
 * MATTERS.
 *
 * THE DEFECT THIS PINS. Every coaching card rendered identically: a lightbulb,
 * a title, prose, an optional pill. `coaching_kind`, `source` and `freshness`
 * rode as inert `data-*` attributes with no per-kind treatment, and the five
 * producer-owned signals that carry IMPORTANCE and EVIDENCE — `category`,
 * `priority`, `signal_code`, `signal`, `dsk_claim_provenance` — were dropped
 * by `adaptTypedCoachingBlock` before the card ever saw them. So a user could
 * not tell a must-fix finding from a passing technique note, could not tell an
 * evidence-grounded claim from assistant prose, and was never told when a card
 * pre-dated their latest edit.
 *
 * WHAT THIS SPEC CAN AND CANNOT PROVE — stated up front, because the
 * distinction is the whole reason the estate has shipped hierarchy defects
 * before (trap 3).
 *   CAN (jsdom, structural): that a signal the producer sent is PRESENT in the
 *     DOM, bound to the right object by identity; that a signal the producer
 *     did NOT send is absent AND replaced by an honest sentence rather than a
 *     blank; that the depth layer is collapsed by default; that the display
 *     vocabulary is the shared one and not a private copy.
 *   CANNOT: that the hierarchy is legible. jsdom computes no layout, applies
 *     no Tailwind, and resolves no colour. "must_fix reads as more urgent than
 *     technique", "the disclosure stays out of the way", and every contrast /
 *     size / spacing claim need a real browser and are verified there, not
 *     here. No assertion below should be read as evidence about appearance.
 *
 * BINDING BY IDENTITY (trap 19). Every assertion keys on a testid or an
 * explicit producer string, never on a value predicate another element could
 * satisfy — and every absence assertion is paired with a POSITIVE assertion
 * that the card still rendered its content, so a component that renders
 * nothing at all cannot pass by looking empty.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { V5CoachingBlock } from '../V5CoachingBlock'
import { STRENGTHEN_COPY } from '../../../components/results/strengthen/strengthenCopy'
import type { V5CoachingBlock as V5CoachingBlockType } from '../../../canvas/conversation/types'

const BASE: V5CoachingBlockType = {
  type: 'v5_coaching',
  block_id: '7e0855c7-d79d-5d16-9fee-19e68ece297d',
  title: 'An assumption to check',
  body: 'The relationship between Technical Leadership Capacity and throughput remains stable.',
  coaching_kind: 'assumption_check',
  source: 'decision_review',
  target_refs: [],
  priority_rank: 120,
  freshness: 'fresh',
}

/** A complete, well-formed claim triple — the contract's atomic unit. */
const CLAIM: NonNullable<V5CoachingBlockType['dsk_claim_provenance']> = {
  claim_id: 'DSK-B-003',
  claim_title: 'Anchoring on an initial estimate narrows later revisions',
  evidence_strength: 'strong',
  protocol_id: 'DSK-P-002',
}

describe('V5CoachingBlock — importance channel (PR3)', () => {
  it('renders the producer category as a badge, with the SHARED display copy', () => {
    render(<V5CoachingBlock block={{ ...BASE, category: 'must_fix' }} />)
    const badge = screen.getByTestId('v5-coaching-category')
    // Identity: the badge names the category it was given...
    expect(badge).toHaveAttribute('data-category', 'must_fix')
    // ...and its copy is the SHARED vocabulary, not a private second copy.
    // Asserting against the imported constant (not a literal) is what makes
    // this a derived guard: if the Strengthen panel's wording moves, this
    // card moves with it or REDs (trap 12 — derive, don't mirror).
    expect(badge).toHaveTextContent(STRENGTHEN_COPY.severityLabel.must_fix)
  })

  it.each([
    ['must_fix'],
    ['should_fix'],
    ['could_fix'],
    ['technique'],
  ] as const)('binds the badge to the producer value, not a constant: %s', (cat) => {
    render(<V5CoachingBlock block={{ ...BASE, category: cat }} />)
    const badge = screen.getByTestId('v5-coaching-category')
    expect(badge).toHaveAttribute('data-category', cat)
    expect(badge).toHaveTextContent(STRENGTHEN_COPY.severityLabel[cat])
  })

  it('shows NO category badge when the producer categorised nothing — and still renders the card', () => {
    render(<V5CoachingBlock block={BASE} />)
    // Honest absence: no invented "normal" tier...
    expect(screen.queryByTestId('v5-coaching-category')).toBeNull()
    // ...and the POSITIVE outcome, so an empty render cannot pass this test.
    expect(screen.getByTestId('v5-coaching-title')).toHaveTextContent(BASE.title)
    expect(screen.getByTestId('v5-coaching-body')).toHaveTextContent(BASE.body)
  })

  it('carries the severity tone on the card container so the whole card, not just a pill, reads as urgent', () => {
    const { container: urgent } = render(<V5CoachingBlock block={{ ...BASE, category: 'must_fix' }} />)
    const { container: quiet } = render(<V5CoachingBlock block={{ ...BASE, category: 'technique' }} />)
    // Discriminating pair: the two categories must NOT resolve to the same
    // tone. This is a structural proxy for the visual claim — it proves the
    // component distinguishes them, never that a human sees the difference.
    const urgentTone = urgent.querySelector('[data-testid="v5-coaching"]')?.getAttribute('data-tone')
    const quietTone = quiet.querySelector('[data-testid="v5-coaching"]')?.getAttribute('data-tone')
    expect(urgentTone).toBe('danger')
    expect(quietTone).toBe('info')
    expect(urgentTone).not.toBe(quietTone)
  })

  /**
   * ⚠ THIS TEST EXISTS BECAUSE A REAL BROWSER FOUND WHAT JSDOM COULD NOT.
   *
   * `guidanceCategoryTone` maps FOUR producer categories onto TWO colours, so
   * the first version of this card rendered "Must fix" and "Should fix"
   * IDENTICALLY — same border, same badge, same icon. Every structural test
   * above passed while the most important distinction the producer makes was
   * invisible. The screenshot is what caught it.
   *
   * So this pins the EMPHASIS ladder: all four categories must resolve to
   * DISTINCT badge treatments. It is still a structural proxy — it proves the
   * component emits four different recipes, never that a human perceives four
   * levels. That claim belongs to the browser pass recorded in the PR.
   */
  it('gives all four categories DISTINCT visual weight, in BOTH channels independently', () => {
    const badges: string[] = []
    const cards: string[] = []
    for (const cat of ['must_fix', 'should_fix', 'could_fix', 'technique'] as const) {
      const { container } = render(<V5CoachingBlock block={{ ...BASE, category: cat }} />)
      const badge = container.querySelector('[data-testid="v5-coaching-category"]')
      const card = container.querySelector('[data-testid="v5-coaching"]')
      // Positive control: the probe must find both, or the comparison below
      // is comparing nulls and would agree with itself (trap 13).
      expect(badge, `no badge rendered for ${cat}`).not.toBeNull()
      expect(card, `no card rendered for ${cat}`).not.toBeNull()
      badges.push(badge!.className)
      cards.push(card!.className)
    }
    /**
     * ⚠ EACH CHANNEL IS ASSERTED SEPARATELY, and that is the point. An earlier
     * version compared the CONCATENATION of badge + card class, which two
     * mutants walked straight through: collapsing the must_fix BADGE onto the
     * should_fix recipe still left the card borders differing, so the joined
     * string stayed unique and the suite stayed green. A combined key can only
     * see that the PAIR differs somewhere — never that a given channel still
     * discriminates. Asserting them independently is what makes a collapse in
     * either one RED.
     */
    expect(new Set(badges).size, 'badge treatments collapsed').toBe(4)
    expect(new Set(cards).size, 'card border treatments collapsed').toBe(4)
  })
})

describe('V5CoachingBlock — evidence channel (PR3)', () => {
  it("renders the producer's trigger line verbatim", () => {
    const signal = 'Two of three options share the same base rate assumption.'
    render(<V5CoachingBlock block={{ ...BASE, signal }} />)
    expect(screen.getByTestId('v5-coaching-signal')).toHaveTextContent(signal)
  })

  it('renders NO trigger line when the producer sent none — and still renders the body', () => {
    render(<V5CoachingBlock block={BASE} />)
    expect(screen.queryByTestId('v5-coaching-signal')).toBeNull()
    expect(screen.getByTestId('v5-coaching-body')).toHaveTextContent(BASE.body)
  })

  /**
   * ⚠ THE FIXTURE HERE CARRIES `signal` AS WELL AS `signal_code`, AND THAT IS
   * THE WHOLE TEST. An earlier version set `signal_code` alone; a mutant that
   * appended the code to the trigger line SURVIVED it, because with no
   * `signal` the trigger line never renders and the leak site was never
   * reached. The guard was correct and pointed at bytes that did not exist
   * (trap 22). A card in the wild routinely carries both, so the corpus must.
   */
  it('never renders signal_code as copy — even beside the trigger line it could leak into', () => {
    render(
      <V5CoachingBlock
        block={{
          ...BASE,
          signal: 'Two options share one base-rate assumption.',
          signal_code: 'MISSING_BASE_RATE',
        }}
      />,
    )
    const card = screen.getByTestId('v5-coaching')
    expect(card).toHaveAttribute('data-signal-code', 'MISSING_BASE_RATE')
    // The machine token must not leak into the visible sentence stream...
    expect(card.textContent).not.toContain('MISSING_BASE_RATE')
    // ...while the producer's own prose beside it IS shown, so this cannot
    // pass by rendering nothing at all.
    expect(screen.getByTestId('v5-coaching-signal')).toHaveTextContent(
      'Two options share one base-rate assumption.',
    )
  })

  it('never renders signal_code as copy when there is no trigger line either', () => {
    render(<V5CoachingBlock block={{ ...BASE, signal_code: 'MISSING_BASE_RATE' }} />)
    const card = screen.getByTestId('v5-coaching')
    expect(card).toHaveAttribute('data-signal-code', 'MISSING_BASE_RATE')
    expect(card.textContent).not.toContain('MISSING_BASE_RATE')
    expect(screen.getByTestId('v5-coaching-title')).toHaveTextContent(BASE.title)
  })

  /**
   * The grounding is SPLIT by design: strength on the face (what a reader
   * needs at a glance), the verifiable claim TITLE one row down inside the
   * disclosure. A browser pass showed the full title inline made the card
   * eight rows deep and orphaned the separator mid-wrap. Both halves are
   * asserted — here and in the disclosure block below — so the split cannot
   * quietly become a drop.
   */
  it('grounds the card on its face with the evidence strength and the claim id', () => {
    render(<V5CoachingBlock block={{ ...BASE, dsk_claim_provenance: CLAIM }} />)
    const badge = screen.getByTestId('v5-coaching-dsk-provenance')
    expect(badge).toHaveAttribute('data-dsk-claim-id', 'DSK-B-003')
    expect(badge).toHaveAttribute('data-dsk-evidence-strength', 'strong')
    expect(badge).toHaveAttribute('data-dsk-protocol-id', 'DSK-P-002')
    expect(badge).toHaveTextContent('strong evidence')
  })

  it('binds the strength to the producer value, not a constant', () => {
    render(
      <V5CoachingBlock
        block={{ ...BASE, dsk_claim_provenance: { ...CLAIM, evidence_strength: 'weak' } }}
      />,
    )
    const badge = screen.getByTestId('v5-coaching-dsk-provenance')
    expect(badge).toHaveTextContent('weak evidence')
    expect(badge).not.toHaveTextContent('strong evidence')
  })

  it('says plainly that a card is NOT grounded, rather than leaving a blank', () => {
    render(<V5CoachingBlock block={BASE} />)
    // No badge...
    expect(screen.queryByTestId('v5-coaching-dsk-provenance')).toBeNull()
    // ...but the depth layer states the absence in plain English. A blank is
    // a defect, not a standard.
    const detail = screen.getByTestId('v5-coaching-grounding-detail')
    expect(detail.textContent?.trim().length ?? 0).toBeGreaterThan(0)
    expect(detail).toHaveTextContent(/not linked to a cited decision-science claim/i)
  })
})

describe('V5CoachingBlock — uncertainty channel (PR3)', () => {
  it('tells the reader when the card pre-dates their latest change', () => {
    render(<V5CoachingBlock block={{ ...BASE, freshness: 'stale' }} />)
    const notice = screen.getByTestId('v5-coaching-freshness')
    expect(notice.textContent?.trim().length ?? 0).toBeGreaterThan(0)
    expect(notice).toHaveTextContent(/changed since/i)
  })

  it('stays quiet when the card is fresh — and still renders the card', () => {
    render(<V5CoachingBlock block={BASE} />)
    expect(screen.queryByTestId('v5-coaching-freshness')).toBeNull()
    expect(screen.getByTestId('v5-coaching-title')).toHaveTextContent(BASE.title)
  })

  it.each([
    ['stale', /changed since/i],
    ['pending', /still being written/i],
    ['failed', /could not be generated/i],
  ] as const)('gives %s its own honest sentence', (fresh, pattern) => {
    render(<V5CoachingBlock block={{ ...BASE, freshness: fresh }} />)
    expect(screen.getByTestId('v5-coaching-freshness')).toHaveTextContent(pattern)
  })
})

describe('V5CoachingBlock — progressive disclosure (PR3)', () => {
  it('keeps the depth layer COLLAPSED by default', () => {
    render(<V5CoachingBlock block={{ ...BASE, dsk_claim_provenance: CLAIM }} />)
    const details = screen.getByTestId('v5-coaching-details')
    expect(details.tagName).toBe('DETAILS')
    // `open` absent = collapsed. Asserting the attribute (not visibility)
    // because jsdom cannot prove visibility — see the header.
    expect(details).not.toHaveAttribute('open')
  })

  it('puts the depth INSIDE the disclosure: claim title, kind and origin in plain English', () => {
    render(<V5CoachingBlock block={{ ...BASE, dsk_claim_provenance: CLAIM }} />)
    const details = screen.getByTestId('v5-coaching-details')
    expect(details).toHaveTextContent(CLAIM.claim_title)
    // `coaching_kind` and `source` are machine tokens; the disclosure states
    // them as sentences, and must never print the raw snake_case token.
    expect(details).toHaveTextContent(/assumption/i)
    expect(details).toHaveTextContent(/decision review/i)
    expect(details.textContent).not.toContain('assumption_check')
    expect(details.textContent).not.toContain('decision_review')
  })

  it('omits an unrecognised kind or source rather than printing a raw token', () => {
    render(
      <V5CoachingBlock
        block={{ ...BASE, coaching_kind: 'brand_new_kind', source: 'brand_new_source' }}
      />,
    )
    const details = screen.getByTestId('v5-coaching-details')
    expect(details.textContent).not.toContain('brand_new_kind')
    expect(details.textContent).not.toContain('brand_new_source')
    // Fail-closed must not mean empty: the grounding sentence is always there.
    expect(screen.getByTestId('v5-coaching-grounding-detail')).toHaveTextContent(
      /not linked to a cited decision-science claim/i,
    )
  })
})

describe('V5CoachingBlock — the bias_signal variant keeps every signal', () => {
  it('renders the same importance and evidence channels under the bias testid prefix', () => {
    render(
      <V5CoachingBlock
        variant="bias_signal"
        block={{
          ...BASE,
          coaching_kind: 'bias_signal',
          category: 'must_fix',
          signal: 'Your brief anchors on the first figure you wrote.',
          dsk_claim_provenance: CLAIM,
        }}
      />,
    )
    // The C10+R1 fold exists so producer fields can never drop on one fork.
    // This pins the new fields to that same guarantee.
    expect(screen.getByTestId('bias-signal-card-category')).toHaveAttribute('data-category', 'must_fix')
    expect(screen.getByTestId('bias-signal-card-signal')).toHaveTextContent(
      'Your brief anchors on the first figure you wrote.',
    )
    expect(screen.getByTestId('bias-signal-card-dsk-provenance')).toHaveTextContent('strong evidence')
    expect(screen.getByTestId('bias-signal-card-details')).toHaveTextContent(CLAIM.claim_title)
  })
})
