/**
 * HALF (a) — THE CONTRACT-DERIVED CHECK.
 *
 * ⚠ READ THIS FIRST, BECAUSE IT BOUNDS EVERY CLAIM BELOW.
 * Derivation proves AGREEMENT and can NEVER prove COMPLETENESS. Every
 * assertion here answers "are the pairs consistent with the contract?" and NONE
 * of them answers "are the pairs the right set?". A guard derived from a list
 * is structurally blind to what the list omits — deleting a key from a
 * canonical map leaves a derived guard green. The only thing that can notice a
 * short list is a hand-written corpus of real payloads, which is
 * `crossSurfaceCoherence.realCaptures.spec.ts`. The two are NOT redundant and
 * neither supersedes the other.
 *
 * The load-bearing assertion in this file is the LAST one: every contradiction
 * the gate detects PARSES CLEANLY under the vendored contract. That is what
 * makes the gate non-redundant — if the schema already refused these payloads,
 * this module would be a second copy of a rule that already exists.
 */

import { describe, it, expect } from 'vitest'
import {
  ANALYSIS_RUN_STATE_KINDS,
  AnalysisStateV1Schema,
  EnrichmentConditionalWinnerSchema,
  EnrichmentConditionalBucketSchema,
  EnrichmentFlipThresholdSchema,
} from '@talchain/schemas/boundary'

import {
  ACTIONABLE_BLOCKER_CODES,
  COHERENCE_PAIRS,
  COHERENCE_PAIR_IDS,
  CX3_LIMB_EXPRESSIBILITY,
  KNOWN_READINESS_STATUSES,
  READINESS_STATUS_READY,
  READINESS_STATUS_UNSUPPLIED,
  assertsNotAnalysable,
  evaluateCrossSurfaceCoherence,
  coherenceInput,
} from '../crossSurfaceCoherence'

describe('the pair registry is total over the contract vocabulary', () => {
  it('every run_state kind the pairs key on is a member of the contract enum, derived at RUN TIME', () => {
    const keyedOn = ['complete_current', 'refused', 'never_run']
    for (const kind of keyedOn) {
      expect(ANALYSIS_RUN_STATE_KINDS as readonly string[]).toContain(kind)
    }
  })

  it('every kind in the contract enum is either covered by a pair or DECLARED out of scope — a new kind fails loud here', () => {
    const covered = new Set(['complete_current', 'refused', 'never_run'])
    const declaredOutOfScope = new Set([
      // No sibling claim contradicts an in-flight run at this seam, and CEE
      // never emits it (`analysis-state-v1.ts` limit L-A: "running has NO
      // PRODUCER at this step and is therefore never emitted").
      'running',
      // `blocked` forces `blocked_unusable` and every usability boolean false
      // in `assembleCanonicalState`, so its incoherent cells are
      // producer-impossible rather than merely unenforced. `refused` is the
      // branch that escapes that check, and CX2 covers it.
      'blocked',
      // `complete_stale` and `unknown_degraded` both mean "do not vouch for
      // currency", which is what the not-ready surfaces also say — they are
      // the COHERENT siblings and appear as CX1's green twins.
      'complete_stale',
      'unknown_degraded',
    ])
    const accounted = new Set([...covered, ...declaredOutOfScope])
    expect([...ANALYSIS_RUN_STATE_KINDS].filter(k => !accounted.has(k))).toEqual([])
    expect([...accounted].filter(k => !(ANALYSIS_RUN_STATE_KINDS as readonly string[]).includes(k))).toEqual([])
  })

  it('the pair registry has one entry per id and no orphan', () => {
    expect(Object.keys(COHERENCE_PAIRS).sort()).toEqual([...COHERENCE_PAIR_IDS].sort())
    for (const id of COHERENCE_PAIR_IDS) expect(COHERENCE_PAIRS[id].id).toBe(id)
  })
})

describe('producer vocabularies agree with the contract and with CEE', () => {
  it('the readiness "ready" value and the unsupplied sentinel are both in the recorded vocabulary, and they are different', () => {
    expect(KNOWN_READINESS_STATUSES).toContain(READINESS_STATUS_READY)
    expect(KNOWN_READINESS_STATUSES).toContain(READINESS_STATUS_UNSUPPLIED)
    expect(READINESS_STATUS_READY).not.toBe(READINESS_STATUS_UNSUPPLIED)
  })

  it('assertsNotAnalysable is TOTAL over the recorded vocabulary and treats exactly two members as non-negative', () => {
    const negative = KNOWN_READINESS_STATUSES.filter(assertsNotAnalysable)
    expect(negative.sort()).toEqual(['blocked', 'needs_encoding', 'needs_user_input', 'needs_user_mapping'])
    // Absence is not a negative verdict.
    expect(assertsNotAnalysable(undefined)).toBe(false)
    expect(assertsNotAnalysable('')).toBe(false)
  })

  it('the actionable blocker codes are exactly the three ACTIONABLE_BLOCKER_TYPES map to, and exclude the advisory one', () => {
    // CEE ACTIONABLE_BLOCKER_TYPES = {missing_value, ambiguous_value,
    // missing_connection} (canonical-analysis-state.ts:130-134), which
    // `blockerIssue` (analysis-ready-helper.ts:623-644) maps to these codes.
    expect([...ACTIONABLE_BLOCKER_CODES].sort()).toEqual([
      'AMBIGUOUS_OPTION_VALUE',
      'MISSING_OPTION_CONNECTION',
      'MISSING_OPTION_VALUE',
    ])
    // The advisory code and the status-derived code are deliberately absent.
    expect(ACTIONABLE_BLOCKER_CODES).not.toContain('CONSTRAINT_REVIEW_REQUIRED')
    expect(ACTIONABLE_BLOCKER_CODES).not.toContain('UNREACHABLE_CONTROLLABLE_FACTOR')
  })

  it('the enrichment members the pairs read EXIST on the contract schemas — derived from the shapes, not retyped', () => {
    expect(Object.keys(EnrichmentFlipThresholdSchema.shape)).toEqual(
      expect.arrayContaining(['factor_id', 'no_flip_in_range', 'flip_reason']),
    )
    expect(Object.keys(EnrichmentConditionalWinnerSchema.shape)).toEqual(
      expect.arrayContaining(['factor_id', 'split_value', 'winner_flips', 'low_bucket', 'high_bucket']),
    )
    expect(Object.keys(EnrichmentConditionalBucketSchema.shape)).toEqual(
      expect.arrayContaining(['winner_id', 'winner_label', 'win_probability']),
    )
  })
})

/**
 * A minimally-valid payload, used as the base for every behavioural probe below.
 * It must satisfy CC-A…CC-F, so it doubles as a statement of what a coherent
 * verdict looks like under 0.47.0.
 */
const VALID_STATE = {
  run_state: { kind: 'complete_current', computed_at: '2026-08-17T09:00:00.000Z' },
  readiness: { status: 'ready', blockers: [] },
  leader_claim: { permitted: true },
  robustness: {},
  usable_for_prose: true,
  usable_for_chips: true,
  usable_for_followup: true,
  requires_rerun: false,
  blocked_unusable: false,
  contradictions: [],
} as const

describe('expressibility is a STRUCTURAL claim about the contract, not an opinion', () => {
  /**
   * ⚠ PROVED BEHAVIOURALLY, NOT BY READING `.shape` — and the reason is a
   * premise correction. 0.47.0 wraps the object in `.superRefine`, so
   * `AnalysisStateV1Schema` is a `ZodEffects` and `.shape` is `undefined`. The
   * earlier version of this test read `.shape` and, at the new pin, was
   * asserting `undefined` did not contain a key — a test that would have PASSED
   * for the wrong reason had the assertion been phrased the other way round.
   * Adding the key and requiring the parse to FAIL cannot degrade like that: it
   * exercises `.strict()` itself.
   */
  it('the strict body REFUSES an enrichment or prose member — so the three envelope pairs are not statable inside it', () => {
    for (const absent of ['enrichment', 'conditional_winners', 'flip_thresholds', 'assistant_text', 'prose']) {
      const withExtra = { ...VALID_STATE, [absent]: {} }
      expect(
        AnalysisStateV1Schema.safeParse(withExtra).success,
        `${absent} must be an unrecognized key`,
      ).toBe(false)
    }
    // CONTRAST CONTROL — the base itself parses, so the failures above are
    // caused by the added key and not by a base that never parsed.
    expect(AnalysisStateV1Schema.safeParse(VALID_STATE).success).toBe(true)

    const envelopePairs = COHERENCE_PAIR_IDS.filter(id => COHERENCE_PAIRS[id].expressibility === 'envelope')
    expect(envelopePairs).toEqual(['CX4', 'CX5', 'CX6'])
  })

  it('two pairs ARE statable inside AnalysisStateV1 — every member they read is a declared member the parser keeps', () => {
    const parsed = AnalysisStateV1Schema.parse(VALID_STATE) as Record<string, unknown>
    expect(Object.keys(parsed)).toEqual(
      expect.arrayContaining(['run_state', 'readiness', 'leader_claim', 'usable_for_chips']),
    )
    const inContract = COHERENCE_PAIR_IDS.filter(id => COHERENCE_PAIRS[id].expressibility === 'analysis_state')
    expect(inContract).toEqual(['CX1', 'CX2'])
  })

  it('CX3 is only as expressible as its weakest limb, and 0.47.0 moved ONE limb to ENFORCED', () => {
    expect(COHERENCE_PAIRS.CX3.expressibility).toBe('not_on_the_wire')
    expect(CX3_LIMB_EXPRESSIBILITY).toEqual({
      // ⬅ was 'analysis_state' at 0.46.0; CC-C now refuses it at the parser.
      never_run_with_usable_analysis: 'analysis_state_enforced',
      never_run_after_degraded_store_read: 'not_on_the_wire',
      never_run_over_visible_result_body: 'envelope',
    })
    // Exactly one limb across the whole set is parser-enforced today.
    const enforced = COHERENCE_PAIR_IDS.filter(
      id => COHERENCE_PAIRS[id].expressibility === 'analysis_state_enforced',
    )
    expect(enforced).toEqual([])
    expect(
      Object.values(CX3_LIMB_EXPRESSIBILITY).filter(e => e === 'analysis_state_enforced'),
    ).toHaveLength(1)
  })
})

describe('⚠ RE-DERIVED AT 0.47.0 — which cross-checks exist, and what they do NOT touch', () => {
  it('the vendored parser now carries cross-field refinement — the 0.46.0 premise is REFUTED', () => {
    // At 0.46.0 the schema was a bare ZodObject with `superRefine` count 0. At
    // 0.47.0 it is a ZodEffects wrapping that object. Derived from the schema
    // itself rather than quoted from a doc.
    expect(AnalysisStateV1Schema.constructor.name).toBe('ZodEffects')
    expect('shape' in AnalysisStateV1Schema).toBe(false)
  })

  it('CC-C is live: never_run beside ANY of the four flags is now REFUSED, one flag at a time', () => {
    for (const flag of ['usable_for_prose', 'usable_for_chips', 'usable_for_followup', 'requires_rerun']) {
      const payload = {
        ...VALID_STATE,
        run_state: { kind: 'never_run' },
        usable_for_prose: false,
        usable_for_chips: false,
        usable_for_followup: false,
        requires_rerun: false,
        [flag]: true,
      }
      expect(AnalysisStateV1Schema.safeParse(payload).success, `${flag} must be refused`).toBe(false)
    }
    // CONTRAST — a coherent never_run still parses, so the refusals above are
    // CC-C discriminating rather than the kind being rejected outright.
    expect(AnalysisStateV1Schema.safeParse({
      ...VALID_STATE,
      run_state: { kind: 'never_run' },
      usable_for_prose: false, usable_for_chips: false, usable_for_followup: false,
    }).success).toBe(true)
  })

  it('⭐ the cross-checks key on run_state.kind and the five booleans ONLY — readiness.status, leader_claim and robustness appear in ZERO rules', () => {
    // Each probe takes a payload that satisfies every CC rule and moves ONLY a
    // member the rules do not mention. All must still parse — which is what
    // makes CX1, CX2, CX4, CX5 and CX6 unreachable by any 0.47.0 rule.
    const untouchedByAnyRule = [
      ['readiness.status not-ready', { ...VALID_STATE, readiness: { status: 'needs_user_input', blockers: [] } }],
      ['readiness carries actionable blockers', {
        ...VALID_STATE,
        readiness: {
          status: 'needs_user_input',
          blockers: [{ code: 'MISSING_OPTION_VALUE', category: 'option_values', message: 'x', repairability: 'human_input_required' }],
        },
      }],
      ['leader_claim withheld', { ...VALID_STATE, leader_claim: { permitted: false, withheld_reason: 'options_do_not_separate' } }],
      ['robustness populated', { ...VALID_STATE, robustness: { aggregate_level: 'low' } }],
      ['contradictions self-reported empty', { ...VALID_STATE, contradictions: [] }],
    ] as const
    for (const [name, payload] of untouchedByAnyRule) {
      expect(AnalysisStateV1Schema.safeParse(payload).success, `${name} must still parse`).toBe(true)
    }
  })
})

describe('⭐ THE LOAD-BEARING DERIVATION — five of six contradictions still parse cleanly at 0.47.0', () => {
  /**
   * ⚠ RE-DERIVED AT THE 0.47.0 PIN, and one row moved.
   *
   * At 0.46.0 the parser accepted ALL of these. 0.47.0's CC-C now refuses the
   * `never_run` + usability row, so it has been moved out of this list into its
   * own REFUSED case below. Everything else still parses, because no CC rule
   * mentions `readiness.status`, `leader_claim`, `robustness`, `refused`, the
   * enrichment or the prose.
   *
   * If a row here ever parsed FALSE, this gate would be duplicating a rule the
   * parser already enforces and the pair would belong in the schema, not here.
   */
  const contradictoryStates: ReadonlyArray<[string, unknown]> = [
    ['CX1 complete_current + needs_user_input + actionable blocker', {
      run_state: { kind: 'complete_current', computed_at: '2026-08-17T09:00:00.000Z' },
      readiness: {
        status: 'needs_user_input',
        blockers: [{ code: 'MISSING_OPTION_VALUE', category: 'option_values', message: 'x', repairability: 'human_input_required' }],
      },
      leader_claim: { permitted: true },
      robustness: {},
      usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
      requires_rerun: false, blocked_unusable: false, contradictions: [],
    }],
    ['CX2 refused + readiness ready + usable_for_chips', {
      run_state: { kind: 'refused', reason_code: 'analysis_refused_unspecified' },
      readiness: { status: 'ready', blockers: [] },
      leader_claim: { permitted: true },
      robustness: {},
      usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
      requires_rerun: false, blocked_unusable: false, contradictions: [],
    }],
    ['CX4/CX5/CX6 the withheld-leader state the enrichment then contradicts', {
      run_state: { kind: 'complete_current', computed_at: '2026-08-17T09:00:00.000Z' },
      readiness: { status: 'ready', blockers: [] },
      leader_claim: { permitted: false, withheld_reason: 'options_do_not_separate', separation: 'near_tie' },
      robustness: {},
      usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
      requires_rerun: false, blocked_unusable: false, contradictions: [],
    }],
    ['L1 permitted:true beside a withheld_reason', {
      run_state: { kind: 'complete_current', computed_at: '2026-08-17T09:00:00.000Z' },
      readiness: { status: 'ready', blockers: [] },
      leader_claim: { permitted: true, withheld_reason: 'options_do_not_separate' },
      robustness: {},
      usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
      requires_rerun: false, blocked_unusable: false, contradictions: [],
    }],
  ]

  it.each(contradictoryStates)('the parser ACCEPTS: %s', (_name, payload) => {
    expect(AnalysisStateV1Schema.safeParse(payload).success).toBe(true)
  })

  it('POSITIVE CONTROL — the parser is not simply accepting everything', () => {
    // An unknown run_state kind must be refused, or the assertions above would
    // be measuring a parser that cannot fail (an instrument that cannot fail is
    // not evidence).
    expect(AnalysisStateV1Schema.safeParse({
      run_state: { kind: 'auto_provisional' },
      readiness: { status: 'ready', blockers: [] },
      leader_claim: { permitted: true },
      robustness: {},
      usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
      requires_rerun: false, blocked_unusable: false, contradictions: [],
    }).success).toBe(false)
    // And a `refused` state carrying `computed_at` is an unrecognized key.
    expect(AnalysisStateV1Schema.safeParse({
      run_state: { kind: 'refused', reason_code: 'x', computed_at: '2026-08-17T09:00:00.000Z' },
      readiness: { status: 'ready', blockers: [] },
      leader_claim: { permitted: true },
      robustness: {},
      usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
      requires_rerun: false, blocked_unusable: false, contradictions: [],
    }).success).toBe(false)
  })

  it.each(contradictoryStates.slice(0, 2))('…and the GATE catches what the parser waves through: %s', (_name, payload) => {
    const parsed = AnalysisStateV1Schema.parse(payload)
    const violations = evaluateCrossSurfaceCoherence(coherenceInput({ analysisState: parsed }))
    expect(violations.length).toBeGreaterThan(0)
  })

  /**
   * ⭐ THE ONE ROW 0.47.0 CLOSED, AND WHY THE LIMB STAYS.
   *
   * CC-C refuses `never_run` + usability. That is a real improvement and this
   * test records it. But a parser refusal is not a user-visible correction: the
   * product's tolerance step quarantines the malformed verdict and every surface
   * falls back to its legacy derivation with a diagnostic. So the contradiction
   * stops being a wrong claim and becomes an ABSENT claim — and nothing else in
   * the estate says a word about it. The gate reads the payload as the WIRE
   * delivered it, so the limb still fires and still names the defect.
   */
  it('CC-C REFUSES the never_run + usability payload — a premise change from 0.46.0, recorded not inherited', () => {
    const payload = {
      ...VALID_STATE,
      run_state: { kind: 'never_run' },
      usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
    }
    const parsed = AnalysisStateV1Schema.safeParse(payload)
    expect(parsed.success).toBe(false)
    expect(JSON.stringify(parsed.error?.issues)).toContain('never_run_forbids_usability')
  })

  it('…and the GATE still reports it, because the parser\'s refusal is SILENT at the mounted consumer', () => {
    // Same payload, read as the wire delivered it (the adapter's raw-read path).
    const violations = evaluateCrossSurfaceCoherence(coherenceInput({
      analysisState: {
        ...VALID_STATE,
        run_state: { kind: 'never_run' },
        usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
      } as never,
    }))
    expect(violations.map(v => v.code)).toContain('never_run_with_usable_analysis')
  })
})
