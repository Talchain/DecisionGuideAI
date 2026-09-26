/**
 * ⭐⭐ THE RESTING FACTOR CARD MATCHES THE PROTOTYPE (Paul, 25 Sep 2026).
 *
 * Paul ruled, from live screenshots, that the canvas must match the prototype
 * (`olumi-canvas-connected-reference.png`; `olumi-canvas-visual-contract.html`
 * `nodeHTML`, factor branch), and that where Experience Design's bounded
 * anatomy (#63 5809278282, "title plus one primary line") conflicts with the
 * prototype's card bodies, THE PROTOTYPE WINS. The prototype's resting factor:
 *
 *   Trial conversion
 *   8%  trials convert                       ← figure + muted unit phrase
 *   Driver 1 of 3  ▬▬▬                       ← after a run, ranked factors
 *   Model comparison changes        6.5%     ← the TOP driver only
 *   ◆──────●──────                            (turning-point track)
 *
 *   Feature adoption (external)
 *   Working range                  25–45%    ← with a band
 *
 * What this file pins, in the STANDARD view, by identity (the card is
 * BaseNode's `role="group"` root holding `node-title`; the popover is the
 * mocked `NodePopover`'s own test id):
 *   · after a run, a RANKED factor's `factor-driver-line` is ON the card, below
 *     the value line — and not in the popover (never both);
 *   · the TOP driver's FOUND turning point is ON the card, below the driver
 *     line; a non-top factor's stays in the popover (contrast);
 *   · no driver line before a run (contrast);
 *   · an external factor's range line is ON the card with a band whose two
 *     ends are the line's own two numbers; no band once a user value replaces
 *     the range, and none for the producer's authored range prose (contrasts);
 *   · the body is identical at the `full` and `quiet` rungs (one geometry);
 *   · a currency-rate unit reads `£39,000/year`; other units are untouched.
 *
 * Harness from `FactorNode.boundedAnatomy.spec.tsx` (real store, real composed
 * run-currency verdict; only display metadata and the popover are doubled).
 *
 * CLAIM SCOPE: jsdom — strings, test ids and DOM containment/order. Not pixels.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { useCanvasStore } from '../../store'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, isGraphBadgesEnabled: () => true }
})

let displayMetadata: Record<string, unknown> = {}
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => displayMetadata),
}))

vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="factor-node-popover">{children}</div>
  ),
}))

const ID = 'fac_conversion'

const VALUED = {
  label: 'Trial conversion', type: 'factor', category: 'controllable',
  observedState: { value: 0.08, unit: '%', display_value: '8%', extractionType: 'inferred', source: 'cee_inference' },
}
/** External, percent prior, no value — the prototype's "Working range 25–45%". */
const RANGE_PCT = {
  label: 'Feature adoption', type: 'factor', category: 'external',
  observedState: { unit: '%' },
  prior: { distribution: 'uniform', range_min: 0.25, range_max: 0.45 },
}
/** External, unitless normalised prior — the existing "Range: 0.3 to 0.8" line. */
const RANGE_ONLY = {
  label: 'Feature adoption', type: 'factor', category: 'external',
  prior: { distribution: 'uniform', range_min: 0.3, range_max: 0.8 },
}

const metadata = (rank: number | null, setSize: number | null, rankedCount: number | null, influence: number) => ({
  sensitivityRank: rank,
  influence,
  influenceProvenance: 'influence_score',
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
const TOP = () => metadata(1, 3, 3, 1)
const SECOND = () => metadata(2, 3, 3, 0.6)
const UNRANKED = () => metadata(null, 3, 3, 0.12)

const FOUND_ROW = { node_id: ID, label: 'Trial conversion', current_value: 8, flip_value: 6.5, unit: '%', flip_reason: 'found', value_scale: 'display' }
const FRESH_VERDICT = { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: '2026-09-25T00:00:00.000Z' }

type Rung = 'full' | 'quiet'
const seed = (
  data: Record<string, unknown>,
  { phase, flipRows = [], viewMode = 'standard', lodRung = 'full' }:
    { phase: 'pre' | 'post'; flipRows?: unknown[]; viewMode?: 'standard' | 'expert'; lodRung?: Rung },
) => {
  useCanvasStore.setState({
    nodes: [{ id: ID, type: 'factor', position: { x: 0, y: 0 }, data }],
    edges: [], ceeAnalysisReady: null, viewMode, lodRung,
    goalConstraints: [],
    analysisStateV1: null, importPendingServerRegistration: false, currentScenarioId: 'prototype-body',
    ...(phase === 'post'
      ? {
          analysisFreshness: FRESH_VERDICT, analysisFreshnessDirty: false,
          v5AnalysisFact: { scenarioId: 'prototype-body', analysisHash: 'run-1', hasRunAnalysisFact: true },
          hasCompletedFirstRun: true,
          results: { status: 'complete', hash: 'run-1', report: {
            option_probabilities: {
              opt_a: { status: 'computed', win_probability: 0.6 },
              opt_b: { status: 'computed', win_probability: 0.4 },
            },
            robustness: { near_tie: { is_tie: false, top_option_id: 'opt_a' } },
            flip_thresholds: flipRows,
          } },
        }
      : {
          analysisFreshness: null, analysisFreshnessDirty: false, v5AnalysisFact: null,
          hasCompletedFirstRun: false, results: { status: 'idle', report: null },
        }),
  } as never)
}

const renderFactor = (data: Record<string, unknown>) =>
  render(
    <ReactFlowProvider>
      <FactorNode
        id={ID} type="factor" data={data as never} selected={false}
        isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
        dragging={false} zIndex={0} deletable selectable draggable
      />
    </ReactFlowProvider>,
  )

const visibleText = (el: Element) => {
  const clone = el.cloneNode(true) as Element
  clone.querySelectorAll('.sr-only').forEach((n) => n.remove())
  return (clone.textContent ?? '').trim()
}
const before = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

/** BaseNode's root for THIS card — the positive control every absence needs. */
const card = (title = 'Trial conversion') => {
  const t = screen.getByTestId('node-title')
  expect(t.textContent).toContain(title)
  const root = t.closest('[role="group"]')
  expect(root).not.toBeNull()
  return root as HTMLElement
}
const popover = () => screen.queryByTestId('factor-node-popover')

beforeEach(() => {
  displayMetadata = UNRANKED()
})
afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false,
    v5AnalysisFact: null, results: { status: 'idle', report: null }, lodRung: 'full',
    viewMode: 'standard', goalConstraints: [],
  } as never)
})

describe('prototype · the driver line is ON the resting card after a run', () => {
  it('ranked: value line → `Driver N of M analysed` + bar, on the card and not in the popover', () => {
    displayMetadata = SECOND()
    seed(VALUED, { phase: 'post' })
    renderFactor(VALUED)
    const c = card()
    const value = within(c).getByTestId('factor-recorded-value')
    const driver = within(c).getByTestId('factor-driver-line')
    expect(within(driver).getByTestId('factor-driver-line-caption').textContent).toBe('Driver 2 of 3 ranked in this run')
    expect(within(driver).getByTestId('factor-driver-line-bar')).toBeTruthy()
    expect(before(value, driver)).toBe(true)
    // Never both: the popover (if it mounts) does not repeat it.
    const pop = popover()
    if (pop) expect(within(pop).queryByTestId('factor-driver-line')).toBeNull()
    // The retired inline cue is gone.
    expect(screen.queryByTestId(`factor-driver-cue-${ID}`)).toBeNull()
  })

  it('stale: the card line is labelled `Last run ·`', () => {
    displayMetadata = SECOND()
    seed(VALUED, { phase: 'post' })
    renderFactor(VALUED)
    act(() => useCanvasStore.setState({ analysisFreshnessDirty: true }))
    expect(within(card()).getByTestId('factor-driver-line-caption').textContent).toBe('Last run · Driver 2 of 3 ranked')
  })

  it('CONTRAST — before a run there is no driver line anywhere (the value line is present)', () => {
    displayMetadata = SECOND()
    seed(VALUED, { phase: 'pre' })
    renderFactor(VALUED)
    expect(within(card()).getByTestId('factor-recorded-value')).toBeTruthy()
    expect(screen.queryByTestId('factor-driver-line')).toBeNull()
  })

  it('CONTRAST — an unranked factor gets no line on the card', () => {
    displayMetadata = UNRANKED()
    seed(VALUED, { phase: 'post' })
    renderFactor(VALUED)
    expect(within(card()).getByTestId('factor-recorded-value')).toBeTruthy()
    expect(within(card()).queryByTestId('factor-driver-line')).toBeNull()
  })
})

describe('prototype · the TOP driver carries its turning-point track at rest', () => {
  it('rank 1 with a found turning point: value → driver line → turning point, all on the card; not in the popover', () => {
    displayMetadata = TOP()
    seed(VALUED, { phase: 'post', flipRows: [FOUND_ROW] })
    renderFactor(VALUED)
    const c = card()
    const driver = within(c).getByTestId('factor-driver-line')
    const tp = within(c).getByTestId('factor-turning-point')
    expect(within(c).getByTestId('factor-driver-line-caption').textContent).toBe('Driver 1 of 3 ranked in this run')
    // v3.1's `flipPlot` caption (DESIGN-GAP-v31 #38): the direction sentence.
    expect(visibleText(within(tp).getByTestId('factor-turning-point-caption'))).toBe('Below 6.5%, the current model comparison changes.')
    expect(within(tp).queryByTestId('factor-turning-point-caption-value')).toBeNull()
    expect(within(tp).getByTestId('factor-turning-point-track')).toBeTruthy()
    expect(before(within(c).getByTestId('factor-recorded-value'), driver)).toBe(true)
    expect(before(driver, tp)).toBe(true)
    const pop = popover()
    if (pop) expect(within(pop).queryByTestId('factor-turning-point')).toBeNull()
  })

  /**
   * ⭐ CONTRACT v3.1 POINT 3 (DESIGN-GAP-v31 #38) REVERSES VERIFIER FIX_NEEDED 1
   * (c5adac48), which moved the 49-character direction sentence off the resting
   * card because it made the top-driver card 5 body lines at Normal and ~7 at
   * the landing zoom. v3.1's own `flipPlot` captions the resting track with the
   * sentence, and the common brief rules v3.1 wins — the height cost is named
   * in the WS4 report (WS1 owns fit). The number still prints ONCE: in the
   * sentence, never again on the track.
   */
  it('at rest the direction sentence IS card text (v3.1 #38); the name opens with it; the number prints once', () => {
    displayMetadata = TOP()
    seed(VALUED, { phase: 'post', flipRows: [FOUND_ROW] })
    renderFactor(VALUED)
    const c = card()
    const tp = within(c).getByTestId('factor-turning-point')
    expect(visibleText(c)).toContain('Below 6.5%, the current model comparison changes.')
    expect(tp.getAttribute('aria-label')!.startsWith('Below 6.5%, the current model comparison changes. ')).toBe(true)
    expect(visibleText(c).split('6.5%').length - 1).toBe(1)
  })

  it('stale: the caption is the Last-run direction sentence', () => {
    displayMetadata = TOP()
    seed(VALUED, { phase: 'post', flipRows: [FOUND_ROW] })
    renderFactor(VALUED)
    act(() => useCanvasStore.setState({ analysisFreshnessDirty: true }))
    const tp = within(card()).getByTestId('factor-turning-point')
    expect(visibleText(within(tp).getByTestId('factor-turning-point-caption'))).toBe('Last run · Below 6.5%, the model comparison changes.')
    expect(tp.getAttribute('aria-label')!.startsWith('Last run · Below 6.5%, the model comparison changes. ')).toBe(true)
  })

  /**
   * ⛔ THE FAITHFULNESS GATE AT THE NEW RENDER SITE (verifier mutant on c5adac48:
   * the at-rest slot passed `factorUnit={undefined}` and survived 235 tests).
   * A turning point in `%` on a factor valued in `GBP/year` may not print its
   * number or draw its track; at rest it is not on the card at all (the caption
   * is never shown without its number) — the popover keeps the sentence.
   */
  it('⛔ top driver, factor unit `GBP/year`, row unit `%`: no track and no `6.5%` on the card — CONTRAST: `%` on `%` is on the card (above)', () => {
    const MONEY = {
      label: 'Trial conversion', type: 'factor', category: 'controllable',
      observedState: { value: 0.39, raw_value: 39000, cap: 100000, unit: 'GBP/year', extractionType: 'inferred', source: 'cee_inference' },
    }
    displayMetadata = TOP()
    seed(MONEY, { phase: 'post', flipRows: [FOUND_ROW] })
    renderFactor(MONEY)
    const c = card()
    // Positive controls: the card and its driver line mounted.
    expect(within(c).getByTestId('factor-driver-line')).toBeTruthy()
    expect(within(c).queryByTestId('factor-turning-point')).toBeNull()
    expect(within(c).queryByTestId('factor-turning-point-track')).toBeNull()
    expect(visibleText(c)).not.toContain('6.5%')
    const inPop = within(popover()!).getByTestId('factor-turning-point')
    expect(within(inPop).queryByTestId('factor-turning-point-value')).toBeNull()
    expect(inPop.getAttribute('aria-label')).not.toContain('6.5%')
  })

  it('⛔ top driver, NORMALISED row: not on the card (no number may print) — the popover keeps the sentence', () => {
    displayMetadata = TOP()
    seed(VALUED, { phase: 'post', flipRows: [{ ...FOUND_ROW, value_scale: 'normalised' }] })
    renderFactor(VALUED)
    const c = card()
    expect(within(c).getByTestId('factor-driver-line')).toBeTruthy()
    expect(within(c).queryByTestId('factor-turning-point')).toBeNull()
    expect(within(popover()!).getByTestId('factor-turning-point-caption').textContent).toBe(
      'Below a turning point, the current model comparison changes.',
    )
  })

  it('CONTRAST — rank 2 with a found turning point: the driver line is on the card, the turning point stays in the popover', () => {
    displayMetadata = SECOND()
    seed(VALUED, { phase: 'post', flipRows: [FOUND_ROW] })
    renderFactor(VALUED)
    const c = card()
    expect(within(c).getByTestId('factor-driver-line')).toBeTruthy()
    expect(within(c).queryByTestId('factor-turning-point')).toBeNull()
    expect(within(popover()!).getByTestId('factor-turning-point-caption').textContent).toBe('Below 6.5%, the current model comparison changes.')
  })

  it('ONE GEOMETRY — the body is the same at the `quiet` and `full` rungs', () => {
    const bodyIds = () => {
      const c = card()
      return ['factor-recorded-value', 'factor-driver-line', 'factor-turning-point'].map((id) => within(c).queryByTestId(id) !== null)
    }
    displayMetadata = TOP()
    seed(VALUED, { phase: 'post', flipRows: [FOUND_ROW], lodRung: 'quiet' })
    renderFactor(VALUED)
    const quiet = bodyIds()
    cleanup()
    seed(VALUED, { phase: 'post', flipRows: [FOUND_ROW], lodRung: 'full' })
    renderFactor(VALUED)
    expect(bodyIds()).toEqual(quiet)
    expect(quiet).toEqual([true, true, true])
  })
})

describe('prototype · an external factor shows its range with a band, on the card', () => {
  it('percent prior: `Range: 25% to 45%` on the card, and a band whose ends are the same two numbers', () => {
    seed(RANGE_PCT, { phase: 'pre' })
    renderFactor(RANGE_PCT)
    const c = card('Feature adoption')
    const line = within(c).getByTestId(`factor-prior-range-${ID}`)
    expect(visibleText(line)).toBe('Range: 25% to 45% no source')
    const band = within(c).getByTestId(`factor-range-band-${ID}`)
    expect(band.getAttribute('aria-hidden')).toBe('true')
    expect(within(band).getByTestId(`factor-range-band-low-${ID}`).textContent).toBe('25%')
    expect(within(band).getByTestId(`factor-range-band-high-${ID}`).textContent).toBe('45%')
    expect(before(line, band)).toBe(true)
    const pop = popover()
    if (pop) expect(within(pop).queryByTestId(`factor-prior-range-${ID}`)).toBeNull()
  })

  it('unitless normalised prior: NO line and NO band on the card (v3.1 #20 — no bare internal model scale)', () => {
    // Was: the band ends are the line's own `0.3` and `0.8`. v3.1 `checks.factor`
    // rules the bare 0–1 pair off the card (omit, never invent); the owner still
    // composes it for the Model tab (`resolveFactorPriorRange`).
    seed(RANGE_ONLY, { phase: 'post' })
    renderFactor(RANGE_ONLY)
    const c = card('Feature adoption')
    expect(within(c).queryByTestId(`factor-prior-range-${ID}`)).toBeNull()
    expect(within(c).queryByTestId(`factor-range-band-${ID}`)).toBeNull()
    expect(visibleText(c)).not.toContain('0.3 to 0.8')
  })

  it('CONTRAST — the producer’s authored range prose keeps its line and gets NO band (prose is never parsed)', () => {
    const AUTHORED = { ...RANGE_ONLY, display_value: '30% to 80% of accounts' }
    seed(AUTHORED, { phase: 'pre' })
    renderFactor(AUTHORED)
    const c = card('Feature adoption')
    expect(visibleText(within(c).getByTestId(`factor-prior-range-${ID}`))).toContain('30% to 80% of accounts')
    expect(within(c).queryByTestId(`factor-range-band-${ID}`)).toBeNull()
  })

  it('CONTRAST — a user value replaces the range: the line says so and NO band is plotted', () => {
    const REPLACED = {
      ...RANGE_PCT,
      observedState: { value: 0.3, raw_value: 30, unit: '%', source: 'user' },
    }
    seed(REPLACED, { phase: 'pre' })
    renderFactor(REPLACED)
    const c = card('Feature adoption')
    expect(visibleText(within(c).getByTestId(`factor-prior-range-${ID}`))).toMatch(/^Your value replaces the range /)
    expect(within(c).queryByTestId(`factor-range-band-${ID}`)).toBeNull()
  })

  it('CONTRAST — a non-external factor never gets a range line or band', () => {
    const CONTROLLABLE_WITH_PRIOR = { ...VALUED, prior: { distribution: 'uniform', range_min: 0.25, range_max: 0.45 } }
    seed(CONTROLLABLE_WITH_PRIOR, { phase: 'pre' })
    renderFactor(CONTROLLABLE_WITH_PRIOR)
    expect(within(card()).getByTestId('factor-recorded-value')).toBeTruthy()
    expect(screen.queryByTestId(`factor-range-band-${ID}`)).toBeNull()
  })
})

describe('prototype · a currency rate reads `£39,000/year` on the card', () => {
  const money = (unit: string) => ({
    label: 'Annual PA salary', type: 'factor', category: 'controllable',
    observedState: { value: 0.39, raw_value: 39000, cap: 100000, unit, extractionType: 'inferred', source: 'cee_inference' },
  })

  it('GBP/year → figure `£39,000`, attached muted unit `/year`', () => {
    const data = money('GBP/year')
    seed(data, { phase: 'pre' })
    renderFactor(data)
    const c = card('Annual PA salary')
    expect(within(c).getByTestId(`factor-value-figure-${ID}`).textContent).toBe('£39,000')
    expect(within(c).getByTestId(`factor-value-unit-${ID}`).textContent).toBe('/year')
    expect(visibleText(within(c).getByTestId('factor-recorded-value'))).toBe('£39,000/yearest.')
  })

  it('CONTRAST — a non-currency rate (`hours/week`) is untouched: `40 hours/week`', () => {
    const data = { ...money('hours/week'), observedState: { value: 0.4, raw_value: 40, cap: 100, unit: 'hours/week', extractionType: 'inferred', source: 'cee_inference' } }
    seed(data, { phase: 'pre' })
    renderFactor(data)
    const c = card('Annual PA salary')
    expect(within(c).getByTestId(`factor-value-figure-${ID}`).textContent).toBe('40')
    expect(within(c).getByTestId(`factor-value-unit-${ID}`).textContent).toBe('hours/week')
    expect(visibleText(within(c).getByTestId('factor-recorded-value'))).toBe('40 hours/weekest.')
  })

  it('CONTRAST — a currency code with no glyph mapping (`CHF/year`) is untouched', () => {
    const data = money('CHF/year')
    seed(data, { phase: 'pre' })
    renderFactor(data)
    expect(visibleText(within(card('Annual PA salary')).getByTestId('factor-recorded-value'))).toBe('39,000 CHF/yearest.')
  })
})
