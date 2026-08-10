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
  /**
   * ⭐ THE FAIL-LOUD GUARD — the one that would have caught this whole lane.
   *
   * The enum check below catches a WIDENED ENUM. It does not catch the defect
   * that produced this work: a NEW FIELD arriving on the contract and being
   * dropped in silence. Five fields sat on the wire from 0.19.0 / 0.20.0 while
   * the surface a user reads first threw them away, and NOTHING anywhere went
   * red — because `adaptTypedCoachingBlock` is an implicit allowlist and an
   * unread key is indistinguishable from a key nobody has heard of.
   *
   * So: every key the contract declares must be either CARRIED or EXPLICITLY
   * IGNORED WITH A STATED REASON. A new field satisfies neither and REDs until
   * a human decides which it is. Note what this deliberately is NOT — it is not
   * a list of fields to carry (that is the mirror we are escaping). The carried
   * set is DERIVED BY EXECUTING THE ADAPTER; only the ignore set is
   * hand-written, and each entry is a decision record a reviewer can audit
   * rather than a bare name.
   */
  const DELIBERATELY_NOT_CARRIED: Readonly<Record<string, string>> = {
    signal_id:
      'Per-instance DEDUPE identity, not render-relevant. The card shows no id, ' +
      'and a real producer block must never be suppressed over metadata the UI never displays.',
    created_at:
      'Wire timestamp. The card states RECENCY through `freshness` (a producer ' +
      'verdict), never through a raw date the user would have to interpret.',
    source_handler:
      'CEE-internal handler name. A machine token with no user-facing meaning; ' +
      'rendering it would leak pipeline vocabulary into the product.',
    graph_hash_at_generation:
      'Opaque analysis-identity hash used upstream for invalidation. `freshness` ' +
      'is the consumer-facing derivative of it, and is what the card renders.',
  }

  /**
   * The comparison, extracted as a pure function so its FAILURE MODE can be
   * demonstrated (below) rather than assumed. A completeness guard with no
   * demonstrated red is exactly the shape this estate keeps finding vacuous.
   */
  function unhandledContractKeys(
    schemaKeys: readonly string[],
    carriedKeys: readonly string[],
    ignored: Readonly<Record<string, string>>,
  ): string[] {
    const carried = new Set(carriedKeys)
    return schemaKeys.filter((k) => !carried.has(k) && !(k in ignored))
  }

  /** A contract-valid block with EVERY declared key populated. */
  const MAXIMAL = {
    ...BASE,
    signal_id: 'sig-1',
    created_at: '2026-08-10T00:00:00.000Z',
    source_handler: 'coaching_pass',
    graph_hash_at_generation: 'deadbeef',
    category: 'must_fix',
    priority: 90,
    signal_code: 'MISSING_BASE_RATE',
    signal: 'Two options share one base-rate assumption.',
    action_intent: 'confirm_factor',
    action_label: 'Check this',
    action_prompt: 'What would have to be true for that to hold?',
    dsk_claim_provenance: CLAIM,
  }

  it('every key the contract declares is either CARRIED or ignored WITH A REASON', () => {
    const schemaKeys = Object.keys(CoachingBlockSchema.shape)
    // Positive controls: a probe that reads nothing agrees with everything.
    expect(schemaKeys.length).toBeGreaterThan(10)
    // The fixture must be a REAL contract-valid block, or "carried" is derived
    // from something the producer could never send.
    const parsed = CoachingBlockSchema.safeParse(MAXIMAL)
    expect(parsed.success, `MAXIMAL fixture is not contract-valid: ${JSON.stringify((parsed as { error?: unknown }).error)}`).toBe(true)
    // The fixture must exercise EVERY declared key, or a key could look
    // "not carried" merely because the fixture forgot to set it.
    expect(unhandledContractKeys(schemaKeys, Object.keys(MAXIMAL), {})).toEqual([])

    // CARRIED is DERIVED — by running the adapter, never by listing.
    const out = adaptTypedCoachingBlock(MAXIMAL)
    expect(out).not.toBeNull()
    const carriedKeys = Object.keys(out!)
    expect(carriedKeys.length).toBeGreaterThan(10)

    expect(
      unhandledContractKeys(schemaKeys, carriedKeys, DELIBERATELY_NOT_CARRIED),
      'The contract declares a field the adapter neither carries nor explicitly ignores. ' +
        'Decide which it is: carry it in adaptTypedCoachingBlock, or add it to ' +
        'DELIBERATELY_NOT_CARRIED with a stated reason. Do not silently drop it — ' +
        'that is the defect this guard exists to catch.',
    ).toEqual([])
  })

  it('the ignore-list carries no STALE entries and every reason is substantive', () => {
    const schemaKeys = new Set(Object.keys(CoachingBlockSchema.shape))
    for (const [key, reason] of Object.entries(DELIBERATELY_NOT_CARRIED)) {
      // A decision record about a field the contract no longer has is the same
      // mirror defect, one level up.
      expect(schemaKeys.has(key), `ignore-list names "${key}", absent from the contract`).toBe(true)
      expect(reason.trim().length, `ignore reason for "${key}" is a placeholder`).toBeGreaterThan(40)
    }
  })

  it('PROOF THE GUARD CAN FAIL: a new contract field is reported as unhandled', () => {
    const realSchemaKeys = Object.keys(CoachingBlockSchema.shape)
    const out = adaptTypedCoachingBlock(MAXIMAL)
    const carriedKeys = Object.keys(out!)

    // Discriminating pair. Same inputs, one synthetic key added to the CONTRACT.
    const clean = unhandledContractKeys(realSchemaKeys, carriedKeys, DELIBERATELY_NOT_CARRIED)
    const widened = unhandledContractKeys(
      [...realSchemaKeys, 'selection_role'],
      carriedKeys,
      DELIBERATELY_NOT_CARRIED,
    )
    expect(clean).toEqual([])
    expect(widened).toEqual(['selection_role'])

    // ...and an ignore entry silences it — deliberately, and only with a reason.
    expect(
      unhandledContractKeys([...realSchemaKeys, 'selection_role'], carriedKeys, {
        ...DELIBERATELY_NOT_CARRIED,
        selection_role: 'hypothetical — proves an explicit decision silences the guard',
      }),
    ).toEqual([])
  })

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
