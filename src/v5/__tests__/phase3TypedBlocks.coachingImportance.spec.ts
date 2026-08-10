/**
 * PR3 — `adaptTypedCoachingBlock` carries the IMPORTANCE / EVIDENCE channel.
 *
 * THE DEFECT THIS PINS. The adapter is an implicit hand-maintained allowlist:
 * a field reaches the chat card only if some line names it. Five producer
 * fields that have been on the wire since 0.19.0 / 0.20.0 / 0.39.0 —
 * `category`, `priority`, `signal_code`, `signal`, `dsk_claim_provenance` —
 * were never named, so they arrived intact at the adapter (the parser sidecar
 * preserves the raw object by reference) and were dropped one hop before the
 * only surface a user reads first. The very same fields already reach the
 * guidance store through `deriveGuidance`, which is why the strip, the
 * inspector and the Strengthen panel could rank and ground the item while the
 * card could not.
 *
 * THE CONTRACT SEMANTICS EACH ASSERTION ENCODES (schemas 0.39.0, derived from
 * the vendored tarball, NOT from this lane's reading of what a field ought to
 * mean — trap 13c):
 *   - `category`: the four-value producer class, and the ONLY producer-owned
 *     severity signal on a coaching block. Drives a visual channel, so it is
 *     enum-checked and an unrecognised value yields ABSENCE, never a default.
 *   - `priority`: COARSE 0–100, HIGHER = more urgent. A real number where 0
 *     is meaningful — so the carry must not use truthiness.
 *   - `signal_code`: OPEN vocabulary, producer-owned. Never enum-checked,
 *     because a closed list here would be a mirror of a registry this repo
 *     does not own.
 *   - `signal`: producer prose, carried verbatim.
 *   - `dsk_claim_provenance`: an ATOMIC STRICT TRIPLE. All three members or
 *     none — an id must never travel without the title and strength that make
 *     it verifiable against the bundle. `claim_id` is narrowed to the CLAIM
 *     arms (B | T) so a protocol or trigger id cannot masquerade as a claim.
 *
 * THE STANDING RULE ALL OF IT SERVES: a refusal costs the ATTRIBUTION only,
 * never the card. Losing a badge is a lost affordance; showing a wrong one is
 * a lie about science.
 */
import { describe, it, expect } from 'vitest'
import { adaptTypedCoachingBlock } from '../phase3TypedBlocks'
import { CoachingBlockSchema } from '@talchain/schemas/boundary'

/** A minimal payload the adapter already accepted before PR3. */
const BASE = {
  type: 'coaching',
  block_id: '7e0855c7-d79d-5d16-9fee-19e68ece297d',
  title: 'An assumption to check',
  body: 'The relationship between leadership capacity and throughput remains stable.',
  coaching_kind: 'assumption_check',
  source: 'decision_review',
  target_refs: [],
  priority_rank: 120,
  freshness: 'fresh',
} as const

const CLAIM = {
  claim_id: 'DSK-B-003',
  claim_title: 'Anchoring on an initial estimate narrows later revisions',
  evidence_strength: 'strong',
  protocol_id: 'DSK-P-002',
} as const

describe('adaptTypedCoachingBlock — importance / evidence carry (PR3)', () => {
  it('carries all five producer signals when the producer sent them', () => {
    const out = adaptTypedCoachingBlock({
      ...BASE,
      category: 'must_fix',
      priority: 90,
      signal_code: 'MISSING_BASE_RATE',
      signal: 'Two options share one base-rate assumption.',
      dsk_claim_provenance: CLAIM,
    })
    expect(out).not.toBeNull()
    expect(out?.category).toBe('must_fix')
    expect(out?.priority).toBe(90)
    expect(out?.signal_code).toBe('MISSING_BASE_RATE')
    expect(out?.signal).toBe('Two options share one base-rate assumption.')
    expect(out?.dsk_claim_provenance).toEqual(CLAIM)
  })

  it('omits every one of them when the producer sent none — and still adapts the card', () => {
    const out = adaptTypedCoachingBlock(BASE)
    // The POSITIVE outcome first, so a null return cannot pass this test.
    expect(out?.title).toBe(BASE.title)
    expect(out).not.toHaveProperty('category')
    expect(out).not.toHaveProperty('priority')
    expect(out).not.toHaveProperty('signal_code')
    expect(out).not.toHaveProperty('signal')
    expect(out).not.toHaveProperty('dsk_claim_provenance')
  })

  it('keeps priority 0 — the least-urgent band is a value, not an absence', () => {
    // A truthiness carry (`priority ? {priority} : {}`) drops this silently.
    const out = adaptTypedCoachingBlock({ ...BASE, priority: 0 })
    expect(out?.priority).toBe(0)
  })

  it.each([[-1], [101], [Number.NaN]])(
    'refuses an out-of-contract priority (%s) without costing the card',
    (priority) => {
      const out = adaptTypedCoachingBlock({ ...BASE, priority })
      expect(out?.title).toBe(BASE.title)
      expect(out).not.toHaveProperty('priority')
    },
  )

  it('refuses an unrecognised category rather than defaulting to a tier', () => {
    const out = adaptTypedCoachingBlock({ ...BASE, category: 'blocker' })
    expect(out?.title).toBe(BASE.title)
    expect(out).not.toHaveProperty('category')
  })

  it('does NOT enum-check signal_code — the vocabulary is producer-owned', () => {
    const out = adaptTypedCoachingBlock({ ...BASE, signal_code: 'A_BRAND_NEW_DETECTOR' })
    expect(out?.signal_code).toBe('A_BRAND_NEW_DETECTOR')
  })

  describe('the DSK claim triple is atomic', () => {
    it.each([
      ['claim_title missing', { claim_id: 'DSK-B-003', evidence_strength: 'strong' }],
      ['evidence_strength missing', { claim_id: 'DSK-B-003', claim_title: 'A claim' }],
      ['claim_id missing', { claim_title: 'A claim', evidence_strength: 'strong' }],
      [
        'evidence_strength off-contract',
        { claim_id: 'DSK-B-003', claim_title: 'A claim', evidence_strength: 'very strong' },
      ],
      [
        'a PROTOCOL id masquerading as a claim',
        { claim_id: 'DSK-P-002', claim_title: 'A claim', evidence_strength: 'strong' },
      ],
      [
        'a TRIGGER id masquerading as a claim',
        { claim_id: 'DSK-TR-001', claim_title: 'A claim', evidence_strength: 'strong' },
      ],
    ])('refuses the whole triple when %s — and never costs the card', (_label, provenance) => {
      const out = adaptTypedCoachingBlock({ ...BASE, dsk_claim_provenance: provenance })
      expect(out?.title).toBe(BASE.title)
      expect(out).not.toHaveProperty('dsk_claim_provenance')
    })

    it('accepts a valid triple without the optional protocol_id', () => {
      const withoutProtocol = {
        claim_id: CLAIM.claim_id,
        claim_title: CLAIM.claim_title,
        evidence_strength: CLAIM.evidence_strength,
      }
      const out = adaptTypedCoachingBlock({ ...BASE, dsk_claim_provenance: withoutProtocol })
      expect(out?.dsk_claim_provenance).toEqual(withoutProtocol)
      expect(out?.dsk_claim_provenance).not.toHaveProperty('protocol_id')
    })

    it('drops a malformed protocol_id without costing the claim anchor', () => {
      const out = adaptTypedCoachingBlock({
        ...BASE,
        dsk_claim_provenance: { ...CLAIM, protocol_id: 'DSK-B-003' },
      })
      expect(out?.dsk_claim_provenance?.claim_id).toBe('DSK-B-003')
      expect(out?.dsk_claim_provenance).not.toHaveProperty('protocol_id')
    })
  })

  /**
   * THE COMPLETENESS CHECK THE DERIVED GUARDS CANNOT DO (trap 12d).
   *
   * Every assertion above is derived from this lane's own fixtures, so all of
   * them agree with each other and NONE can notice that the adapter's
   * category list is SHORT. This one asserts against the CONTRACT ITSELF: the
   * vendored `CoachingBlockSchema` is the authority for which category values
   * exist, and a widening there must RED here rather than silently arriving as
   * an unbadged card.
   */
  it('accepts EVERY category the vendored contract declares — no short list', () => {
    const shape = CoachingBlockSchema.shape as Record<string, { unwrap?: () => unknown }>
    const categoryField = shape.category
    // Positive control: the probe must actually find the field. An absence
    // probe that cannot see a presence proves nothing (trap 13).
    expect(categoryField).toBeDefined()
    const inner = categoryField.unwrap?.() as { options?: readonly string[] } | undefined
    const declared = inner?.options
    expect(Array.isArray(declared)).toBe(true)
    expect(declared!.length).toBeGreaterThan(0)

    for (const value of declared!) {
      const out = adaptTypedCoachingBlock({ ...BASE, category: value })
      expect(
        out?.category,
        `contract declares category "${value}" but the adapter dropped it`,
      ).toBe(value)
    }
  })
})
