/**
 * ⭐⭐ A STALE RUN'S INFLUENCE FIGURE AND RANK ARE LABELLED "LAST RUN", NEVER
 * WITHHELD — ON EVERY MOUNTED SURFACE THAT SHOWS ONE.
 *
 * Paul's Ruling 3 (ROADMAP 2.651, quoted at
 * `components/results/analysisState/analysisStateContract.ts`): "out-of-date
 * results are labelled, not withheld … No dimming, no aria-disabled lockout".
 * And the no-hiding ruling as it applies to THIS figure
 * (`influenceScaleCopy.ts`, `influenceRankExplanation`): taking the figure away
 * from a reader who wants it would be hiding a finding.
 *
 * Goal criterion 1: no rank, confidence or similar semantic claim appears
 * unless the underlying analysis state supports it. A factor card that says
 * `Key driver 1` or `Influence 62%` about a model the user has since edited is
 * that claim — so it keeps the figure and SAYS which run it belongs to, exactly
 * as the option card's `Last run · Most supported` pill already does.
 *
 * ⚠ THE PREDICATE IS `useAnalysisTrust().semantic === 'changed'`, NOT
 * `!useAnalysisResultsAreCurrent()`. The latter's `false` pools changed with
 * cannot-confirm / none / never-run, and its own docblock forbids a
 * "the graph has changed" message on it. So every stale case below is
 * precondition-checked against the REAL composed verdict (nothing about
 * freshness is mocked), and a cannot-confirm case pins that the label does NOT
 * fire there.
 *
 * ⭐ DESIGN INTEGRATION (23 Sep 2026): re-pointed from the surfaces #1891 was
 * written against (the `Relative influence` row, the `Key driver N` badge and
 * the bare `Influence N%` reduced line — all retired by the locked node-card
 * design, #1915) to the surfaces that now carry the same figure: the factor
 * card's `FactorDriverLine` (face + Detailed), its turning-point track and its
 * reduced line ("Driver N of M analysed", ED #63 5806207128). The RULE is unchanged:
 * `changed` → shown and labelled; cannot-confirm → not labelled. Under the
 * locked design cannot-confirm also HIDES the analysis cues (spec §8), which
 * is ED 02:31Z Q2's "never manufacture a last-run claim".
 *
 * ⛔ CONTRACT v3.1 pt 5 (24 Sep 2026): the driver line is RANKED-ONLY. Its
 * wording is ED #63 5806207128's "Driver N of M analysed" (M = the eligible
 * analysed factors; stale form "Last run · Driver N of M analysed"), which
 * retired pt 5's "ranked in this run". An unranked factor has no line to label;
 * its AT-only "Not ranked in this run" statement carries the same label rule
 * ("Last run · Not ranked").
 *
 * ⚠ WHAT THIS CANNOT PROVE (jsdom): layout. The label is inline text in
 * columns that are `shrink-0`, so it takes width from the bar beside it and
 * cannot add a line to the card by construction — but that is a reading of the
 * classes, not a measurement.
 *
 * ⭐ RE-POINTED FOR THE BOUNDED ANATOMY (ED #63 5809278282, 24 Sep): "any stale
 * run-derived figure shown on-card or in disclosure keeps `Last run ·`". The
 * Standard driver line and turning point moved into the factor's popover, so
 * their label rule is pinned THERE (bound by the popover's test id, and absent
 * from the card face); absences are document-wide and so cover the popover.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { OptionNode } from '../OptionNode'
import { ImportanceBar } from '../../ui/inspector-v2/shared/ImportanceBar'
import { useCanvasStore } from '../../store'
import { useAnalysisTrust } from '../../hooks/useAnalysisTrust'
import { LAST_RUN_PREFIX } from '../shared/metricVocabulary'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

/**
 * Only the display model is supplied — the influence derivation is its own
 * owner's question and is pinned elsewhere. Freshness is NOT mocked: every
 * label decision below runs through the real store and the real composed
 * verdict.
 */
let displayMetadata: Record<string, unknown> = {}
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => displayMetadata),
}))

// ED 5809278282: the Standard findings live in the popover — transparent and
// identity-bearing, so its content is observable and absences cover it.
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="factor-node-popover">{children}</div>
  ),
}))
/** A Standard finding: ON the card face, never repeated in the popover (prototype, Paul 25 Sep; superseding ED 5809278282). The helper keeps its name. */
const inPopover = (testId: string) => {
  const face = screen.getByTestId('node-title').closest('[role="group"]') as HTMLElement
  const pop = screen.queryByTestId('factor-node-popover')
  if (pop) expect(within(pop).queryByTestId(testId), `${testId} is repeated in the popover`).toBeNull()
  return within(face).getByTestId(testId)
}
/** A NON-top factor's found turning point: still in the popover, never on the face (ED 5809278282; unchanged by the prototype). */
const inThePopoverOnly = (testId: string) => {
  const face = screen.getByTestId('node-title').closest('[role="group"]') as HTMLElement
  expect(within(face).queryByTestId(testId), `${testId} is on the card face`).toBeNull()
  return within(screen.getByTestId('factor-node-popover')).getByTestId(testId)
}

const FACTOR_ID = 'fac_hiring_speed'
const OTHER_FACTOR_ID = 'fac_delivery_capacity'

/** No stated value, so the reduced line reaches its INFLUENCE arm. */
const UNVALUED = { label: 'Hiring speed', type: 'factor', category: 'external' }
/** A human-stated value — not run-derived, so it must never be labelled. */
const USER_STATED = {
  label: 'Hiring speed',
  type: 'factor',
  category: 'controllable',
  display_value: '0.4',
  observedState: { value: 0.4, source: 'user_override' },
}

const metadata = (
  rank: number | null,
  setSize: number | null,
  influence: number,
  // The ranked count — the publication guard, distinct from the printed M (the
  // analysed set, ED #63 5806207128).
  rankedCount: number | null = 3,
) => ({
  sensitivityRank: rank,
  influence,
  influenceProvenance: 'normalised_elasticity',
  influenceImportanceBasis: null,
  influenceSetSize: setSize,
  influenceRankedCount: rankedCount,
  confidence: null,
  confidenceIsDefaulted: false,
  confidenceIsProvisional: false,
  inSensitivityAnalysis: true,
  achievementProbability: null,
  achievementProbabilityIsModelledBasis: false,
  stabilityPercentage: null,
  winRate: null,
  isResultsMode: true,
  predictedOutcome: null,
  valueOfInformation: null,
  voiRank: null,
})

const FRESH_VERDICT = {
  freshness: 'fresh', freshnessReason: 'graph_hash_match',
  computedAt: '2026-09-22T00:00:00.000Z',
}

/** A completed run, exactly as `OptionNode.currentness.spec.tsx` seeds one. */
const seedCompletedRun = (
  nodeData: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) => {
  useCanvasStore.setState({
    nodes: [
      { id: FACTOR_ID, type: 'factor', position: { x: 0, y: 0 }, data: nodeData },
      { id: OTHER_FACTOR_ID, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Delivery capacity', type: 'factor' } },
    ],
    edges: [], ceeAnalysisReady: null, viewMode: 'standard', lodRung: 'full',
    analysisStateV1: null, analysisFreshness: FRESH_VERDICT, analysisFreshnessDirty: false,
    importPendingServerRegistration: false, currentScenarioId: 'stale-run-scenario',
    v5AnalysisFact: {
      scenarioId: 'stale-run-scenario', analysisHash: 'last-run', hasRunAnalysisFact: true,
    },
    hasCompletedFirstRun: true,
    results: { status: 'complete', hash: 'last-run', report: {
      option_probabilities: {
        opt_a: { status: 'computed', win_probability: 0.72 },
        opt_b: { status: 'computed', win_probability: 0.28 },
      },
      robustness: { near_tie: { is_tie: false, top_option_id: 'opt_a' } },
      flip_thresholds: [
        { node_id: FACTOR_ID, label: 'Hiring speed', current_value: 8, flip_value: 6.5, unit: '%', flip_reason: 'found', value_scale: 'display' },
      ],
    } },
    ...extra,
  } as never)
}

/** The local edit that makes the composed verdict 'changed' (real store path). */
const editTheModel = () => act(() => useCanvasStore.setState({ analysisFreshnessDirty: true }))

/** Precondition probe: the REAL composed verdict, rendered where a test can read it. */
function TrustProbe() {
  return <span data-testid="trust-probe" data-semantic={useAnalysisTrust().semantic} />
}

const renderFactor = (nodeData: Record<string, unknown>) =>
  render(
    <ReactFlowProvider>
      <TrustProbe />
      <FactorNode
        id={FACTOR_ID} type="factor" data={nodeData as never} selected={false}
        isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
        dragging={false} zIndex={0} deletable selectable draggable
      />
    </ReactFlowProvider>,
  )

const semantic = () => screen.getByTestId('trust-probe').getAttribute('data-semantic')

beforeEach(() => {
  displayMetadata = metadata(null, null, 0.62)
})

afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false,
    v5AnalysisFact: null, results: { status: 'idle', report: null }, lodRung: 'full',
    viewMode: 'standard',
  } as never)
})

describe('factor card, Standard view — the driver line', () => {
  // ⛔ SUPERSEDED BY CONTRACT v3.1 pt 5 (was: the unranked line "Outcome
  // sensitivity" + bar, labelled on a stale run). An unranked factor shows no
  // line; its AT-only statement follows the same label rule.
  it('an UNRANKED factor: "Not ranked in this run", and on a stale run "Last run · Not ranked" — never a line', () => {
    seedCompletedRun(UNVALUED)
    renderFactor(UNVALUED)
    expect(semantic()).toBe('current')
    expect(screen.queryByTestId('factor-driver-line')).toBeNull()
    expect(screen.getByTestId('factor-driver-not-ranked').textContent).toBe('Not ranked in this run')

    editTheModel()
    expect(semantic()).toBe('changed')
    expect(screen.queryByTestId('factor-driver-line')).toBeNull()
    expect(screen.getByTestId('factor-driver-not-ranked').textContent).toBe('Last run · Not ranked')
  })

  it('a stale RANKED line keeps its rank and labels it — the retired "Key driver" badge’s rule, on the line that replaced it', () => {
    displayMetadata = metadata(1, 5, 1)
    seedCompletedRun(UNVALUED)
    renderFactor(UNVALUED)
    expect(semantic()).toBe('current')
    expect(inPopover('factor-driver-line-caption').textContent).toBe('Driver 1 of 5 analysed')

    editTheModel()
    expect(semantic()).toBe('changed')
    // Contract v3.1 pt 5 stale form: "Last run · Driver N of M ranked".
    expect(inPopover('factor-driver-line-caption').textContent).toBe('Last run · Driver 1 of 5 analysed')
    // Label in Name (WCAG 2.5.3): the visible string opens the spoken one.
    expect(inPopover('factor-driver-line').getAttribute('aria-label')).toMatch(/^Last run · Driver 1 of 5 analysed\. /)
    // The badge stays retired on the stale arm too.
    expect(screen.queryByTestId(`sensitivity-rank-${FACTOR_ID}`)).toBeNull()
  })

  it('a fresh RANKED line is unchanged — the label never touches a current result', () => {
    displayMetadata = metadata(1, 5, 1)
    seedCompletedRun(UNVALUED)
    renderFactor(UNVALUED)
    expect(semantic()).toBe('current')
    expect(inPopover('factor-driver-line-caption').textContent).toBe('Driver 1 of 5 analysed')
  })

  it('cannot-confirm is NOT "changed" — no Last-run label, and no analysis cue (ED 02:31Z Q2)', () => {
    seedCompletedRun(UNVALUED, {
      analysisFreshness: { ...FRESH_VERDICT, freshness: 'unknown', freshnessReason: 'cee_unknown' },
    })
    renderFactor(UNVALUED)
    expect(semantic()).toBe('cannot_confirm')
    // Positive control: the card mounted.
    expect(screen.getByTestId('node-title')).toBeTruthy()
    expect(screen.queryByTestId('factor-driver-line')).toBeNull()
    expect(document.body.textContent).not.toContain('Last run')
  })
})

describe('factor card — the turning-point track', () => {
  it('a stale run keeps the track and labels it "Last run · " (Paul 23 Sep point 3 direction sentence)', () => {
    seedCompletedRun(UNVALUED)
    renderFactor(UNVALUED)
    expect(semantic()).toBe('current')
    // This factor is not ranked (not the top driver), so its found turning point
    // stays in the popover under the prototype too.
    expect(inThePopoverOnly('factor-turning-point').textContent).toMatch(/^Below 6\.5%, the current model comparison changes\./)

    editTheModel()
    expect(semantic()).toBe('changed')
    const tp = inThePopoverOnly('factor-turning-point')
    expect(tp.textContent).toMatch(/^Last run · Below 6\.5%, the model comparison changes\./)
    expect(tp.getAttribute('aria-label')).toMatch(/^Last run · Below 6\.5%, the model comparison changes\. /)
  })
})

describe('factor card, Detailed view — the Detailed driver line', () => {
  it('a stale run keeps the line and labels its caption and accessible name', () => {
    // Contract v3.1 pt 5: the line is ranked-only, so this pins the ranked arm.
    displayMetadata = metadata(1, 5, 1)
    seedCompletedRun(UNVALUED, { viewMode: 'expert' })
    renderFactor(UNVALUED)
    expect(semantic()).toBe('current')
    expect(screen.getByTestId('factor-driver-line-detail-caption').textContent).toBe('Driver 1 of 5 analysed')

    editTheModel()
    expect(semantic()).toBe('changed')
    expect(screen.getByTestId('factor-driver-line-detail-caption').textContent).toBe('Last run · Driver 1 of 5 analysed')
    expect(screen.getByTestId('factor-driver-line-detail').getAttribute('aria-label')).toMatch(/^Last run · /)
  })
})

describe('factor card, below the legibility floor — the reduced line', () => {
  it('a stale run prefixes the driver line', () => {
    displayMetadata = metadata(1, 5, 1)
    seedCompletedRun(UNVALUED, { lodRung: 'line' })
    renderFactor(UNVALUED)
    expect(semantic()).toBe('current')
    expect(screen.getByTestId('node-lod-line-text').textContent).toBe('Driver 1 of 5 analysed')

    editTheModel()
    expect(semantic()).toBe('changed')
    expect(screen.getByTestId('node-lod-line-text').textContent).toBe('Last run · Driver 1 of 5 analysed')
    expect(screen.getByTestId('node-lod-line').getAttribute('title')).toBe('Last run · Driver 1 of 5 analysed')
  })

  it('a human-stated value is NOT run-derived and is never labelled', () => {
    seedCompletedRun(USER_STATED, { lodRung: 'line' })
    renderFactor(USER_STATED)
    editTheModel()
    expect(semantic()).toBe('changed')
    const line = screen.getByTestId('node-lod-line-text').textContent ?? ''
    expect(line).toBe('0.4')
    expect(line).not.toContain('Last run')
  })
})

describe('inspector — ImportanceBar (the one renderer all four panels mount)', () => {
  it('a stale run keeps the ordinal and percentage and labels the caption', () => {
    seedCompletedRun(UNVALUED)
    render(<><TrustProbe /><ImportanceBar importanceScore={0.62} sensitivityRank={1} influenceProvenance="normalised_elasticity" /></>)
    expect(semantic()).toBe('current')
    const bar = screen.getByTestId('importance-bar')
    expect(bar.textContent).toBe('1st62%Influence on results')

    editTheModel()
    expect(semantic()).toBe('changed')
    expect(screen.getByTestId('importance-bar').textContent).toBe('1st62%Last run · Influence on results')
  })
})

describe('wording parity with the option card', () => {
  /**
   * ⭐ RE-POINTED (ED #63 5799353114 decision 1, "Drop 'Most supported'"): the
   * option card's `Last run · Most supported` pill — the string this prefix was
   * first lifted from — is retired. The card still carries `Last run` on a
   * changed run, on its result row, and that row's accessible name is
   * `Last run · N% of runs. …`. Parity is therefore pinned against the row:
   * one wording for one state across the factor and option cards.
   */
  it('the shared prefix is the exact string the option card\'s result row renders on a changed run — and no pill carries it', () => {
    const option = { label: 'Try a smaller pilot', type: 'option' }
    // The option card reads its win share off the display model (mocked in
    // this file); the leader itself comes from the real report verdict.
    displayMetadata = { ...metadata(null, null, 0), sensitivityRank: null, influence: null, influenceProvenance: null, winRate: 0.72 }
    seedCompletedRun(UNVALUED, {
      nodes: [
        { id: 'opt_a', type: 'option', position: { x: 0, y: 0 }, data: option },
        { id: 'opt_b', type: 'option', position: { x: 0, y: 0 }, data: option },
      ],
    })
    const { container } = render(<ReactFlowProvider><OptionNode
      id="opt_a" type="option" data={option as never} selected={false}
      isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
      dragging={false} zIndex={0} deletable selectable draggable
    /></ReactFlowProvider>)
    editTheModel()
    expect(LAST_RUN_PREFIX).toBe('Last run · ')
    // The row's visible caption is the prefix's word, and its accessible name
    // opens with the prefix byte for byte — the same string the factor card uses.
    expect(`${screen.getByTestId('option-win-anchor-opt_a').textContent} · `).toBe(LAST_RUN_PREFIX)
    expect(screen.getByTestId('option-analysis-currency-opt_a').getAttribute('aria-label'))
      .toMatch(new RegExp(`^${LAST_RUN_PREFIX}72% of runs\\. `))
    // …and the retired pill does not come back carrying it (this card IS the
    // producer's named leader — the strongest case). Contrast: the row above.
    expect(screen.queryByTestId('leading-option-pill-opt_a')).toBeNull()
    expect(container.textContent ?? '').not.toMatch(/most supported/i)
  })
})
