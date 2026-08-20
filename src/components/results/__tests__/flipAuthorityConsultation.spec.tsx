/**
 * THE OTHER TWO SURFACES THAT MAKE THE CONTRADICTED CLAIM.
 *
 * ⚠⚠ TRAP 23 — THIS SPEC EXISTS BECAUSE THE FIRST FIX'S NUMBERS LOOKED
 * TRIUMPHANT WHILE THE DEFECT WAS STILL LIVE. Neutralising the fragile-edge
 * card moved the SYMPTOM metric (that card stops saying "flip") decisively and
 * moved the OUTCOME metric (the user stops seeing a contradiction) NOT AT ALL,
 * because two further surfaces on the same panel kept making the same claim —
 * one of them with the percentage. A fix validated against the symptom can kill
 * the symptom and leave the defect alive.
 *
 * Both surfaces below now consult the SAME authority as the fragile card
 * (`classifyFlipEvidence` → `flips_absent`, via `attestsNoFactorFlip`). No new
 * derivation is added anywhere.
 *
 *   · SURFACE 1 `TriageActionCardsBody` T1FlipRiskCallout — renders the LITERAL
 *     second line of the defect statement, "{alt} could overtake (57%
 *     probability)". Consulted the authority ZERO times.
 *   · SURFACE 2 `buildRecommendations` flip rec — gated on `hasLeadingOption
 *     === false` ONLY, i.e. Q1 alone, the ANTI-CORRELATED half. Witnessed by
 *     execution against `live-analysis-turn-walkA-2026-08-04.json`: the footer
 *     said "none of the factors we could test changed which option leads on its
 *     own" while this said "55% chance the result flips to Hire Two Sales Reps
 *     if Self-Serve Product Tier shifts." Same panel, same run, same named
 *     alternative.
 *
 * PROVENANCE: the flip-threshold rows below are read from the real capture, not
 * authored here.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TriageActionCardsBody } from '../TriageActionCardsBody'
import { buildRecommendations } from '../strengthen/buildRecommendations'
import type { StrengthenInputs } from '../strengthen/strengthenTypes'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import { attestsNoFactorFlip } from '../utils/fragileEdgeCopy'
import { ATTESTED_NO_FLIP_REASONS } from '../utils/flipReasonVocabulary'

const read = (p: string) => JSON.parse(readFileSync(resolve(__dirname, p), 'utf-8'))
const WALK_A = read('../../../v5/__tests__/fixtures/live-analysis-turn-walkA-2026-08-04.json')
const PROBE_A = read(
  '../../../lib/coherence/__tests__/fixtures/captures/conditional-winners-2026-08-17-probe-A.json',
)

/** Real rows: 7 × `structurally_invariant` ⇒ flips_absent. */
const ATTESTED_ROWS = WALK_A.blocks[0].enrichment.flip_thresholds
/** Real rows: numeric `flip_value`, `flip_reason: 'found'` ⇒ flips_present. */
const FLIPPING_ROWS = PROBE_A.flip_thresholds
const ALT = 'Hire Two Sales Reps'

describe('PRECONDITION PINS', () => {
  it('the two real row-sets classify in OPPOSITE directions', () => {
    expect(attestsNoFactorFlip(ATTESTED_ROWS)).toBe(true)
    expect(attestsNoFactorFlip(FLIPPING_ROWS)).toBe(false)
    expect(ATTESTED_ROWS.length).toBeGreaterThan(0)
    expect(FLIPPING_ROWS.length).toBeGreaterThan(0)
  })
})

// ── SURFACE 1 ───────────────────────────────────────────────────────────────
const triageData = (flipThresholds: unknown): ResultsSectionDataReturn =>
  ({
    recommendation: { goalThreshold: null, analysisStatus: 'computed', flipThresholds },
    confidence: {
      topFragileEdge: {
        edgeId: 'fac_selfserve->out_product_led_growth',
        fromId: 'fac_selfserve',
        fromLabel: 'Self-Serve Product Tier',
        alternativeWinnerLabel: ALT,
        switchProbability: 0.55,
      },
      challengeFragileEdges: [],
      robustnessStatus: null,
      robustnessLevel: null,
    },
    drivers: { drivers: [] },
  }) as unknown as ResultsSectionDataReturn

describe('SURFACE 1 — T1FlipRiskCallout consults the flip authority', () => {
  it('ANTI-VACUITY: the callout renders at all, and carries the claim the matcher hunts', () => {
    render(<TriageActionCardsBody data={triageData(FLIPPING_ROWS)} />)
    const el = screen.getByTestId('t1-flip-risk-callout')
    expect(el.textContent ?? '').toContain('could overtake')
    expect(el.textContent ?? '').toContain('55% probability')
  })

  it('ATTESTED NO-FLIP: the presupposing verb goes', () => {
    render(<TriageActionCardsBody data={triageData(ATTESTED_ROWS)} />)
    const el = screen.getByTestId('t1-flip-risk-callout')
    expect(el.textContent ?? '').not.toContain('could overtake')
  })

  it('ATTESTED NO-FLIP: the PERCENTAGE goes with the verb — it is a claim, not data', () => {
    // ⚠ `switch_probability` means P(the alternative OVERTAKES). Beside the
    // weakened verb it would read "55% chance it gains ground" — a hedged verb
    // carrying an UNHEDGED NUMBER, i.e. the number saying more than its own
    // sentence. Labelling it correctly ("chance it overtakes") would reinstate
    // the very claim this change removes, so no wording keeps it.
    render(<TriageActionCardsBody data={triageData(ATTESTED_ROWS)} />)
    const t = screen.getByTestId('t1-flip-risk-callout').textContent ?? ''
    expect(t).not.toContain('55% probability')
    expect(t).not.toMatch(/\d+\s*%/)
  })

  it('DATA SURVIVES: the alternative and the factor are still named', () => {
    // The DATA stays in full; only the CLAIM changes. The finding itself is
    // carried by the fragile card (count, labels, E-values, alt-winner,
    // Stability pill) — this callout is not the only place it lives.
    render(<TriageActionCardsBody data={triageData(ATTESTED_ROWS)} />)
    const t = screen.getByTestId('t1-flip-risk-callout').textContent ?? ''
    expect(t).toContain(ALT)
    expect(t).toContain('Self-Serve Product Tier')
    expect(t).toContain('could gain ground')
  })

  it('OPPOSITE DIRECTION: a genuinely flip-bearing run keeps the percentage WITH its strong verb', () => {
    render(<TriageActionCardsBody data={triageData(FLIPPING_ROWS)} />)
    const t = screen.getByTestId('t1-flip-risk-callout').textContent ?? ''
    expect(t).toContain('could overtake')
    expect(t).toContain('55% probability')
  })
})

// ── SURFACE 2 ───────────────────────────────────────────────────────────────
const strengthenBase: StrengthenInputs = {
  goalThreshold: 62,
  analysisComplete: true,
  flipThresholds: null,
  fragileEdges: [
    {
      edgeId: 'fac_selfserve->out_product_led_growth',
      factorLabel: 'Self-Serve Product Tier',
      switchProbability: 0.55,
      alternativeWinnerLabel: ALT,
    },
  ],
  factors: [],
  robustness: { status: null, level: null },
  biasFindingTypes: [],
  phase3Items: [],
} as unknown as StrengthenInputs

/** Bound by IDENTITY — the rec's own id prefix, never a copy substring. */
const flipRec = (inputs: StrengthenInputs) =>
  buildRecommendations(inputs).find((r) => r.id.startsWith('strengthen:flip:'))

describe('SURFACE 2 — the Strengthen flip rec consults the flip authority', () => {
  it('ANTI-VACUITY: with flip-bearing evidence the rec IS produced, carrying the claim', () => {
    const r = flipRec({ ...strengthenBase, flipThresholds: FLIPPING_ROWS, hasLeadingOption: true })
    expect(r).toBeDefined()
    expect(r!.signal).toContain('chance the result flips to')
    expect(r!.signal).toContain(ALT)
  })

  it('THE WITNESSED CONTRADICTION IS GONE: attested no-flip suppresses the rec', () => {
    const r = flipRec({ ...strengthenBase, flipThresholds: ATTESTED_ROWS, hasLeadingOption: true })
    expect(r).toBeUndefined()
  })

  it('Q1 ALONE still suppresses — the permission gate is not swallowed by the new one', () => {
    const r = flipRec({ ...strengthenBase, flipThresholds: FLIPPING_ROWS, hasLeadingOption: false })
    expect(r).toBeUndefined()
  })

  it('Q2 is a DIFFERENT question from Q1 — it bites where Q1 is false, which is the whole point', () => {
    // Anti-correlation made concrete: `hasLeadingOption: true` on BOTH rows, so
    // Q1 permits in both; only the evidence differs.
    expect(flipRec({ ...strengthenBase, flipThresholds: FLIPPING_ROWS, hasLeadingOption: true })).toBeDefined()
    expect(flipRec({ ...strengthenBase, flipThresholds: ATTESTED_ROWS, hasLeadingOption: true })).toBeUndefined()
  })

  it('degenerate evidence keeps the rec — failing toward "we do not know", never toward silence', () => {
    for (const rows of [null, [], [{ flip_value: null, flip_reason: 'timeout' }]]) {
      expect(flipRec({ ...strengthenBase, flipThresholds: rows as never, hasLeadingOption: true }))
        .toBeDefined()
    }
  })
})

// ── the cross-repo mirror ───────────────────────────────────────────────────
describe('ATTESTED_NO_FLIP_REASONS is a MIRROR of PLoT — pin what cannot be imported', () => {
  /**
   * ⚠ THE TRUE OWNER IS PLoT: `src/lib/flip-threshold-status.ts`
   * `NO_EFFECT_REASONS`, which its own header calls "THE SINGLE SOURCE OF
   * TRUTH, EXPORTED". We cannot import across the repo boundary, so this is a
   * hand-maintained mirror and the estate's dominant defect class.
   *
   * Drift toward OVER-CLAIMING is already blocked (the predicate is an
   * allow-list, so an unknown token fails safe). Drift by REMOVAL or RENAME is
   * NOT — a silent shrink would quietly stop suppressing and nothing would go
   * red. This pins exact membership so a shrink OR a growth REDs here and the
   * editor must go and re-derive against PLoT.
   */
  it('membership is EXACTLY the two substantive no-flip tokens', () => {
    expect([...ATTESTED_NO_FLIP_REASONS].sort()).toEqual([
      'no_effect_within_bounds',
      'structurally_invariant',
    ])
  })

  it('NaN is not a flip value — one spelling of "is this a number", pinned', () => {
    // ⚠ Without this the `typeof` → `Number.isFinite` correction is an
    // EQUIVALENT mutant: no real capture carries NaN, so nothing would notice a
    // revert. `typeof NaN === 'number'` is TRUE and would classify a row with no
    // usable flip value as `flips_present`, opening the gate and re-admitting
    // the flip claim on a run whose reasons all attest. `:253` in the same
    // module already answers this question strictly; this pins that they agree.
    expect(
      attestsNoFactorFlip([{ flip_value: Number.NaN, flip_reason: 'structurally_invariant' }]),
    ).toBe(true)
  })

  it('each token independently drives the authority to flips_absent', () => {
    for (const reason of ATTESTED_NO_FLIP_REASONS) {
      expect(attestsNoFactorFlip([{ flip_value: null, flip_reason: reason }])).toBe(true)
    }
  })
})

/**
 * ─────────────────────────────────────────────────────────────────────────
 * RECORDED AS UNKNOWN — deliberately NOT converted into a claim either way
 * ─────────────────────────────────────────────────────────────────────────
 * 1. `w998-2026-08-16-a1-turn3.json` proves PLoT emits MIXED arrays —
 *    attesting rows beside a numeric `flip_value` — which classify
 *    `flips_present` and therefore OPEN the gate. Whether PLoT only ever mints
 *    the attested-no-flip WORDING alongside an all-attesting array is a
 *    PRODUCER-SIDE INVARIANT and is UNKNOWN FROM THIS REPO. It is not asserted
 *    here in either direction, and settling it means reading
 *    `plot-lite-service`, which this lane deliberately did not reach into.
 * 2. The entire 12-token PROBE-FAILURE arm (`timeout`, `insufficient_precision`,
 *    `non_monotonic_grid`, `heuristic`, …) has ZERO real-capture coverage. Every
 *    witnessed zero-flip row in the corpus is `structurally_invariant`. The arm
 *    is exercised above only by constructed inputs, so its behaviour is
 *    REACHABLE-BY-CONSTRUCTION, never observed.
 */
