/**
 * ⭐⭐⭐ A THIN CARD SAYS THE MODEL IS THIN — AND THE CONTRAST CASE IS WHAT MAKES
 * THAT A GUARD RATHER THAN A TAUTOLOGY.
 *
 * ⛔⛔ DECLARED UNRUN. Not one assertion below has been executed: this lane was
 * run under a hard cost constraint — no installs, no vitest, no typecheck — and
 * CI at the head is the test authority. Read every expectation as a claim about
 * what SHOULD hold, never as a measurement. A green CI run is the first evidence
 * this file has ever produced. If an assertion here is wrong, it is wrong
 * because it was reasoned rather than observed, and the fix is to correct it at
 * the bytes rather than to loosen it until it passes.
 *
 * ── WHAT IS BEING GUARDED ──────────────────────────────────────────────────
 *
 * `RiskNode` now renders `RISK_EXPOSURE_UNSET_LINE` — *"Likelihood and impact
 * not set yet."* — where it previously rendered nothing at all, plus a
 * `How likely is this?` chip beside it. The harm it closes: a board of cards
 * holding a name and nothing else reads as *"this tool is empty"* when the truth
 * is *"this model is empty, and here is the next thing to put in it"*.
 *
 * ⭐ THE STATE IS MODAL, NOT MARGINAL — THREE INDEPENDENT MEASUREMENTS AGREE.
 *   · 14 of 14 risk nodes across all five committed starters carry exactly
 *     `id`, `kind`, `label`, `provenance` (scan of `starters/data/*.draft.json`;
 *     contrast control in the same scan — the 34 factor nodes carry six content
 *     keys, so the probe discriminates and the zero is the data).
 *   · `RiskNode.statesItsOwnSize.spec.tsx` header: `probability` × `impact` is
 *     present on **0 of 23** risk nodes across every capture in this repo.
 *   · `OutcomeNode.tsx`'s Rule 6 note: the sibling kind measures **15 of 15**
 *     carrying provenance only.
 * So the fixtures below are the measured wire shape. A corpus that supplied
 * `probability`/`impact` because the TYPE declares them would share the code's
 * blind spot and certify it — the defect `lodMetric.riskOutcome.spec.tsx`
 * records its predecessor committing (CLAUDE.md trap 13d).
 *
 * ── WHY EACH TEST EXISTS, AND WHAT WOULD MAKE IT VACUOUS ───────────────────
 *
 * ⚠ TEST 2 IS THE LOAD-BEARING ONE. An appearance test alone is satisfied by
 * `return <p>Likelihood and impact not set yet.</p>` with no predicate at all —
 * a sentence on every card, which is the "make the board look busy" failure this
 * change exists to refuse. Only the populated-card case can tell a guard from a
 * constant. Without it the suite is green for the wrong reason.
 *
 * ⚠ TEST 3 IS THE IDENTITY DISCRIMINATOR (CLAUDE.md trap 19). The tempting
 * implementation is `severity == null`, because `calculateRiskSeverity` already
 * exists and already returns null on a thin risk. It is WRONG, and no test above
 * can see it: `severity` also needs BOTH halves, so it is null on a risk that
 * records a likelihood and no impact — a card which demonstrably HAS recorded
 * something and must not be told it has not. Both one-sided twins are asserted,
 * in both directions, because a predicate guarding two opposite harms cannot be
 * certified by cases pointing one way (trap 22b).
 *
 * ⚠ TESTS 5 AND 6 ARE ABSENCE CLAIMS AND THEREFORE CARRY POSITIVE CONTROLS. A
 * `not.toMatch` passes just as happily against an empty string, a null, or a
 * detector whose regex never matches anything (trap 13). Each asserts its own
 * detector FIRES on a string that should trip it, in the same test, before
 * believing the negative.
 *
 * ⚠ WHAT THIS FILE DELIBERATELY DOES NOT TEST. `NodeChip`'s own behaviour — the
 * 24px target, the dispatch path, the unavailable fallback — is covered by
 * `shared/__tests__/NodeChip.{intent,unavailable,canonicalRun}.spec.tsx` and
 * `canvasGlyphTargetScale.spec.tsx`. Re-asserting it here would be a second
 * hand-maintained copy of someone else's guarantee. This file asserts only that
 * the chip is PRESENT in step with the sentence and ABSENT without it.
 *
 * ⚠ CLAUDE.md trap 3 — jsdom cannot prove visibility. Mounting and text only.
 *   The claim "on the card face rather than behind a hover" rests on the render
 *   site sitting in the LAYER 1 block, which is read here from the source rather
 *   than inferred from a render (see test 8).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { NodeProps } from '@xyflow/react'
import { ReactFlowProvider } from '@xyflow/react'
import { RiskNode, RISK_EXPOSURE_UNSET_LINE } from '../RiskNode'
import { METRIC_UNSET } from '../shared/metricVocabulary'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  editedSinceRunNodeIds: new Set(),
  analysisHighlight: { source: null, edgeIds: new Set(), nodeIds: new Set() },
  lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
  goalThreshold: null,
  goalConstraints: [],
  hoveredOptionId: null,
  ceeAnalysisReady: null,
  edges: [],
  nodes: [],
  viewMode: 'standard',
  lodRung: 'full',
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, influenceProvenance: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null,
    achievementProbabilityIsModelledBasis: null, stabilityPercentage: null,
    winRate: null, isResultsMode: false,
  })),
}))

import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'

const baseProps = {
  type: 'risk', position: { x: 0, y: 0 }, selected: false, isConnectable: true,
  positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
}

/**
 * The measured wire shape: a name, a kind, a stamp, nothing else. This is what
 * 14 of 14 starter risks carry — NOT a minimal fixture invented to make the
 * branch reachable.
 */
const UNSIZED = { label: 'GDPR Non-Compliance Risk', type: 'risk' }

/** Both halves present — the card that must stay silent. */
const SIZED = { label: 'Migration Delay Past March Deadline', type: 'risk', probability: 0.4, impact: 'high' }

/** One half each. `severity` is null on BOTH, and neither is thin. */
const LIKELIHOOD_ONLY = { label: 'Data Team Overload Risk', type: 'risk', probability: 0.4 }
const IMPACT_ONLY = { label: 'Vendor Lock-In and Pricing Dependency', type: 'risk', impact: 'high' }

/**
 * A risk that records its own magnitude and neither half of the pair. Real
 * payload, from `RiskNode.statesItsOwnSize.spec.tsx` — the fixture that proves
 * the sentence must name FIELDS and not say "nothing".
 */
const RECORDS_A_SIZE = {
  label: 'Time to Reach Customer Target',
  type: 'risk',
  observedState: {
    value: 0.5, unit: 'months', source: 'brief_extraction',
    raw_value: 12, cap: 24, extractionType: 'explicit', factor_type: 'time',
  },
}

const draw = (id: string, data: Record<string, unknown>, store: Record<string, unknown> = {}) => {
  vi.mocked(useCanvasStore).mockImplementation(sel => sel(makeStoreState(store) as never))
  return render(
    <ReactFlowProvider>
      <RiskNode {...(baseProps as unknown as NodeProps)} id={id} data={data} />
    </ReactFlowProvider>,
  )
}

const unsetLine = () => screen.queryByTestId('risk-exposure-unset')
/**
 * ⚠ READ BY TEST ID, NOT BY `getByText(/40% likely/)`. A regex matcher matches
 * every ANCESTOR whose textContent also contains the phrase, so Testing Library
 * throws "found multiple elements" — a false RED that says nothing about the
 * product. The id binds to the one element that owns the claim.
 */
const exposureLine = () => screen.queryByTestId('risk-exposure-line')?.textContent ?? null
const sizingChip = () => screen.queryByRole('button', { name: 'How likely is this?' })
/**
 * ⚠ SINCE 23 SEP 2026 THIS IS THE CARD'S COACHING ICON, found by the same
 * accessible name. The locked Experience Design ("Coaching becomes ONE
 * consistent icon on the card surface") replaced the chip row with one icon
 * carrying the resolver's FIRST card question — the leading indicator.
 */
const indicatorChip = () => screen.queryByRole('button', { name: 'What would we see first?' })

describe('a thin risk card says the MODEL is thin', () => {
  beforeEach(() => {
    cleanup(); vi.clearAllMocks()
    // An ask surface, so the coaching icon may render (`askSemantic`'s rule).
    useGuidanceStore.setState({ _dispatchAction: vi.fn() } as never)
  })

  // ── 1. The target ────────────────────────────────────────────────────────
  it('⭐ RED-FIRST: a risk with no likelihood and no impact says so, on the card', () => {
    draw('risk-gdpr', UNSIZED)
    // Bound by identity to the exported constant, never a substring predicate:
    // a `toContain('not set')` would also pass against the bridge-strength row
    // two lines up, which says the same three words about a DIFFERENT fact.
    expect(unsetLine()?.textContent).toBe(RISK_EXPOSURE_UNSET_LINE)
  })

  // ── 2. The contrast case — without this, test 1 is satisfied by a constant ─
  it('⛔ THE GUARD, NOT A CONSTANT: a risk carrying BOTH halves says nothing of the kind', () => {
    draw('risk-migration', SIZED)
    expect(unsetLine()).toBeNull()
    // …and the readout it DOES carry is unchanged, so this is a silence for the
    // right reason rather than a card that quietly lost its row. Asserting the
    // WHOLE line, not a fragment: a card rendering "Entered estimate · " and
    // nothing else would satisfy a fragment match on either half.
    expect(exposureLine()).toBe('Entered estimate · 40% likely · High impact')
  })

  // ── 3. The identity discriminator — kills the `severity == null` mutant ────
  it('⛔ A HALF-SIZED RISK IS NOT A THIN ONE: likelihood alone still silences the line', () => {
    draw('risk-overload', LIKELIHOOD_ONLY)
    // `calculateRiskSeverity` returns null here — both halves are required — so
    // an implementation keyed on `severity` would wrongly claim nothing is set
    // on a card that plainly records a 40% likelihood.
    expect(unsetLine()).toBeNull()
    expect(exposureLine()).toBe('Entered estimate · 40% likely')
  })

  it('⛔ AND ITS OPPOSITE-DIRECTION TWIN: impact alone silences it too', () => {
    // Written because a predicate guarding two opposite harms cannot be
    // certified by cases that all point one way (CLAUDE.md trap 22b). If the
    // implementation ever becomes `probability == null` alone, this REDs and
    // the test above stays green — which is the discrimination.
    draw('risk-lockin', IMPACT_ONLY)
    expect(unsetLine()).toBeNull()
    expect(exposureLine()).toBe('Entered estimate · High impact')
  })

  // ── 4. The next-step half, after the one-icon design ──────────────────────
  //
  // ⚠ UPDATED 23 Sep 2026. This case asserted a `How likely is this?` CHIP
  // beside the sentence. The card's chip row is now ONE icon carrying the
  // resolver's FIRST card question, and the resolver leads with the leading
  // indicator on EVERY risk ("ADDED, NOT SWAPPED" — that ruling is what keeps
  // the indicator first). The sizing question was the row's second chip and
  // has no other surface, so it leaves the card — the withdrawal `RiskNode`'s
  // own docblock pre-authorised: "this chip can be withdrawn on its own and
  // the sentence above stands without it." The sentence stands (tests 1-3).
  it('⭐ THE COACHING HALF: the unsized card keeps ONE question — the leading indicator — beside the sentence', () => {
    draw('risk-gdpr', UNSIZED)
    expect(unsetLine()?.textContent).toBe(RISK_EXPOSURE_UNSET_LINE)
    expect(indicatorChip()).toBeTruthy()
    expect(sizingChip()).toBeNull()
  })

  it('⛔ ON A SIZED RISK THE SIZING QUESTION STAYS ABSENT, and the leading indicator still leads', () => {
    draw('risk-migration', SIZED)
    expect(sizingChip()).toBeNull()
    expect(indicatorChip()).toBeTruthy()
  })

  // ── 5. It makes no claim about importance ─────────────────────────────────
  it('⛔ IT STATES A FACT ABOUT THE MODEL, NEVER A VERDICT ON THE RISK', () => {
    // "No likelihood recorded" is ours to say. "This risk is minor" is a claim
    // about the world and belongs to nobody on this card — the same boundary
    // `TierInvitation` draws when it refuses to say "your risks are thin".
    const JUDGEMENT = /\b(minor|major|unimportant|negligible|safe|severe|low risk|high risk|not a concern|worth ignoring)\b/i
    // ⚠ POSITIVE CONTROL FIRST. A `not.toMatch` is vacuous against a detector
    // that matches nothing (CLAUDE.md trap 13); prove it bites before trusting
    // the negative below.
    expect(JUDGEMENT.test('This is a minor risk.'), 'the judgement detector never fires').toBe(true)
    expect(RISK_EXPOSURE_UNSET_LINE).not.toMatch(JUDGEMENT)
  })

  // ── 6. The absence claim is FIELD-SCOPED, not total ───────────────────────
  it('⛔ IT NEVER CLAIMS "NOTHING" — a risk recording its own size keeps saying so', () => {
    // This card has already shipped the inverse defect: `lodMetric`'s header
    // records a risk holding `4 months` rendering "Strength not set yet", so
    // "the card announced that nothing was recorded while holding the thing that
    // was." A sentence reading "Nothing recorded yet" would be FALSE here.
    draw('risk-time', RECORDS_A_SIZE)
    expect(unsetLine()?.textContent).toBe(RISK_EXPOSURE_UNSET_LINE)
    // The recorded magnitude is still on the card — the two coexist because they
    // are two facts, not one (CLAUDE.md trap 21).
    expect(screen.queryByTestId('risk-recorded-value')).toBeTruthy()

    const TOTALISING = /\b(nothing|no data|empty|blank)\b/i
    expect(TOTALISING.test('Nothing recorded yet.'), 'the totalising detector never fires').toBe(true)
    expect(RISK_EXPOSURE_UNSET_LINE).not.toMatch(TOTALISING)
  })

  // ── 7. Derived from the register, never re-typed ──────────────────────────
  it('⭐ THE WORDS COME FROM `METRIC_UNSET`, BY REFERENCE', () => {
    // The same three words already declare an unset bridge strength two rows up
    // on this very card. Two hand-typed copies on one card is the mirror this
    // estate keeps paying for (CLAUDE.md trap 12).
    expect(RISK_EXPOSURE_UNSET_LINE).toContain(METRIC_UNSET.inline)

    const src = readFileSync(resolve(__dirname, '../RiskNode.tsx'), 'utf8')
    // (a) composed from the register…
    expect(src).toMatch(/RISK_EXPOSURE_UNSET_LINE\s*=\s*`[^`]*\$\{METRIC_UNSET\.inline\}/)
    // (b) …and the phrase is nowhere re-typed as a literal beside it. Comments
    //     are stripped first: this file's own header quotes the sentence, and a
    //     guard that reds on its own documentation teaches the next author to
    //     delete the documentation.
    const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const retyped = new RegExp(`['"\`][^'"\`]*${METRIC_UNSET.inline}`, 'i')
    expect(retyped.test(codeOnly), `"${METRIC_UNSET.inline}" is re-typed as a literal in RiskNode`).toBe(false)
    // (c) …and the literal detector itself fires, or (b) passed by testing
    //     nothing. Same control `metricVocabulary.spec.ts` carries, same reason.
    expect(retyped.test(`const x = 'Likelihood and impact ${METRIC_UNSET.inline}.'`)).toBe(true)
  })

  // ── 8. On the face, not behind a hover ────────────────────────────────────
  it('⚠ THE SENTENCE RENDERS IN LAYER 1, asserted at the source because jsdom cannot see it', () => {
    // CLAUDE.md trap 3: a mounted element proves presence, never visibility, and
    // this card's own history is full of content that "passed" while sitting
    // inside a closed `NodePopover` returning null. The honest instrument for
    // "is it on the face" is where the render site sits, so that is what is
    // asserted — and it is declared as the weaker claim it is.
    const src = readFileSync(resolve(__dirname, '../RiskNode.tsx'), 'utf8')
    const layer1 = src.indexOf('LAYER 1: Standard body')
    const layer2 = src.indexOf('LAYER 2: Detailed inline')
    const site = src.indexOf('{riskExposureLine}')
    expect(layer1, 'the LAYER 1 marker moved or was renamed').toBeGreaterThan(-1)
    expect(layer2, 'the LAYER 2 marker moved or was renamed').toBeGreaterThan(-1)
    expect(site).toBeGreaterThan(layer1)
    expect(site).toBeLessThan(layer2)
  })
})
