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
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { NodeProps } from '@xyflow/react'
import { ReactFlowProvider } from '@xyflow/react'
import { RiskNode, RISK_EXPOSURE_UNSET_LINE } from '../RiskNode'
import { METRIC_UNSET } from '../shared/metricVocabulary'
import { useGuidanceStore } from '../../stores/guidanceStore'

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
 *
 * (`exposureLine()` read `risk-exposure-line`'s whole textContent; that element
 * now holds two carriers, so the reads below replace it.)
 */
/**
 * ⚠ RE-POINTED FOR ED #63 5809278282 (24 Sep 2026, bounded anatomy: "title + one
 * primary line … Outcome/Risk = state"). The Standard line now carries TWO
 * texts: the short form a sighted reader sees (`aria-hidden`) and the whole
 * sentence announced with no interaction (`sr-only`, bound by testid) — and the
 * same sentence rides `title` and the popover. These read each carrier by
 * identity, so the claims below stay about the WHOLE line, never a fragment.
 */
const shownOn = (el: Element | null) => el?.querySelector('[aria-hidden="true"]')?.textContent ?? null
const announcedLine = () => screen.queryByTestId('risk-primary-line-full')?.textContent ?? null
const sizingChip = () => screen.queryByRole('button', { name: 'How likely is this?' })
const indicatorChip = () => screen.queryByRole('button', { name: 'What would we see first?' })
/** The card's ONE coaching affordance (locked Canvas design), bound by node identity. */
const coachingIcon = (id: string) => screen.queryByTestId(`node-coaching-icon-${id}`)
/** `a` sits before `b` in document order — "leads" as a DOM fact, not a guess. */
const precedes = (a: Element, b: Element) =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
/** Opens the REAL (unmocked) popover the way a pointer does: hover the node wrapper. */
const hoverCard = (container: HTMLElement) => fireEvent.mouseEnter(container.firstElementChild as Element)

describe('a thin risk card says the MODEL is thin', () => {
  beforeEach(() => {
    cleanup(); vi.clearAllMocks()
    // Locked Canvas design (23 Sep 2026): the rail coaching icon renders only when
    // an ask surface is registered (`canReceiveAsk`), as it is in the product.
    useGuidanceStore.setState({ _prefillChat: vi.fn(), _sendMessage: vi.fn(), _dispatchAction: vi.fn(), guidanceItems: [] } as never)
  })

  // ── 1. The target ────────────────────────────────────────────────────────
  it('⭐ RED-FIRST: a risk with no likelihood and no impact says so, on the card', () => {
    draw('risk-gdpr', UNSIZED)
    // Bound by identity to the exported constant, never a substring predicate:
    // a `toContain('not set')` would also pass against the bridge-strength row
    // two lines up, which says the same three words about a DIFFERENT fact.
    // Contract v3.1 (DESIGN-GAP-v31 #34): on the card the sentence is announced
    // in full AND shown in full (was ED 5809278282's short form); the element
    // is the unset line.
    expect(announcedLine()).toBe(RISK_EXPOSURE_UNSET_LINE)
    expect(unsetLine()?.contains(screen.getByTestId('risk-primary-line-full'))).toBe(true)
    expect(shownOn(unsetLine())).toBe(RISK_EXPOSURE_UNSET_LINE)
  })

  // ── 2. The contrast case — without this, test 1 is satisfied by a constant ─
  it('⛔ THE GUARD, NOT A CONSTANT: a risk carrying BOTH halves says nothing of the kind', () => {
    draw('risk-migration', SIZED)
    expect(unsetLine()).toBeNull()
    // …and the readout it DOES carry is unchanged, so this is a silence for the
    // right reason rather than a card that quietly lost its row. Asserting the
    // WHOLE line, not a fragment: a card rendering "Entered estimate · " and
    // nothing else would satisfy a fragment match on either half.
    // ED 5809278282: the figures are shown whole; the qualified sentence is announced whole.
    expect(shownOn(screen.getByTestId('risk-exposure-line'))).toBe('40% likely · High impact')
    expect(announcedLine()).toBe('Entered estimate · 40% likely · High impact')
  })

  // ── 3. The identity discriminator — kills the `severity == null` mutant ────
  it('⛔ A HALF-SIZED RISK IS NOT A THIN ONE: likelihood alone still silences the line', () => {
    draw('risk-overload', LIKELIHOOD_ONLY)
    // `calculateRiskSeverity` returns null here — both halves are required — so
    // an implementation keyed on `severity` would wrongly claim nothing is set
    // on a card that plainly records a 40% likelihood.
    expect(unsetLine()).toBeNull()
    expect(shownOn(screen.getByTestId('risk-exposure-line'))).toBe('40% likely')
    expect(announcedLine()).toBe('Entered estimate · 40% likely')
  })

  it('⛔ AND ITS OPPOSITE-DIRECTION TWIN: impact alone silences it too', () => {
    // Written because a predicate guarding two opposite harms cannot be
    // certified by cases that all point one way (CLAUDE.md trap 22b). If the
    // implementation ever becomes `probability == null` alone, this REDs and
    // the test above stays green — which is the discrimination.
    draw('risk-lockin', IMPACT_ONLY)
    expect(unsetLine()).toBeNull()
    expect(shownOn(screen.getByTestId('risk-exposure-line'))).toBe('High impact')
    expect(announcedLine()).toBe('Entered estimate · High impact')
  })

  // ── 4. The next-step half moves in step with the diagnosis ────────────────
  //
  // Locked Canvas design (23 Sep 2026): ED 11:52Z point 5 — no coaching chips on
  // the card face; the ONE rail coaching icon asks the card's first question
  // ("What would we see first?"). ED 02:31Z D4 — "How likely is this?" is MOVED,
  // NOT DELETED: it now LEADS the popover and Detailed, under the same thin-card
  // predicate. So "in step with the sentence" is asserted at its new homes, and
  // its absence on the face is asserted in the same render.
  it('⭐ THE COACHING HALF: the sizing question appears exactly where the sentence does', async () => {
    const { container } = draw('risk-gdpr', UNSIZED)
    // Face: not a chip any more…
    expect(sizingChip()).toBeNull()
    // …and the leading indicator (ADDED, NOT SWAPPED) survives as the ONE icon —
    // the only control on the face carrying that name, so no face chip remains.
    const faceAsks = screen.getAllByRole('button', { name: 'What would we see first?' })
    expect(faceAsks).toHaveLength(1)
    expect(faceAsks[0]).toBe(coachingIcon('risk-gdpr'))

    // Popover (the real one, opened by hover): the sizing question is there and LEADS.
    hoverCard(container)
    const inPopover = await screen.findByRole('button', { name: 'How likely is this?' })
    expect(precedes(inPopover, screen.getByRole('button', { name: 'What reduces this?' }))).toBe(true)
    cleanup()

    // Detailed: the same, inline.
    draw('risk-gdpr', UNSIZED, { viewMode: 'expert' })
    const inDetailed = sizingChip()
    expect(inDetailed).toBeTruthy()
    expect(precedes(inDetailed!, screen.getByRole('button', { name: 'What reduces this?' }))).toBe(true)
  })

  it('⛔ AND IT IS ABSENT ON A SIZED RISK, so the chip is a response and not wallpaper', async () => {
    // Locked Canvas design (23 Sep 2026): re-pointed to the question's new homes
    // (popover + Detailed, ED 02:31Z D4); each absence carries a positive control
    // in the same render proving that surface's chips DID render.
    const { container } = draw('risk-migration', SIZED)
    expect(sizingChip()).toBeNull()
    // The leading indicator still stands on a sized risk — as the ONE icon, the
    // only control on the face carrying that name.
    expect(indicatorChip()).toBe(coachingIcon('risk-migration'))
    expect(indicatorChip()).toBeTruthy()

    hoverCard(container)
    expect(await screen.findByRole('button', { name: 'What reduces this?' })).toBeTruthy()
    expect(sizingChip()).toBeNull()
    cleanup()

    draw('risk-migration', SIZED, { viewMode: 'expert' })
    expect(screen.getByRole('button', { name: 'What reduces this?' })).toBeTruthy()
    expect(sizingChip()).toBeNull()
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
    // ED 5809278282: the recorded magnitude IS the one line; the unset sentence
    // rides that line's sr-only copy and title (and the popover) — two facts,
    // not one (CLAUDE.md trap 21), and the bare "Not set yet" is never SHOWN
    // beside a value the card holds.
    const row = screen.getByTestId('risk-recorded-value')
    expect(screen.getByTestId('risk-recorded-readout').textContent).toBe('12 months')
    expect(announcedLine()).toBe(RISK_EXPOSURE_UNSET_LINE)
    expect(row.contains(screen.getByTestId('risk-primary-line-full'))).toBe(true)
    expect(row.getAttribute('title')).toBe(`12 months · ${RISK_EXPOSURE_UNSET_LINE}`)
    expect(unsetLine()).toBeNull()

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
