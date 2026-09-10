/**
 * ⭐⭐ THE WITHHELD-EXPLANATION SLOT TELLS THE READER WHAT TO DO, AND ITS ONLY
 * CONTROL HANDED THAT INSTRUCTION TO A CHAT DRAFT.
 *
 * On the live capture the producer's sentence ends "…until you have set at least
 * one of them". The editor that sets a value is shipped, working, and one tab
 * away (`model-row-v2-<id>-value` → "Review change" → "Confirm"), and the slot's
 * only adjacent affordance — `analysis-new-glance-primary-intervention` — opens
 * `ask-olumi-drawer` with a pre-filled draft and a Send button. A compose surface
 * is not an editable control. This spec pins the link.
 *
 * ## WHAT IS BEING GUARDED, AND WHY EACH GUARD EXISTS
 *
 * ⛔ THE UI MUST NOT CHOOSE THE FACTOR. CEE's `comparisonSubstrate` computes the
 * material set and discards it; the wire carries only COUNTS. So the factor comes
 * from the producer's own intervention hint (`Recommendation.targetId`, the same
 * object behind the primary-intervention card). A UI-side materiality rule would
 * be a second authority for one question.
 *
 * ⛔ BUT `targetId` IS NOT RELIABLY A FACTOR. `buildRecommendations.ts` fills it
 * from four sources, and `:543` is `top.edgeId` — an EDGE. `focusModelTarget`
 * resolves an edge happily and returns `true`, so an unguarded control would
 * switch the tab, report success, and land the reader in the factors section
 * with no editor open. That is the false promise `utils/focusOnCanvasCopy.ts`
 * bans. The edge case below is the one that would ship the defect.
 *
 * ## ⚠ BINDING IS BY IDENTITY, NEVER BY MESSAGE TEXT
 *
 * `reasons[1]` and `reasons[2]` carry IDENTICAL message strings on the live wire
 * (see `refusalIsLegible.spec.tsx`), so a text-based assertion can pass on the
 * wrong object — trap 19. Every assertion here binds to the exact node id, and
 * the graph carries a SECOND factor so that "targets the wrong node" is a
 * distinguishable state rather than an indistinguishable one.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { AtAGlance } from '../sections/AtAGlance'
import { resolveWithheldValueTarget } from '../resolveWithheldValueTarget'
// ⚠ Legal in a SPEC only — see the coupling guard below for why.
import { nodeKind } from '../../../../canvas/model-tab-v2/adapters'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { decisionWithLeaderWithheld } from './analysisNewFixtures'

/**
 * The live refusal, verbatim from the capture `refusalIsLegible.spec.tsx`
 * documents (staging `103ac4fd`, fresh guest, 2026-09-09). NOT a paraphrase: a
 * hand-written stand-in would encode this author's model of the producer rather
 * than the producer.
 */
const CAPTURED_REFUSAL = {
  structurally_analysable: true,
  missing_important_inputs: [],
  semantic_quality_sufficient: false,
  permitted_analysis_mode: 'quantified_provisional',
  reasons: [
    {
      field: 'structurally_analysable',
      code: 'READY_TO_COMPARE',
      message: 'Analysis can run on this model as it stands.',
    },
    {
      field: 'semantic_quality_sufficient',
      code: 'CONFIDENCE_PARAMETERS_ALL_MACHINE_AUTHORED',
      message:
        'Every estimate this comparison rests on is Olumi’s, not yours. Figures can be shown as provisional, but no option can be called the leader and no result can be called stable or robust until you have set at least one of them.',
    },
    {
      field: 'permitted_analysis_mode',
      code: 'CONFIDENCE_PARAMETERS_ALL_MACHINE_AUTHORED',
      message:
        'Every estimate this comparison rests on is Olumi’s, not yours. Figures can be shown as provisional, but no option can be called the leader and no result can be called stable or robust until you have set at least one of them.',
    },
  ],
}

const REMEDY = CAPTURED_REFUSAL.reasons[2].message

/** The producer's target, and a DECOY factor so "wrong node" is observable. */
const PRODUCER_FACTOR_ID = 'fac_price_increase'
const DECOY_FACTOR_ID = 'fac_headcount'

const NODES = [
  { id: PRODUCER_FACTOR_ID, type: 'factor', data: { label: 'Price increase' } },
  { id: DECOY_FACTOR_ID, type: 'factor', data: { label: 'Headcount' } },
  { id: 'goal_1', type: 'goal', data: { label: 'Grow revenue' } },
  { id: 'edge_9', type: 'edge', data: { label: 'Price drives revenue' } },
]

const withAdmission = (
  data: ResultsSectionDataReturn,
  admission: unknown,
): ResultsSectionDataReturn =>
  ({
    ...data,
    recommendation: { ...data.recommendation, analysisAdmission: admission },
  }) as ResultsSectionDataReturn

const glanceOf = (data: ResultsSectionDataReturn) =>
  buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
  }).atAGlance

const renderGlance = (
  target: { nodeId: string; label: string } | null,
  onReview: ((nodeId: string) => void) | undefined,
) => {
  const data = withAdmission(decisionWithLeaderWithheld(), CAPTURED_REFUSAL)
  // ⚠ PRECONDITION PINNED IN-TEST. If this fixture stopped withholding, every
  // assertion below would be about a state the surface never reaches — a
  // tautology with no red anywhere.
  const glance = glanceOf(data)
  expect(glance.designationWithheldReason, 'fixture no longer withholds').toBe(REMEDY)
  render(
    <AtAGlance
      glance={glance}
      isRunning={false}
      reanalyseBlocked={false}
      reanalyseBlockedReason={null}
      onReanalyse={vi.fn()}
      withheldValueTarget={target}
      onReviewWithheldValue={onReview}
    />,
  )
  return glance
}

afterEach(() => cleanup())

// ─────────────────────────────────────────────────────────────────────────────
describe('the target is the PRODUCER’S factor, and only when it is editable', () => {
  it('resolves the engine’s intervention target to a named factor', () => {
    expect(resolveWithheldValueTarget({ targetId: PRODUCER_FACTOR_ID }, NODES)).toEqual({
      nodeId: PRODUCER_FACTOR_ID,
      label: 'Price increase',
    })
  })

  /**
   * ⛔ THE ONE THAT WOULD HAVE SHIPPED THE DEFECT. `buildRecommendations.ts:543`
   * puts an EDGE id in `targetId`, and the factors section has no editor for it.
   */
  it('REFUSES an edge id, which the engine really does put in targetId', () => {
    expect(resolveWithheldValueTarget({ targetId: 'edge_9' }, NODES)).toBeNull()
  })

  it('REFUSES a goal node — only factor rows get a value editor', () => {
    expect(resolveWithheldValueTarget({ targetId: 'goal_1' }, NODES)).toBeNull()
  })

  it('REFUSES a target that is not on the graph, as focusModelTarget would', () => {
    expect(resolveWithheldValueTarget({ targetId: 'fac_vanished' }, NODES)).toBeNull()
  })

  it('REFUSES a recommendation carrying no target at all', () => {
    expect(resolveWithheldValueTarget({ targetId: null }, NODES)).toBeNull()
    expect(resolveWithheldValueTarget(null, NODES)).toBeNull()
  })

  /**
   * Fail closed rather than "Review the value for Unnamed element" — the label
   * is part of the guard, not decoration.
   */
  it('REFUSES a factor whose only label is an id in disguise', () => {
    const nodes = [{ id: 'fac_x', type: 'factor', data: { label: 'fac_x' } }]
    expect(resolveWithheldValueTarget({ targetId: 'fac_x' }, nodes)).toBeNull()
  })

  /**
   * ⭐ CONTRAST CONTROL. Every assertion above is a NULL, and a resolver that
   * returned null unconditionally would satisfy all of them. This is the probe
   * proving it discriminates: same function, same graph, a non-null answer.
   */
  it('contrast control: the refusals above are decisions, not blindness', () => {
    expect(resolveWithheldValueTarget({ targetId: DECOY_FACTOR_ID }, NODES)).toEqual({
      nodeId: DECOY_FACTOR_ID,
      label: 'Headcount',
    })
  })

  /**
   * ⭐⭐ THE COUPLING GUARD — the claim the whole design rests on, pinned rather
   * than argued in a comment.
   *
   * The resolver asks `resolveNodeTypeLiteral(node) === 'factor'`. The Model tab's
   * outline decides which rows exist with its OWN `nodeKind`, and only its
   * `factor` rows get a value editor. Those are two predicates, and the design is
   * only sound while they agree — `nodeKind` returns its input verbatim on the
   * `factor` arm of its switch, so they are equal by construction **today**. If
   * anyone narrows that arm, this module would start routing readers to rows the
   * outline no longer renders, and nothing else in the suite would notice.
   *
   * ⚠ WHY THIS IMPORT IS LEGITIMATE HERE AND ILLEGAL IN THE MODULE.
   * `modelTabV2Boundary.sourceScan.spec.ts` holds `model-tab-v2` to ONE outside
   * reference, and CI correctly rejected the module importing `nodeKind`. Its
   * `sourceFilesIn` walker excludes `__tests__` directories and every
   * `*.spec.ts(x)` file, so a SPEC may read the outline's resolver to prove
   * agreement while production code may not depend on it. That exclusion is what
   * lets the coupling be verified without creating a second mount path.
   *
   * ⚠ ASSERTED OVER A CORPUS SPANNING EVERY KIND ON THE GRAPH, not just the happy
   * one: a test that only checked the factor would pass while the two predicates
   * diverged on everything else.
   */
  it('agrees with the Model tab’s own kind resolver on every node kind', () => {
    for (const node of NODES) {
      const outlineSaysFactor = nodeKind(node) === 'factor'
      const resolverAccepts = resolveWithheldValueTarget({ targetId: node.id }, NODES) !== null
      // The resolver also demands an honest label, so it can only be NARROWER.
      // Equality holds on this corpus because every node here is honestly named —
      // pinned below so a fixture edit cannot quietly turn this into a weaker claim.
      expect(
        resolverAccepts,
        `disagreement on ${node.id}: outline factor=${outlineSaysFactor}, resolver=${resolverAccepts}`,
      ).toBe(outlineSaysFactor)
    }
    // ⚠ PRECONDITION: the corpus must actually contain both answers, or the loop
    // above is satisfied by a predicate that always returns the same thing.
    expect(NODES.filter(n => nodeKind(n) === 'factor').length).toBe(2)
    expect(NODES.filter(n => nodeKind(n) !== 'factor').length).toBe(2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('the withheld-reason slot offers a way to reach that value', () => {
  it('renders a control bound BY ID to the producer’s factor', () => {
    renderGlance({ nodeId: PRODUCER_FACTOR_ID, label: 'Price increase' }, vi.fn())
    const control = screen.getByTestId('analysis-new-glance-withheld-review-value')
    // ⚠ IDENTITY, NOT TEXT. Two factors are on the graph; a control pointing at
    // the other one would satisfy any "a control exists" assertion.
    expect(control).toHaveAttribute('data-target-node-id', PRODUCER_FACTOR_ID)
    expect(control).not.toHaveAttribute('data-target-node-id', DECOY_FACTOR_ID)
  })

  it('hands the click THAT node id, not merely some string', () => {
    const onReview = vi.fn()
    renderGlance({ nodeId: PRODUCER_FACTOR_ID, label: 'Price increase' }, onReview)
    fireEvent.click(screen.getByTestId('analysis-new-glance-withheld-review-value'))
    expect(onReview).toHaveBeenCalledTimes(1)
    expect(onReview).toHaveBeenCalledWith(PRODUCER_FACTOR_ID)
  })

  it('names the factor, so the reader knows which value they are going to', () => {
    renderGlance({ nodeId: PRODUCER_FACTOR_ID, label: 'Price increase' }, vi.fn())
    expect(screen.getByTestId('analysis-new-glance-withheld-review-value')).toHaveTextContent(
      'Price increase',
    )
  })

  it('renders NOTHING when no editable factor resolved — never a dead button', () => {
    renderGlance(null, vi.fn())
    expect(screen.getByTestId('analysis-new-glance-withheld-reason')).toBeInTheDocument()
    expect(
      screen.queryByTestId('analysis-new-glance-withheld-review-value'),
    ).not.toBeInTheDocument()
  })

  it('renders NOTHING when no handler is wired', () => {
    renderGlance({ nodeId: PRODUCER_FACTOR_ID, label: 'Price increase' }, undefined)
    expect(
      screen.queryByTestId('analysis-new-glance-withheld-review-value'),
    ).not.toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('the refusal is still said ONCE, and the control promises nothing', () => {
  it('the control adds no second statement of the refusal', () => {
    renderGlance({ nodeId: PRODUCER_FACTOR_ID, label: 'Price increase' }, vi.fn())
    const control = screen.getByTestId('analysis-new-glance-withheld-review-value')
    expect(control).not.toHaveTextContent(REMEDY)
    // The producer's sentence still appears in exactly one element.
    expect(screen.getAllByTestId('analysis-new-glance-withheld-reason')).toHaveLength(1)
  })

  /**
   * ⛔⛔ PAUL'S RULING, PINNED. "A user-entered value is not automatically
   * reliable evidence." The materiality floor means an edit can move
   * `confidence_parameters_user_stated` while `permitted_analysis_mode` stays
   * exactly where it is — so this control may offer to take the reader to the
   * value and may NEVER forecast what the edit achieves.
   *
   * ⚠ ASSERTED ON THE COPY CONSTANT, NOT ON THE RENDERED STRING, so the ban
   * survives the label being composed with a factor name at the call site.
   */
  it('makes no promise about the outcome of the edit', () => {
    const copy = COPY.glance.reviewWithheldValue.toLowerCase()
    for (const forbidden of [
      'enable',
      'unlock',
      'lift',
      'improve',
      'increase confidence',
      'will let',
      'so that',
      'leader',
      'winner',
      'beat',
      'win',
      'ahead',
      'rank',
    ]) {
      expect(copy, `"${forbidden}" forecasts an outcome or races the options`).not.toContain(
        forbidden,
      )
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
/**
 * ⚠ THE SILENT-DEGRADE GUARD, mirroring `reviewValueTargetsFactorsSection.spec.ts`.
 * `requestModelTabSection` takes a section NAME; `MODEL_SECTION_TARGET`'s consumer
 * coalesces a miss to `'model-tab-v2-panel'`, so passing the TESTID lands the
 * reader at the panel top with nothing selected — verbatim the failure this act
 * exists to avoid, and a failure that throws nothing. Both shipped precedents
 * made this mistake first. Membership of the DERIVED key set, never equality with
 * a string: a rename would satisfy equality while pointing nowhere.
 */
describe('the act deep-links to a REAL Model-tab section', () => {
  const CALLER = 'src/components/results/analysisNew/AnalysisNewTabBody.tsx'
  const MAP_HOST = 'src/canvas/components/ModelTabBody.tsx'
  const caller = readFileSync(CALLER, 'utf8')
  const host = readFileSync(MAP_HOST, 'utf8')

  it('both files are tracked and non-empty (positive control)', () => {
    for (const f of [CALLER, MAP_HOST]) {
      expect(execFileSync('git', ['ls-files', f], { encoding: 'utf8' }).trim()).toBe(f)
    }
    expect(caller.length).toBeGreaterThan(1000)
    expect(host.length).toBeGreaterThan(1000)
  })

  const sectionKeys = (): string[] => {
    const i = host.indexOf('const MODEL_SECTION_TARGET')
    expect(i, 'MODEL_SECTION_TARGET not found — renamed?').toBeGreaterThan(-1)
    const end = host.indexOf('\n}', i)
    expect(end, 'MODEL_SECTION_TARGET has no closing brace at column 0').toBeGreaterThan(i)
    return [...host.slice(i, end).matchAll(/^\s*([a-zA-Z][a-zA-Z0-9_]*)\s*:/gm)].map(m => m[1])
  }

  it('derives a plausible key set, and the testid is NOT one of them', () => {
    const keys = sectionKeys()
    expect(keys.length).toBeGreaterThanOrEqual(4)
    expect(keys).toContain('factors')
    expect(keys).not.toContain('model-group-v2-factors')
  })

  it('requests the factors section BY KEY', () => {
    const m = caller.match(/requestModelTabSection\(\s*'([^']+)'\s*\)/)
    expect(m, 'no literal requestModelTabSection call found').toBeTruthy()
    expect(sectionKeys()).toContain(m![1])
    expect(m![1]).toBe('factors')
  })

  /**
   * ⚠ THE TAB SWITCH MUST PRECEDE THE FOCUS — the order both shipped precedents
   * use, so the node resolves on the surface the reader is about to be looking
   * at. `focusModelTarget` acts on the CANVAS store and has no effect on the
   * outputs dock, so on its own it lands the reader nowhere useful.
   */
  it('switches to the Model tab BEFORE focusing the node', () => {
    const tab = caller.indexOf("setActiveOutputTab('diagnostics')")
    const section = caller.indexOf("requestModelTabSection('factors')")
    const focus = caller.indexOf('focusModelTarget(nodeId)')
    expect(tab, 'no tab switch in the act').toBeGreaterThan(-1)
    expect(section, 'no section request in the act').toBeGreaterThan(-1)
    expect(focus, 'no focus call in the act').toBeGreaterThan(-1)
    expect(tab).toBeLessThan(section)
    expect(section).toBeLessThan(focus)
  })
})
