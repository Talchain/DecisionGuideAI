/**
 * ⭐⭐ RUNNING THE ANALYSIS MUST NOT DELETE THE REASON FROM AN OPTION CARD.
 *
 * WITNESSED, NOT HYPOTHESISED. On deployed `e2016182` with a completed
 * analysis in session, all three option cards rendered their name and an
 * ordinal and nothing else:
 *
 *     "Open a Second Roastery in Leeds | 1"
 *     "Expand the Manchester Site | 2"
 *     "Status Quo — hold current capacity | 3"
 *
 * No differentiator, no "Held back by:" line. A ranking with no reasons, handed to
 * the user at the exact moment they are choosing.
 *
 * TWO GATES CAUSED IT, and both are removed:
 *   1. the `differentiator` memo opened `if (isPostAnalysis) return null`
 *   2. the render gate opened `!isPostAnalysis &&`
 *
 * ⚠ WHY THE "Held back by:" LINE DOES NOT COVER THE GAP. It names the key factor
 * ("no X added" / "X lower") but renders ONLY for a NON-RECOMMENDED option,
 * and `computeBehindReason` returns null outright when there is no
 * recommended option — exactly what a WITHHELD LEADER produces. That is the
 * captured state above: the leader was withheld, so no card had a Behind
 * line and every card had lost its differentiator. The honest-withholding
 * path stripped every reason at once.
 *
 * ⚠ AND THE SENTENCE IS STRUCTURAL, so nothing here can go stale. It is
 * derived from `nodes` + `ceeAnalysisReady.options[].interventions` — the
 * MODEL, not the result. A run ranks options; it does not change which factor
 * differentiates them.
 *
 * ⚠ NODE-ANATOMY v3.2 (24 Sep; ED #63 5806266691 "differentiator only when
 * additive") NARROWS PAUL'S 10 SEP "BOTH STAY": the footer renders only when it
 * adds something the change rows don't. The fixtures below are widened so the
 * footer ADDS (the distinct case has two changes, so "… is the key difference"
 * says which one matters; the shared `→ value` case hides the factor behind
 * "+1 more"), and the run must still not delete it. Where the footer would
 * only repeat a shown row, the ROW is what keeps the card from being bare —
 * pinned in the shared block.
 *
 * CLAIM SCOPE (CLAUDE.md trap 3): these are jsdom text assertions. They prove
 * PRESENCE and ABSENCE of a sentence in the DOM. They prove nothing about
 * layout, card height or whether the line is visible on screen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

/**
 * Two non-baseline options, each differing on its own factor, plus one SHARED
 * change they set identically (so option-1 has two changes and "… is the key
 * difference" says which of them matters — NODE-ANATOMY v3.2).
 */
const FACTOR_SHARED = { id: 'f-shared', type: 'factor', data: { label: 'Tooling spend', type: 'factor' } }
const FACTOR_HEAD = { id: 'f-head', type: 'factor', data: { label: 'Developer headcount', type: 'factor' } }
const FACTOR_COST = { id: 'f-cost', type: 'factor', data: { label: 'Coordination cost', type: 'factor' } }
const SHARED_EQUAL = { value: 3, display_value: '£3k' }
const OPTION_1 = { id: 'option-1', type: 'option', data: { label: 'Hire two developers', type: 'option' } }
const OPTION_2 = { id: 'option-2', type: 'option', data: { label: 'Hire a tech lead', type: 'option' } }

/** The sentence the card must keep. Bound by IDENTITY, not by a substring
 *  another option's sentence could satisfy. */
const EXPECTED = 'Developer headcount is the key difference'

const CEE_READY = {
  options: [
    { id: 'option-1', interventions: { 'f-shared': SHARED_EQUAL, 'f-head': 3 } },
    { id: 'option-2', interventions: { 'f-shared': SHARED_EQUAL, 'f-cost': 5 } },
  ],
}

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  hoveredOptionId: null,
  nodes: [FACTOR_SHARED, FACTOR_HEAD, FACTOR_COST, OPTION_1, OPTION_2],
  edges: [],
  ceeAnalysisReady: CEE_READY,
  // A run that COMPLETED and withheld its leader: a report with no
  // option_comparison, which is what produced the captured state.
  results: { status: 'complete', report: {} },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  setHoveredOption: vi.fn(),
  viewMode: 'standard',
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null })) as unknown as (...args: never[]) => unknown),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
    // This fixture has no per-option result; draft metadata must stay in
    // draft mode when a test changes the store's analysis lifecycle.
    winRate: null,
    isResultsMode: useCanvasStore((state) => state.results.status) === 'complete',
    predictedOutcome: null,
    valueOfInformation: null,
    voiRank: null,
  })),
}))

import { useCanvasStore } from '../../store'

const baseProps = {
  id: 'option-1',
  type: 'option',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

const renderOption = (storeOverrides: Record<string, unknown> = {}, data: Record<string, unknown> = {}) => {
  // Same shape as the sibling `OptionNode.differentiatorRecoverable.spec.tsx`
  // uses. A `never`-typed selector parameter typechecks locally and then fails
  // the repo's ratchet, which is stricter than a bare `pnpm typecheck` run.
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    selector(makeStoreState(storeOverrides) as any))
  return render(
    <ReactFlowProvider>
      <OptionNode {...baseProps} data={{ label: 'Hire two developers', type: 'option', ...data }} />
    </ReactFlowProvider>
  )
}

describe('OptionNode differentiator — the run must not delete the reason', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('⭐ POST-ANALYSIS with a withheld leader: the card still says which factor differs', () => {
    // THE CAPTURED STATE. Before the fix this rendered a name and an ordinal
    // and nothing else.
    renderOption({ results: { status: 'complete', report: {} } })
    expect(screen.getByText(EXPECTED)).toBeInTheDocument()
  })

  it('⭐ THE TWIN: pre-analysis is UNCHANGED — the same sentence, same card', () => {
    // Held constant so the pair isolates `isPostAnalysis` alone. A mutant that
    // restores either gate REDs the case above and leaves this one GREEN —
    // which is what proves the binding is to the RUN and not to the fixture.
    renderOption({ results: { status: 'idle', report: null } })
    expect(screen.getByText(EXPECTED)).toBeInTheDocument()
  })

  it('the pair actually AGREE — the sentence is the same before and after', () => {
    const { unmount } = renderOption({ results: { status: 'idle', report: null } })
    const before = screen.getByText(EXPECTED).textContent
    unmount()
    renderOption({ results: { status: 'complete', report: {} } })
    const after = screen.getByText(EXPECTED).textContent
    // The point of the fix is CONTINUITY: running the analysis must not change
    // what the card says about the model's own structure.
    expect(after).toBe(before)
  })

  it('the baseline option is still excluded — the fix did not widen that', () => {
    renderOption(
      { results: { status: 'complete', report: {} } },
      { is_baseline: true },
    )
    expect(screen.queryByText(EXPECTED)).toBeNull()
  })

  it('PRECONDITION: the fixture really does produce a differentiator', () => {
    // Without this every assertion above could hold vacuously on a fixture
    // that stopped computing one (CLAUDE.md trap 13b).
    renderOption({ results: { status: 'complete', report: {} } })
    const el = screen.getByText(EXPECTED)
    expect(el.textContent).toContain('is the key difference')
    expect(el.textContent).toContain('Developer headcount')
  })
})
/**
 * ⭐⭐ THE SHARED-TOP-FACTOR CASE — half a fix is no fix, and this is the half
 * the first cut missed.
 *
 * An independent seat measured, at the first version of this change:
 *
 *     distinct factors, POST, leader withheld → "Hiring is the key difference"  ✓
 *     shared factor,    POST, leader withheld → (zero paragraphs on the card)   ✗
 *
 * When two options share their top factor the differentiator takes the
 * `X → value` form, and `differentiatorDuplicatesChip` suppressed it against a
 * from→to chip that renders PRE-analysis only. So the suppression compared
 * against something not on screen and removed the card's last line — the exact
 * witnessed state this file exists to end, still reachable.
 *
 * The repair binds the suppression to `structuredDeltaChipsRender`, the SAME
 * expression the chip block uses, so it can never again suppress against a chip
 * nobody can see.
 */
describe('OptionNode differentiator — a SHARED top factor survives the run too', () => {
  beforeEach(() => { vi.clearAllMocks() })

  /** Both options differ on the SAME factor, so the sentence takes `X → value`. */
  const SHARED_CEE = {
    options: [
      // `display_value` is what drives the `X → value` form: with a SHARED top
      // factor the sentence disambiguates by value, and CEE's own string is
      // rendered verbatim. Bare numbers here would fall through to directional
      // language and BOTH options would produce the same sentence, which the
      // deduplication then nulls — so the fixture would silently stop
      // exercising the shared branch at all.
      { id: 'option-1', interventions: { 'f-head': { value: 3, display_value: '3 engineers' } } },
      { id: 'option-2', interventions: { 'f-head': { value: 9, display_value: '9 engineers' } } },
    ],
  }

  /**
   * ⚠ THE FIXTURE MUST PRODUCE A CHIP, or the suppression never fires and these
   * tests pass without exercising the branch. Measured: without an
   * an intervention on a declared baseline option,
   * `structuredDeltas` is EMPTY, `differentiatorDuplicatesChip` can never be
   * true, and reverting the fix leaves every test GREEN — which is exactly what
   * the first cut of this block did.
   *
   * With them, the case reproduces:
   *   PRE  → chip "Developer headcount…→ 3 engineers", paragraphs []  (suppressed, correct)
   *   POST → chip gone, paragraph "Developer headcount → 3 engineers"  (the fix)
   */
  const SHARED_FACTOR = {
    id: 'f-head',
    type: 'factor',
    data: {
      label: 'Developer headcount',
      type: 'factor',
      observedState: { value: 0, unit: 'count' },
      unit: 'count',
    },
  }
  const BASELINE_OPTION = {
    id: 'option-b',
    type: 'option',
    data: { label: 'Status quo', type: 'option', is_baseline: true, interventions: { 'f-head': { value: 0, display_value: '0 engineers' } } },
  }

  const renderShared = (storeOverrides: Record<string, unknown> = {}) => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: SHARED_CEE,
        nodes: [SHARED_FACTOR, FACTOR_COST, OPTION_1, OPTION_2, BASELINE_OPTION],
        ...storeOverrides,
      }) as any))
    return render(
      <ReactFlowProvider>
        <OptionNode {...baseProps} data={{ label: 'Hire two developers', type: 'option' }} />
      </ReactFlowProvider>
    )
  }

  /** Every paragraph the card renders — the seat measured ZERO of these. */
  const paragraphTexts = (c: HTMLElement) =>
    Array.from(c.querySelectorAll('p')).map((p) => (p.textContent ?? '').trim()).filter(Boolean)

  it('⭐ POST-ANALYSIS the card is not left bare — its change row still says which factor differs', () => {
    const { container } = renderShared({ results: { status: 'complete', report: {} } })
    // Bind by IDENTITY to THIS option's row for the shared factor.
    const row = container.querySelector('[data-testid="option-change-row-option-1-f-head"]')
    expect(row, 'the change row for the shared factor renders after the run').not.toBeNull()
    expect(row!.textContent).toContain('3 engineers')
    expect(container.textContent).toContain('Developer headcount')
    // NODE-ANATOMY v3.2: the footer "Developer headcount → 3 engineers" would
    // only repeat that row, so it does not render.
    expect(paragraphTexts(container).join(' | ')).not.toContain('→')
  })

  it('THE TWIN: pre-analysis reads the same — the row, and no repeating footer', () => {
    const { container } = renderShared({ results: { status: 'idle', report: null } })
    expect(container.querySelector('[data-testid="option-change-row-option-1-f-head"]')).not.toBeNull()
    expect(paragraphTexts(container).join(' | ')).not.toContain('→')
  })

  it('⭐ WHERE THE `→ value` FOOTER ADDS (its factor is behind "+1 more"), it survives the run', () => {
    // Two equal shared changes lead the shared order, so the differentiating
    // factor is NOT a shown row and the footer names it.
    const TOOLS = { id: 'f-tools', type: 'factor', data: { label: 'Tooling spend', type: 'factor' } }
    const HOURS = { id: 'f-hours', type: 'factor', data: { label: 'Weekly hours', type: 'factor' } }
    const equal = { 'f-tools': { value: 3, display_value: '£3k' }, 'f-hours': { value: 40, display_value: '40h' } }
    const hidden = {
      ceeAnalysisReady: {
        options: [
          { id: 'option-1', interventions: { ...equal, 'f-head': { value: 3, display_value: '3 engineers' } } },
          { id: 'option-2', interventions: { ...equal, 'f-head': { value: 9, display_value: '9 engineers' } } },
        ],
      },
      nodes: [TOOLS, HOURS, SHARED_FACTOR, OPTION_1, OPTION_2],
    }
    const pre = renderShared({ ...hidden, results: { status: 'idle', report: null } })
    expect(pre.container.querySelector('[data-testid="option-change-row-option-1-f-head"]')).toBeNull()
    const before = pre.container.querySelector('[data-testid="option-differentiator-option-1"]')?.textContent
    expect(before).toBe('Developer headcount → 3 engineers')
    pre.unmount()
    const post = renderShared({ ...hidden, results: { status: 'complete', report: {} } })
    expect(post.container.querySelector('[data-testid="option-differentiator-option-1"]')?.textContent).toBe(before)
  })

  it('PRECONDITION: the change row renders from the baseline, marked', () => {
    // (Its first half — "the shared `→` footer renders" — is now the
    // "+1 more" case above: v3.2 renders that footer only where it adds.)

    // ⭐ THE PRECONDITION THE FIRST CUT MISSED, KEPT AND RE-AIMED: pre-analysis
    // the chip must RENDER — without one there is nothing for the footer to sit
    // beside and the case above proves nothing. Its second half asserted the
    // footer was SUPPRESSED there; under the ruling both render, so it now
    // asserts both are present rather than that one is missing.
    const pre = renderShared({ results: { status: 'idle', report: null } })
    // Locked Canvas design (23 Sep 2026; spec §4, ED 02:31Z D2): the delta
    // `<li>` list is replaced by the compact change rows. Bound by identity to
    // THIS option's row for the shared factor, from the baseline's value.
    expect(pre.container.querySelectorAll('li').length).toBe(0)
    const row = pre.container.querySelector('[data-testid="option-change-row-option-1-f-head"]')
    expect(row, 'the change row for the shared factor must render').not.toBeNull()
    // Paul 23 Sep contract feedback point 7: an unsourced target is marked on
    // the row (never left bare, never "you") — as "no source", not as Olumi's
    // estimate (Codex #63 5801529767; reviewer blocker, 23 Sep). Contract v3.1
    // pt 7 (gap U12): a muted `·` sets the mark apart from the value.
    expect(row!.textContent).toBe('0 engineers → 3 engineers · no sourceSource not recorded')
    expect(row!.querySelector('[data-testid="option-change-row-source-option-1-f-head"]')?.getAttribute('data-value-source')).toBe('unknown')
  })
})
