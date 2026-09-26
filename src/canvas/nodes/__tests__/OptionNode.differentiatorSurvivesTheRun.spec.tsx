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
 *
 * ⭐ RE-POINTED BY THE BOUNDED ANATOMY (ED #63 5809278282, 24 Sep 2026: the S3
 * detail — change rows, the differentiator — moves "to the existing hover/focus
 * popover and inspector", and the card keeps ONE line: the top change pre-run,
 * the share post-run). The claim is unchanged and now reads where the reason
 * lives: the run must not delete it from the option's POPOVER, which is
 * available in both phases, and the card must still carry its one line.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { optionCardRows, optionPreviewDetail } from './__helpers__/optionPreview'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
// Pass-through popover: the moved detail is in the DOM to be read by identity.
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => <div data-testid="node-popover">{children}</div>,
}))

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

/**
 * ⚠ RE-BOUND WITH ITS REASON (S4, 9914ffa3; ED #63 5806207128 / NODE-ANATOMY
 * v3.2 L4): the row-label budget is now derived from the 260 card — 18
 * characters — so "Developer headcount" (19) is elided ON SCREEN and a text
 * query for EXPECTED finds nothing (and an ABSENCE query for it holds
 * vacuously). The line is found by its test id, and the sentence it states is
 * its visible text when nothing was elided, else its hover recovery
 * (`OptionNode.differentiatorRecoverable.spec` pins that the recovery IS the
 * whole sentence). What this file claims — the run does not delete it — is
 * unchanged.
 */
const DIFF_TESTID = 'option-differentiator-option-1'
const fullSentence = (el: Element | null) => el?.getAttribute('title') ?? el?.textContent
const shownLine = () => {
  // Bounded anatomy: the line lives in option-1's popover detail — found THERE.
  const el = within(optionPreviewDetail('option-1')!).getByTestId(DIFF_TESTID)
  return { el, sentence: fullSentence(el), visible: el.textContent, title: el.getAttribute('title') }
}

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
    expect(shownLine().sentence).toBe(EXPECTED)
  })

  it('⭐ THE TWIN: pre-analysis is UNCHANGED — the same sentence, same card', () => {
    // Held constant so the pair isolates `isPostAnalysis` alone. A mutant that
    // restores either gate REDs the case above and leaves this one GREEN —
    // which is what proves the binding is to the RUN and not to the fixture.
    renderOption({ results: { status: 'idle', report: null } })
    expect(shownLine().sentence).toBe(EXPECTED)
  })

  it('the pair actually AGREE — the sentence is the same before and after', () => {
    const { unmount } = renderOption({ results: { status: 'idle', report: null } })
    const { visible: beforeVisible, title: beforeTitle } = shownLine()
    unmount()
    renderOption({ results: { status: 'complete', report: {} } })
    const { visible: afterVisible, title: afterTitle } = shownLine()
    // The point of the fix is CONTINUITY: running the analysis must not change
    // what the card says about the model's own structure — on screen or on hover.
    expect(afterVisible).toBe(beforeVisible)
    expect(afterTitle).toBe(beforeTitle)
  })

  it('the baseline option is still excluded — the fix did not widen that', () => {
    renderOption(
      { results: { status: 'complete', report: {} } },
      { is_baseline: true },
    )
    // By test id (the S4-elided text made the old text query vacuous); the
    // non-baseline renders above are the same-render-family positive control.
    expect(screen.queryByTestId(DIFF_TESTID)).toBeNull()
    expect(document.body.innerHTML).not.toContain(EXPECTED)
  })

  it('PRECONDITION: the fixture really does produce a differentiator', () => {
    // Without this every assertion above could hold vacuously on a fixture
    // that stopped computing one (CLAUDE.md trap 13b).
    renderOption({ results: { status: 'complete', report: {} } })
    const { visible, sentence } = shownLine()
    expect(visible).toMatch(/ is the key difference$/)
    expect(sentence).toContain('Developer headcount')
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

  /** THIS option's row for a factor, ON THE CARD (Paul 25 Sep: rows at rest). */
  const cardRow = (factorId: string) =>
    optionCardRows('option-1').querySelector(`[data-testid="option-change-row-option-1-${factorId}"]`)
  /**
   * The card's RUN line(s) — the share line or its absence line. The rows are
   * the card's own facts and stay in both phases (Paul 25 Sep); the run ADDS
   * one line below them, never in place of them.
   */
  const runLines = () => {
    const ids = ['option-analysis-currency-option-1', 'option-result-unavailable-option-1']
    return ids.map((id) => document.querySelector(`[data-testid="${id}"]`)).filter((el): el is Element => el !== null)
  }

  it('⭐ POST-ANALYSIS the card is not left bare — its change row still says which factor differs', () => {
    const { container } = renderShared({ results: { status: 'complete', report: {} } })
    // Bind by IDENTITY to THIS option's row for the shared factor — on the card.
    const row = cardRow('f-head')
    expect(row, 'the change row for the shared factor renders after the run').not.toBeNull()
    expect(row!.textContent).toContain('3 engineers')
    expect(container.textContent).toContain('Developer headcount')
    // The card is not bare: its rows STAY after the run (this fixture's run
    // carries no share for the option, so no run line is added), and any run
    // line would sit BELOW them — never a one-line primary change in their place.
    for (const line of runLines()) {
      expect(row!.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
    expect(document.querySelector('[data-testid="option-primary-change-option-1"]')).toBeNull()
    // NODE-ANATOMY v3.2: the footer "Developer headcount → 3 engineers" would
    // only repeat that row, so it does not render — anywhere.
    expect(screen.queryByTestId(DIFF_TESTID)).toBeNull()
    expect(document.body.textContent).not.toContain('Developer headcount → 3 engineers')
  })

  it('THE TWIN: pre-analysis reads the same — the row, and no repeating footer', () => {
    renderShared({ results: { status: 'idle', report: null } })
    expect(cardRow('f-head')).not.toBeNull()
    expect(runLines()).toHaveLength(0)
    expect(screen.queryByTestId(DIFF_TESTID)).toBeNull()
    expect(document.body.textContent).not.toContain('Developer headcount → 3 engineers')
  })

  it('⭐ WHERE THE `→ value` FOOTER ADDS (its factor is behind "+1 more"), it survives the run', () => {
    // THREE equal shared changes lead the shared order (the card shows three
    // rows — Paul 25 Sep; it was two), so the differentiating factor is NOT a
    // shown row and the footer names it.
    const TOOLS = { id: 'f-tools', type: 'factor', data: { label: 'Tooling spend', type: 'factor' } }
    const HOURS = { id: 'f-hours', type: 'factor', data: { label: 'Weekly hours', type: 'factor' } }
    const SEATS = { id: 'f-seats', type: 'factor', data: { label: 'Seats per account', type: 'factor' } }
    const equal = {
      'f-tools': { value: 3, display_value: '£3k' },
      'f-hours': { value: 40, display_value: '40h' },
      'f-seats': { value: 4, display_value: '4 seats' },
    }
    const hidden = {
      ceeAnalysisReady: {
        options: [
          { id: 'option-1', interventions: { ...equal, 'f-head': { value: 3, display_value: '3 engineers' } } },
          { id: 'option-2', interventions: { ...equal, 'f-head': { value: 9, display_value: '9 engineers' } } },
        ],
      },
      nodes: [TOOLS, HOURS, SEATS, SHARED_FACTOR, OPTION_1, OPTION_2],
    }
    const pre = renderShared({ ...hidden, results: { status: 'idle', report: null } })
    expect(cardRow('f-head')).toBeNull()
    // Positive control for that absence: the card DOES carry this option's rows.
    expect(cardRow('f-tools')).not.toBeNull()
    // Whole sentence, from the popover line (bounded anatomy: it renders whole there).
    const preEl = optionPreviewDetail('option-1')!.querySelector(`[data-testid="${DIFF_TESTID}"]`)
    const before = fullSentence(preEl)
    const beforeVisible = preEl?.textContent
    expect(before).toBe('Developer headcount → 3 engineers')
    pre.unmount()
    renderShared({ ...hidden, results: { status: 'complete', report: {} } })
    const postEl = optionPreviewDetail('option-1')!.querySelector(`[data-testid="${DIFF_TESTID}"]`)
    expect(fullSentence(postEl)).toBe(before)
    expect(postEl?.textContent).toBe(beforeVisible)
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
    const row = cardRow('f-head')
    expect(row, 'the change row for the shared factor must render').not.toBeNull()
    // Paul 23 Sep contract feedback point 7: an unsourced target is marked on
    // the row (never left bare, never "you") — as "no source", not as Olumi's
    // estimate (Codex #63 5801529767; reviewer blocker, 23 Sep). Contract v3.1
    // pt 7 (gap U12): a muted `·` sets the mark apart from the value.
    // RE-PINNED (design audit #9, 26 Sep): the value and its mark are joined by
    // ONE no-break space (U+00A0), so the mark cannot drop to a line of its own.
    // Was an ordinary breakable space; every other byte is unchanged.
    expect(row!.textContent).toBe('0 engineers → 3 engineers\u00A0· no sourceSource not recorded')
    expect(row!.querySelector('[data-testid="option-change-row-source-option-1-f-head"]')?.getAttribute('data-value-source')).toBe('unknown')
  })
})
