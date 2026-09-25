/**
 * ⭐⭐ THE FACTOR CARD SAYS WHAT THE FACTOR IS — NODE-ANATOMY v3.2, row "Factor".
 *
 * Paul, 24 Sep, on the served OpenAI PoC cards: "The content on the nodes is an
 * absolute mess … spend a lot of time and effort making these nodes look like
 * the design. Don't go chasing symptoms." A served post-run factor carried
 * "Last run · Structural influence ▬", "Last run · No turning point available",
 * "Limit ≤ 7%", its value in a bordered chip, and a "Needs input" pill
 * straddling the top border.
 *
 * The authority is `output/canvas-completion-20260923/NODE-ANATOMY-v32.md`
 * (24 Sep 02:40Z, stale rule corrected 03:05Z per ED #63 5805528520), derived
 * from contract v3.1 `nodeHTML()`'s factor branch:
 *
 *   Line 1   the title
 *   Line 2   `<value> <mark>`, plain text, no chip. Missing:
 *            `Needs input · Value not set yet` IN THE BODY, not a border pill.
 *            Pre-run with a value: nothing more.
 *   Findings ONLY if the run RANKED it: `Driver N of M ranked in this run`
 *            + a thin neutral bar, where M is the factors the run RANKED
 *            (`influenceRankedCount`) — v3.2's own wording, from contract v3.1
 *            pt 5, restored by design-gap row 39 over ED #63 5806207128's
 *            "analysed" (M = the analysed set).
 *            Then a FOUND turning point only. (A found turning point is the
 *            run's finding for THIS element and shows on any factor.)
 *   Never    "Structural influence"; any "No turning point …" line at rest —
 *            ED 5806207128: "Absence of a turning point = no mini-visual";
 *            a limit line (the boundary lives on the Goal).
 *   Stale    `Last run ·` ONLY on a derived result actually shown (a driver
 *            rank, a found turning point); never on filler.
 *            (`Last run · Driver 1 of 3 ranked`, v3.1 pt 5.)
 *   All      no pills on the border; no chips around values at rest.
 *
 * ⚠ IDENTITY, NOT A VALUE PREDICATE. Every assertion binds a test id carrying
 * this card's node id or an exact string, and every absence is paired with a
 * positive control in the same render (the card mounted; the value row is
 * there), so a card that failed to mount cannot pass an absence (trap 13).
 * Class assertions compare whole TOKENS, never substrings — `hover:border-field`
 * contains `border-field`, and a substring check would read a hover cue as a
 * resting chip.
 *
 * Freshness is NOT mocked: `current` / `changed` come from the real store and
 * the real composed verdict (harness from `FactorNode.driverLineContractV31`).
 *
 * CLAIM SCOPE: jsdom — strings, test ids, classes and DOM order. Not pixels;
 * the served-build witness at 1280×800 is the acceptance, not this file.
 *
 * ⭐ RE-POINTED FOR THE BOUNDED ANATOMY (ED #63 5809278282, 24 Sep): the
 * Standard card is title + ONE primary line, so line 2 no longer wraps, the
 * `Needs input` row shows the ruled word only (the sentence is its sr-only
 * description and is in the popover), and the findings — the driver line and
 * a found turning point — are pinned in the factor's POPOVER (bound by the
 * popover's own test id) and pinned ABSENT from the card face. Every v3.2 rule
 * below still binds; only the home of the findings moved. The fit itself is
 * pinned in `FactorNode.boundedAnatomy.spec.tsx`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { useCanvasStore } from '../../store'
import { useAnalysisTrust } from '../../hooks/useAnalysisTrust'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

// The corner badges are behind `graphBadges`; forcing it ON is what makes the
// "no badge on the border" absences discriminating (at the pre-v3.2 tip both
// badges render on this exact fixture).
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, isGraphBadgesEnabled: () => true }
})

let displayMetadata: Record<string, unknown> = {}
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => displayMetadata),
}))

// ED 5809278282: the findings live in the Standard popover. Transparent and
// identity-bearing, so its CONTENT is observable and every document-wide
// absence below covers the popover too.
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="factor-node-popover">{children}</div>
  ),
}))

const ID = 'fac_conversion'

/** An Olumi-estimated, controllable factor — the on-card editor's population. */
const VALUED = {
  label: 'Trial conversion', type: 'factor', category: 'controllable',
  observedState: { value: 0.08, unit: '%', display_value: '8%', extractionType: 'inferred', source: 'cee_inference' },
}
/** No value, not external — `isFactorNeedsInput`'s population. */
const MISSING = { label: 'Trial conversion', type: 'factor', category: 'controllable' }

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
/**
 * Ranked 1st, SIX factors analysed, THREE ranks published. The two counts
 * differ on purpose: the caption must print the RANKED count (3) (v3.1 pt 5,
 * row 39), never the analysed count (6) — a discriminating pair.
 */
const RANKED = () => metadata(1, 6, 3, 1)
const UNRANKED = () => metadata(null, 6, 3, 0.12)

const FOUND_ROW = { node_id: ID, label: 'Trial conversion', current_value: 8, flip_value: 6.5, unit: '%', flip_reason: 'found', value_scale: 'display' }
const ATTESTED_NO_FLIP_ROW = { node_id: ID, label: 'Trial conversion', flip_reason: 'no_effect_within_bounds' }
/** The reader's own limit on THIS factor — on the pre-v3.2 tip it printed "Limit ≤ 7%" here. */
const LIMIT = [{ node_id: ID, operator: '<=', value: 7, unit: '%' }]

const FRESH_VERDICT = { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: '2026-09-24T00:00:00.000Z' }

const seed = (
  data: Record<string, unknown>,
  { phase, flipRows = [], viewMode = 'standard' }: { phase: 'pre' | 'post'; flipRows?: unknown[]; viewMode?: 'standard' | 'expert' },
) => {
  useCanvasStore.setState({
    nodes: [{ id: ID, type: 'factor', position: { x: 0, y: 0 }, data }],
    edges: [], ceeAnalysisReady: null, viewMode, lodRung: 'full',
    goalConstraints: LIMIT,
    analysisStateV1: null, importPendingServerRegistration: false, currentScenarioId: 'anatomy-v32',
    ...(phase === 'post'
      ? {
          analysisFreshness: FRESH_VERDICT, analysisFreshnessDirty: false,
          v5AnalysisFact: { scenarioId: 'anatomy-v32', analysisHash: 'run-1', hasRunAnalysisFact: true },
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

const editTheModel = () => act(() => useCanvasStore.setState({ analysisFreshnessDirty: true }))

function TrustProbe() {
  return <span data-testid="trust-probe" data-semantic={useAnalysisTrust().semantic} />
}
const semantic = () => screen.getByTestId('trust-probe').getAttribute('data-semantic')

const renderFactor = (data: Record<string, unknown>) =>
  render(
    <ReactFlowProvider>
      <TrustProbe />
      <FactorNode
        id={ID} type="factor" data={data as never} selected={false}
        isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
        dragging={false} zIndex={0} deletable selectable draggable
      />
    </ReactFlowProvider>,
  )

/** Visible text only: an sr-only statement is for AT, not the card face. */
const visibleText = (el: Element) => {
  const clone = el.cloneNode(true) as Element
  clone.querySelectorAll('.sr-only').forEach((n) => n.remove())
  return (clone.textContent ?? '').trim()
}
const tokens = (el: Element) => new Set((el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean))
const before = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

/** The card mounted, with THIS title — the positive control every absence below needs. */
const mounted = () => expect(screen.getByTestId('node-title').textContent).toContain('Trial conversion')
/** BaseNode's root — the card FACE, which excludes the sibling popover. */
const face = () => screen.getByTestId('node-title').closest('[role="group"]') as HTMLElement
const popover = () => screen.getByTestId('factor-node-popover')
/** ED 5809278282: a finding is in the popover, never on the face. */
const inPopoverNotOnFace = (id: string) => {
  expect(within(face()).queryByTestId(id), `${id} is on the card face`).toBeNull()
  return within(popover()).getByTestId(id)
}

/** The v3.2 "Never on the card" list, plus the border badges, in one place. */
const expectNothingItMustNeverSay = () => {
  const text = document.body.textContent ?? ''
  expect(text).not.toContain('Structural influence')
  expect(text).not.toContain('No turning point')
  expect(text).not.toContain('Limit')
  expect(screen.queryByTestId('factor-constraint-lines')).toBeNull()
  expect(screen.queryByTestId('constraint-badge')).toBeNull()
  expect(screen.queryByTestId('evidence-gap-badge')).toBeNull()
}

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

describe('NODE-ANATOMY v3.2 · Factor · pre-run with a value — title, value, nothing more', () => {
  it('line 2 is the value and its mark, as plain text: no chip, no top margin, ONE line (ED 5809278282)', () => {
    seed(VALUED, { phase: 'pre' })
    renderFactor(VALUED)
    mounted()
    const row = screen.getByTestId('factor-recorded-value')
    expect(visibleText(row)).toBe('8%est.')
    // Principle 4 "no chips around values at rest": the editor rests as text.
    const editor = screen.getByTestId(`node-value-editor-${ID}`)
    const rest = tokens(editor)
    for (const chip of ['bg-panel-hover', 'border-field', 'w-full', 'px-2', 'py-1', 'rounded-md']) {
      expect(rest.has(chip), `resting editor still carries the chip token "${chip}"`).toBe(false)
    }
    expect(rest.has('border-transparent')).toBe(true)
    // …and says it is editable on hover and on focus, not at rest.
    expect(rest.has('hover:border-field')).toBe(true)
    expect(rest.has('focus-visible:border-field')).toBe(true)
    // Title → value is the header's 4px, as on every family.
    const rowTokens = tokens(row)
    expect(rowTokens.has('mt-1')).toBe(false)
    // ED 5809278282 (bounded anatomy): the primary line no longer wraps — the
    // mark is held on it (`factor-value-mark-slot`), and nothing is cut.
    expect(rowTokens.has('flex-nowrap')).toBe(true)
    expect(rowTokens.has('flex-wrap')).toBe(false)
  })

  it('the mark is upright (not italic)', () => {
    seed(VALUED, { phase: 'pre' })
    renderFactor(VALUED)
    const mark = screen.getByTestId('estimate-marker')
    expect(mark.textContent).toBe('est.')
    expect(tokens(mark).has('italic')).toBe(false)
  })

  it('nothing more: no finding line, no state pill, no limit, no border badge', () => {
    seed(VALUED, { phase: 'pre' })
    renderFactor(VALUED)
    mounted()
    expect(screen.getByTestId('factor-recorded-value')).toBeTruthy()
    for (const id of ['factor-driver-line', 'factor-turning-point', 'factor-turning-point-none', 'factor-driver-not-ranked', 'needs-input-pill', `factor-needs-input-row-${ID}`]) {
      expect(screen.queryByTestId(id), id).toBeNull()
    }
    // Design-gap row 10 (contract v3 §02 draft, "Working assumption · no
    // analysis yet"): v3.2's "nothing more" holds for the card FACE — no second
    // visible row (ED 5809278282). The pre-run line lives in the popover (and
    // the value line's accessible text), pinned by FactorNode.noAnalysisYet.spec.
    expect(visibleText(face())).not.toContain('Working assumption')
    expect(within(popover()).getByTestId(`factor-popover-no-analysis-${ID}`).textContent).toBe('Working assumption · no analysis yet')
    expectNothingItMustNeverSay()
  })

  it('CONTRAST: Detailed view still carries the badges, so the Standard absences are not a dead fixture', () => {
    seed(VALUED, { phase: 'pre', viewMode: 'expert' })
    renderFactor(VALUED)
    mounted()
    expect(screen.getByTestId('evidence-gap-badge')).toBeTruthy()
    expect(screen.getByTestId('constraint-badge')).toBeTruthy()
  })
})

describe('NODE-ANATOMY v3.2 · Factor · missing value — "Needs input" in the BODY (the sentence: description + popover)', () => {
  it.each(['pre', 'post'] as const)('%s-run: the state is line 2 of the card, and no pill sits on the border', (phase) => {
    seed(MISSING, { phase, flipRows: [ATTESTED_NO_FLIP_ROW] })
    renderFactor(MISSING)
    mounted()
    const row = screen.getByTestId(`factor-needs-input-row-${ID}`)
    // ED 5809278282: one line at ~19 characters — the ruled word stays visible;
    // "Value not set yet" is the row's sr-only description and is in the popover.
    expect(visibleText(row)).toBe('Needs input')
    expect(row.querySelector('.sr-only')?.textContent).toBe('Value not set yet')
    expect(within(popover()).getByTestId(`factor-popover-needs-input-${ID}`).textContent).toBe('Needs input · Value not set yet')
    // ONE "Needs input" on the card, and it is the one in the body row.
    const pills = screen.getAllByTestId('needs-input-pill')
    expect(pills).toHaveLength(1)
    expect(row.contains(pills[0])).toBe(true)
    expect(screen.getByTestId(`node-corner-stack-${ID}`).contains(pills[0])).toBe(false)
    // It sits where the value would: straight under the title.
    expect(before(screen.getByTestId('node-title'), row)).toBe(true)
    expect(screen.queryByTestId('factor-recorded-value')).toBeNull()
    expectNothingItMustNeverSay()
  })
})

describe('NODE-ANATOMY v3.2 · Factor · post-run, RANKED, turning point found', () => {
  it('value on the face; "Driver 1 of 3 ranked in this run" + bar, then the turning point — in that order, in the popover (ED 5809278282)', () => {
    displayMetadata = RANKED()
    seed(VALUED, { phase: 'post', flipRows: [FOUND_ROW] })
    renderFactor(VALUED)
    expect(semantic()).toBe('current')
    const value = within(face()).getByTestId('factor-recorded-value')
    const driver = inPopoverNotOnFace('factor-driver-line')
    const tp = inPopoverNotOnFace('factor-turning-point')
    expect(within(popover()).getByTestId('factor-driver-line-caption').textContent).toBe('Driver 1 of 3 ranked in this run')
    expect(within(popover()).getByTestId('factor-driver-line-bar')).toBeTruthy()
    expect(within(popover()).getByTestId('factor-turning-point-caption').textContent).toBe('Below 6.5%, the current model comparison changes.')
    // The face keeps the neutral cue on the value line, named by the caption.
    expect(within(value).getByTestId(`factor-driver-cue-${ID}`).getAttribute('aria-label')).toBe('Driver 1 of 3 ranked in this run')
    expect(before(value, driver)).toBe(true)
    expect(before(driver, tp)).toBe(true)
    expect(screen.queryByTestId('factor-turning-point-none')).toBeNull()
    expect(document.body.textContent).not.toContain('Last run')
    expectNothingItMustNeverSay()
  })

  it('the rank is secondary: the caption is regular weight and sits beside its bar, not pushed to the far edge', () => {
    displayMetadata = RANKED()
    seed(VALUED, { phase: 'post', flipRows: [FOUND_ROW] })
    renderFactor(VALUED)
    expect(tokens(within(popover()).getByTestId('factor-driver-line-caption')).has('font-medium')).toBe(false)
    const line = tokens(inPopoverNotOnFace('factor-driver-line'))
    expect(line.has('justify-between')).toBe(false)
    expect(line.has('w-full')).toBe(false)
  })
})

describe('NODE-ANATOMY v3.2 · Factor · the driver line’s M is the RANKED count (v3.1 pt 5, row 39)', () => {
  it('the caption AND its description print the ranked count (3), never the analysed count (6)', () => {
    displayMetadata = RANKED()
    seed(VALUED, { phase: 'post', flipRows: [] })
    renderFactor(VALUED)
    expect(semantic()).toBe('current')
    const caption = within(popover()).getByTestId('factor-driver-line-caption').textContent ?? ''
    expect(caption).toBe('Driver 1 of 3 ranked in this run')
    expect(caption).not.toContain('of 6')
    expect(caption).not.toContain('analysed')
    const note = inPopoverNotOnFace('factor-driver-line').getAttribute('aria-description') ?? ''
    expect(note).toContain('“of 3” counts the factors the run ranked')
    expect(note).not.toContain('of 6')
  })

  it('CONTRAST — two ranked (of four analysed) prints 2: the M follows the ranked count, not a constant', () => {
    displayMetadata = metadata(2, 4, 2, 0.7)
    seed(VALUED, { phase: 'post', flipRows: [] })
    renderFactor(VALUED)
    expect(within(popover()).getByTestId('factor-driver-line-caption').textContent).toBe('Driver 2 of 2 ranked in this run')
    expect(screen.getByTestId(`factor-driver-cue-${ID}`).getAttribute('aria-label')).toBe('Driver 2 of 2 ranked in this run')
  })
})

describe('NODE-ANATOMY v3.2 · Factor · post-run, RANKED, no turning point — no mini-visual at rest', () => {
  it.each([
    ['an attested no-flip row', [ATTESTED_NO_FLIP_ROW]],
    ['no row at all', []],
  ] as const)('with %s: the driver line is the last finding; no "No turning point" line', (_name, flipRows) => {
    displayMetadata = RANKED()
    seed(VALUED, { phase: 'post', flipRows: [...flipRows] })
    renderFactor(VALUED)
    expect(semantic()).toBe('current')
    // Positive control: the run's finding for this factor IS disclosed — in the
    // popover (ED 5809278282), with the neutral cue on the face.
    expect(within(popover()).getByTestId('factor-driver-line-caption').textContent).toBe('Driver 1 of 3 ranked in this run')
    expect(within(face()).getByTestId(`factor-driver-cue-${ID}`)).toBeTruthy()
    expect(screen.queryByTestId('factor-turning-point-none')).toBeNull()
    expect(screen.queryByTestId('factor-turning-point')).toBeNull()
    expectNothingItMustNeverSay()
  })

  it('CONTRAST — Detailed still states the attested search, so the resting absence is the gate, not a dead fixture', () => {
    displayMetadata = RANKED()
    seed(VALUED, { phase: 'post', flipRows: [ATTESTED_NO_FLIP_ROW], viewMode: 'expert' })
    renderFactor(VALUED)
    expect(visibleText(screen.getByTestId('factor-turning-point-none'))).toBe('No turning point in this run')
  })
})

describe('NODE-ANATOMY v3.2 · Factor · post-run, NOT ranked — the card says what the factor is, and stops', () => {
  it.each([
    ['an attested no-flip row', [ATTESTED_NO_FLIP_ROW]],
    ['no row at all', []],
  ] as const)('with %s: no driver line, no bar, no turning-point line', (_name, flipRows) => {
    displayMetadata = UNRANKED()
    seed(VALUED, { phase: 'post', flipRows: [...flipRows] })
    renderFactor(VALUED)
    expect(semantic()).toBe('current')
    mounted()
    expect(screen.getByTestId('factor-recorded-value')).toBeTruthy()
    for (const id of ['factor-driver-line', 'factor-driver-line-bar', 'factor-turning-point', 'factor-turning-point-none']) {
      expect(screen.queryByTestId(id), id).toBeNull()
    }
    expect(document.body.textContent).not.toContain('No turning point')
    expectNothingItMustNeverSay()
  })

  it('CONTRAST: a FOUND turning point is the run’s finding for THIS factor and still shows, ranked or not', () => {
    displayMetadata = UNRANKED()
    seed(VALUED, { phase: 'post', flipRows: [FOUND_ROW] })
    renderFactor(VALUED)
    inPopoverNotOnFace('factor-turning-point')
    expect(within(popover()).getByTestId('factor-turning-point-caption').textContent).toBe('Below 6.5%, the current model comparison changes.')
    expect(screen.queryByTestId('factor-driver-line')).toBeNull()
    expect(screen.queryByTestId(`factor-driver-cue-${ID}`)).toBeNull()
  })
})

describe('NODE-ANATOMY v3.2 · Factor · stale (model changed since the run)', () => {
  it('`Last run ·` rides ONLY the derived results shown — the rank and the found turning point', () => {
    displayMetadata = RANKED()
    seed(VALUED, { phase: 'post', flipRows: [FOUND_ROW] })
    renderFactor(VALUED)
    editTheModel()
    expect(semantic()).toBe('changed')
    // ED 5809278282: "any stale run-derived figure shown on-card or in
    // disclosure keeps `Last run ·`" — the popover's findings, and the face's cue.
    inPopoverNotOnFace('factor-driver-line')
    inPopoverNotOnFace('factor-turning-point')
    expect(within(popover()).getByTestId('factor-driver-line-caption').textContent).toBe('Last run · Driver 1 of 3 ranked')
    expect(within(popover()).getByTestId('factor-turning-point-caption').textContent).toBe(
      'Last run · Below 6.5%, the model comparison changes.',
    )
    expect(within(face()).getByTestId(`factor-driver-cue-${ID}`).getAttribute('aria-label')).toBe('Last run · Driver 1 of 3 ranked')
    // The run's value stays distinct from the current value line.
    expect(within(popover()).getByTestId('factor-turning-point-run-value').textContent).toBe('8% in last run')
    // The value is the factor's own state, not a finding: never prefixed.
    expect(visibleText(screen.getByTestId('factor-recorded-value'))).toBe('8%est.')
    expectNothingItMustNeverSay()
  })

  it('a RANKED factor on a stale run with no turning point gains no "Last run · No turning point" line', () => {
    displayMetadata = RANKED()
    seed(VALUED, { phase: 'post', flipRows: [ATTESTED_NO_FLIP_ROW] })
    renderFactor(VALUED)
    editTheModel()
    expect(semantic()).toBe('changed')
    expect(within(popover()).getByTestId('factor-driver-line-caption').textContent).toBe('Last run · Driver 1 of 3 ranked')
    expect(screen.queryByTestId('factor-turning-point-none')).toBeNull()
    expect(document.body.textContent).not.toContain('in that run')
    expectNothingItMustNeverSay()
  })

  it('an UNRANKED factor on a stale run gains no filler line either', () => {
    displayMetadata = UNRANKED()
    seed(VALUED, { phase: 'post', flipRows: [ATTESTED_NO_FLIP_ROW] })
    renderFactor(VALUED)
    editTheModel()
    expect(semantic()).toBe('changed')
    mounted()
    expect(screen.getByTestId('factor-recorded-value')).toBeTruthy()
    expect(screen.queryByTestId('factor-turning-point-none')).toBeNull()
    expect(screen.queryByTestId('factor-driver-line')).toBeNull()
    expect(document.body.textContent).not.toContain('No turning point')
    expectNothingItMustNeverSay()
  })
})
