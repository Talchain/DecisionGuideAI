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
 *     ⛔ Since RETIRED outright (Reasoning Coach 5931857395 + 5932849641), so
 *     SURFACE 2 now pins that no evidence state raises it.
 *
 * PROVENANCE: the flip-threshold rows below are read from the real capture, not
 * authored here.
 *
 * Run-4 judge (DL 12 Oct, the class): SURFACE 1's ranking arms ("… N% of them
 * support {alt}" on a flip-bearing run, "more runs could support {alt}" on an
 * attested one) are removed and nothing replaces them. The callout no longer
 * reads the flip authority: under EITHER real row-set it says the finding alone
 * ("If {factor} shifts, the result could change."). Its rows now pin that, on
 * both row-sets, so the two directions still both run.
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

describe('SURFACE 1 — T1FlipRiskCallout makes no ranking claim under either flip evidence', () => {
  it('ANTI-VACUITY: the callout renders at all on the flip-bearing run, and says the finding', () => {
    render(<TriageActionCardsBody data={triageData(FLIPPING_ROWS)} />)
    const el = screen.getByTestId('t1-flip-risk-callout')
    // Run-4 judge (DL 12 Oct, the class): the measured conditional ("In this model, in the quarter of simulated futures
    // where … 55% of them support {alt}") is removed; nothing replaces it. Rebound: the callout renders its finding.
    expect(el.textContent ?? '').toContain('If Self-Serve Product Tier shifts, the result could change')
    expect(el.textContent ?? '').not.toContain('In this model, in the quarter of simulated futures where')
    expect(el.textContent ?? '').not.toContain(`55% of them support ${ALT}`)
  })

  it('ATTESTED NO-FLIP: the presupposing verb goes', () => {
    render(<TriageActionCardsBody data={triageData(ATTESTED_ROWS)} />)
    const el = screen.getByTestId('t1-flip-risk-callout')
    // Union, never replace: the retired verb AND the conditional sentence that replaced it.
    expect(el.textContent ?? '').not.toContain('could overtake')
    expect(el.textContent ?? '').not.toContain('comes out best in')
    // …and the direction-neutral form of that conditional sentence (Paul, 5 Oct).
    expect(el.textContent ?? '').not.toContain('of them support')
    expect(el.textContent ?? '').not.toContain('the most runs')
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
    expect(t).not.toContain('55% of them')
    expect(t).not.toMatch(/\d+\s*%/)
  })

  it('DATA SURVIVES: the factor is still named; the alternative goes with the ranking', () => {
    // The finding itself is carried by the fragile card (count, labels,
    // E-values, alt-winner, Stability pill) — this callout is not the only
    // place it lives.
    render(<TriageActionCardsBody data={triageData(ATTESTED_ROWS)} />)
    const t = screen.getByTestId('t1-flip-risk-callout').textContent ?? ''
    expect(t).toContain('Self-Serve Product Tier')
    expect(t).toContain('If Self-Serve Product Tier shifts, the result could change')
    // Run-4 judge (DL 12 Oct, the class): "more runs could support {alt}" is removed; nothing replaces it.
    expect(t).not.toContain(`more runs could support ${ALT}`)
    expect(t).not.toContain(ALT)
  })

  it('OPPOSITE DIRECTION: a genuinely flip-bearing run makes no ranking claim and prints no percentage either', () => {
    render(<TriageActionCardsBody data={triageData(FLIPPING_ROWS)} />)
    const t = screen.getByTestId('t1-flip-risk-callout').textContent ?? ''
    // Run-4 judge (DL 12 Oct, the class): the percentage and its sentence are removed on this run too; nothing replaces
    // them.
    expect(t).not.toContain('In this model, in the quarter of simulated futures where')
    expect(t).not.toContain(`55% of them support ${ALT}`)
    expect(t).not.toMatch(/\d+\s*%/)
    expect(t).not.toContain(ALT)
    expect(t).toContain('If Self-Serve Product Tier shifts, the result could change')
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
const flipIds = (inputs: StrengthenInputs) =>
  buildRecommendations(inputs).map((r) => r.id).filter((id) => id.startsWith('strengthen:flip'))

describe('SURFACE 2 — the Strengthen flip rec is RETIRED', () => {
  // ⛔ Reasoning Coach 5931857395 + 5932849641: its `switch_probability` sentence
  // read as the link's effect, so its evidence-gate rows are gone. No evidence
  // state, including the flip-bearing one, raises it on a permitted run.
  it('RETIRED: no flip rec under any evidence, with the leader permitted', () => {
    // CONTROL: FLIPPING_ROWS is the state that used to open the gate.
    expect(attestsNoFactorFlip(FLIPPING_ROWS)).toBe(false)
    expect(strengthenBase.fragileEdges).toHaveLength(1)
    for (const rows of [FLIPPING_ROWS, ATTESTED_ROWS, null, [], [{ flip_value: null, flip_reason: 'timeout' }]]) {
      const inputs = {
        ...strengthenBase,
        flipThresholds: rows as never,
        hasLeadingOption: true,
        robustness: { status: 'computed', level: 'low' },
      } as StrengthenInputs
      // CONTROL: the builder still produces its other recs on these inputs.
      expect(buildRecommendations(inputs).map((r) => r.id)).toContain('strengthen:robustness')
      expect(flipIds(inputs)).toEqual([])
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
