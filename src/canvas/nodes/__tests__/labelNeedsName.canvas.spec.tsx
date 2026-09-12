/**
 * A factor whose "name" is a quoted sentence must be shown as NEEDING A NAME —
 * never silently presented as if that sentence were an entity.
 *
 * ─── THE DEFECT, AS MEASURED ON PAUL'S LIVE MODEL ───────────────────────────
 * Two modelled causal factors, with Low→High levels, named:
 *
 *     "Operations think extending shifts alone gets us there"
 *     "Finance disagrees and says we will need the second site"
 *
 * and the second used as an option's differentiator, so the canvas states that
 * the key difference between two options IS a colleague's stated opinion.
 *
 * ─── WHAT THIS FILE PINS, AND WHAT IT DELIBERATELY DOES NOT ─────────────────
 * It pins DISCLOSURE. It does NOT pin any authored name, because this layer is
 * forbidden to author one (`NODE-NAME-CLAIM-CONTRACT-2026-09-03.md`). Asserting
 * a shortened name here is how a render-layer naming rule would get smuggled in
 * past review, so the no-invention assertion below is load-bearing: the label
 * must reach the DOM byte-identical.
 *
 * ─── THE CORPUS IS NOT FROM THIS LANE'S HEAD ────────────────────────────────
 * `SPEC_E4_RAW_SPAN_LABELS` and `REAL_AUTHORED_FACTOR_NAMES` are LIVE CAPTURES,
 * banked in `Talchain/olumi-programme-docs` (`artefacts/b2-draws-2026-09-03/`,
 * `manual-test-2026-09-03`, `leg5-postrun-2026-09-03`). SPEC §E2 requires both
 * directions and says why one alone proves nothing: a gate that reddens
 * everything discriminates nothing.
 *
 * ⚠ THESE TWO ARRAYS ARE HISTORIC RECORDS OF STRINGS THE PRODUCT ACTUALLY
 * EMITTED ON DATED BUILDS. They are append-only. Do not "tidy" them to match a
 * later build — CLAUDE.md trap 14b.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { OptionNode } from '../OptionNode'
import {
  labelNeedsName,
  readsAsSentence,
  isVerbatimBriefLabel,
  LABEL_NEEDS_NAME_TESTID,
  LABEL_NEEDS_NAME_MARKER,
} from '../../domain/labelNeedsName'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null })
  ),
}))
// Spread the real flags module so a newly-added flag never goes silently absent
// and throws at render — CLAUDE.md #12 (derive, don't mirror).
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isGraphBadgesEnabled: vi.fn(() => false),
  isCrossHighlightEnabled: vi.fn(() => false),
  isGraphLensEnabled: vi.fn(() => false),
}))
vi.mock('../../hooks/useScienceIcons', () => ({ useScienceIcons: vi.fn(() => []) }))
vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({ useNodeDisplayMetadata: vi.fn() }))
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="node-popover">{children}</div>
  ),
}))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'

/** Paul's two live labels, read off the deployed canvas. */
const PAUL_FACTOR_A = 'Operations think extending shifts alone gets us there'
const PAUL_FACTOR_B = 'Finance disagrees and says we will need the second site'

/**
 * SPEC §E4's positive-control set — 11 raw-span factor labels, every one a live
 * capture. SPEC §E2: the gate MUST go red on all 11, or it is not measuring
 * what it claims.
 */
const SPEC_E4_RAW_SPAN_LABELS: ReadonlyArray<string> = [
  "our CTO says it's more like 40%, and if he's right the engineering cost roughly doubles",
  'two US competitors raised big rounds in Q2',
  "I honestly don't know whether the Germany window closes if we wait a year — two US competitors raised big rounds in Q2",
  'NRR is 112%',
  "the monolith adds roughly 30% drag to every feature — that's the number the CTO keeps quoting, source unclear, possibly the 2024 DX survey",
  'we lost two staff engineers to it last year — the exit interviews say so explicitly',
  "legal has NOT confirmed this, and if it's wrong the whole thing is dead in enterprise, which is 60% of revenue",
  'three competitors shipped copilots in the last two quarters, PMM says we\'re 12 months behind already, and waiting a year might mean entering dead',
  'We\'ve heard from three churned customers that they left because of missing integrations, not price — so we think product gaps mediate the relationship between customer satisfaction and churn',
  'hiring would free this up for product, which we believe indirectly affects retention through product quality improvements',
  'which we believe is partly driven by product quality and partly by how much attention each trial gets from the founder',
]

/**
 * SPEC §E2's contrast control: real model-authored factor/risk/outcome names
 * from the b2 draws, plus the two the brief names. A false positive HERE is the
 * expensive error — it hides a legitimate name behind a "needs a name" marker.
 *
 * The last five are deliberately adversarial: each is a plural noun or a bare
 * stem that is ALSO a verb, i.e. exactly what a careless verb list would trip
 * over.
 */
const REAL_AUTHORED_FACTOR_NAMES: ReadonlyArray<string> = [
  'Channel Partner Programme Investment',
  'Competitive Intensity',
  'Market Demand',
  'Outbound Sales Headcount Investment',
  'Partner Enablement Quality',
  'Partner Pipeline Coverage',
  'Partner Ramp Time',
  'Product-Led Growth Investment',
  'Sales Cycle Length',
  'Sales Ramp Time',
  'Self-Serve Conversion Rate',
  'Budget Burn Without Pipeline',
  'Time to Revenue',
  'Status Quo — Hold Current GTM',
  'Continue Current Go-to-Market (Status Quo)',
  'Add £3m of New ARR Within Eighteen Months',
  'Customer Success Headcount',
  'Carrier Cut-off Compliance',
  'Efficiency Gains',
  'Trade Shows',
  'Length of Stay',
  'Customer Need',
  'Tier 1 Support Coverage',
]

const baseFactorProps = {
  type: 'factor',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
}

function applyStore(state: Record<string, unknown>) {
  vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
    selector({
      hoveredOptionId: null,
      nodes: [],
      edges: [],
      ceeAnalysisReady: null,
      results: { status: 'idle', report: null },
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
      goalThreshold: null,
      goalConstraints: [],
      setHoveredOption: vi.fn(),
      runMeta: { ceeReview: null },
      viewMode: 'standard',
      ...state,
    })
  )
}

/**
 * Render ONE factor node and hand back the element for THAT node id.
 *
 * ⚠ BINDING IS BY NODE ID, NEVER BY COPY. A `getByText(/needs a name/i)` would
 * pass on any node in the tree that happened to carry the marker, which is
 * precisely the defect CLAUDE.md trap 19 describes — a test passing on a
 * different object than the one it was written for.
 */
function renderFactorById(id: string, data: Record<string, unknown>) {
  const { container } = render(
    <ReactFlowProvider>
      <FactorNode {...baseFactorProps} id={id} data={{ type: 'factor', ...data }} />
    </ReactFlowProvider>
  )
  const node = container.querySelector(`[data-id="${id}"]`) ?? container.firstElementChild
  if (!node) throw new Error(`no rendered node for id ${id}`)
  return node as HTMLElement
}

beforeEach(() => {
  vi.clearAllMocks()
  applyStore({})
  vi.mocked(useNodeDisplayMetadata).mockReturnValue({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
    winRate: null,
    isResultsMode: false,
  } as any)
})

describe('labelNeedsName — the predicate', () => {
  it("fires on BOTH of Paul's live factor labels", () => {
    expect(labelNeedsName({ label: PAUL_FACTOR_A, source_quote: PAUL_FACTOR_A })).toBeTruthy()
    expect(labelNeedsName({ label: PAUL_FACTOR_B, source_quote: PAUL_FACTOR_B })).toBeTruthy()
  })

  it('SPEC §E2 POSITIVE CONTROL — reddens all 11 banked raw-span labels', () => {
    const missed = SPEC_E4_RAW_SPAN_LABELS.filter(l => !readsAsSentence(l))
    expect(missed).toEqual([])
    expect(SPEC_E4_RAW_SPAN_LABELS).toHaveLength(11)
  })

  it('SPEC §E2 CONTRAST CONTROL — never fires on a real model-authored name', () => {
    const wrongly = REAL_AUTHORED_FACTOR_NAMES.filter(l => labelNeedsName({ label: l }))
    expect(wrongly).toEqual([])
  })

  it('fires with NO source_quote — the signal must not go dark when the producer sends none', () => {
    // All three of NODE-NAME-CLAIM-CONTRACT's quoted canvas offenders arrive
    // with neither `provenance` nor `source_quote`. A predicate that required
    // proof of verbatim could not see the case it was written for.
    expect(labelNeedsName({ label: PAUL_FACTOR_A })).toBeTruthy()
    expect(
      labelNeedsName({
        label: 'which we believe is partly driven by product quality and partly by how much attention each trial gets from the founder',
      })
    ).toBeTruthy()
  })

  it('VETO — a producer-AUTHORED label is never flagged, even if it reads as a sentence', () => {
    // ⚠ Constructed, not captured: 0 of the 144 banked labels are both
    // sentence-shaped AND carry a differing source_quote, so the real corpus
    // does not exercise this branch. Stated so the evidence is not overclaimed.
    const authored = { label: 'Engineering Attrition Is Rising', source_quote: 'we lost two staff engineers to it last year' }
    expect(readsAsSentence(authored.label)).toBeTruthy()   // precondition: shape gate WOULD fire
    expect(labelNeedsName(authored)).toBe(false)           // …and the veto suppresses it
  })

  it('isVerbatimBriefLabel proves authorship only when the quote is present AND equal', () => {
    expect(isVerbatimBriefLabel({ label: PAUL_FACTOR_A, source_quote: PAUL_FACTOR_A })).toBe(true)
    expect(isVerbatimBriefLabel({ label: PAUL_FACTOR_A })).toBe(false)
    expect(isVerbatimBriefLabel({ label: PAUL_FACTOR_A, source_quote: 'something else' })).toBe(false)
  })
})

describe('Canvas factor node — a sentence is shown as needing a name', () => {
  it.each([
    ['paul-factor-a', PAUL_FACTOR_A],
    ['paul-factor-b', PAUL_FACTOR_B],
  ])('%s renders the needs-a-name marker, bound to that node', (id, label) => {
    const node = renderFactorById(id, { label, source_quote: label })
    expect(within(node).getByTestId(LABEL_NEEDS_NAME_TESTID).textContent).toContain(
      LABEL_NEEDS_NAME_MARKER
    )
  })

  it.each([
    ['paul-factor-a', PAUL_FACTOR_A],
    ['paul-factor-b', PAUL_FACTOR_B],
  ])('%s shows the sentence as a QUOTATION, never as a bare entity name', (id, label) => {
    const node = renderFactorById(id, { label, source_quote: label })
    const quoted = within(node).getByTestId('node-title-quoted')
    // The quotation marks are the disclosure: the string is reported, not named.
    expect(quoted.textContent).toBe(`“${label}”`)
  })

  it.each([
    ['paul-factor-a', PAUL_FACTOR_A],
    ['paul-factor-b', PAUL_FACTOR_B],
  ])('%s NEVER invents, truncates or title-cases a name', (id, label) => {
    const node = renderFactorById(id, { label, source_quote: label })
    // ⭐ THE NO-INVENTION GATE. The user's sentence must reach the DOM
    // byte-identical — no ellipsis, no Title Case, no first-clause-only.
    expect(node.textContent).toContain(label)
    const title = within(node).getByTestId('node-title')
    expect(title.textContent).not.toMatch(/…|\.\.\./)
  })

  it('CONTRAST — a genuine multi-word factor name gets NO marker and NO quotation', () => {
    const node = renderFactorById('real-name', { label: 'Customer Success Headcount' })
    expect(within(node).queryByTestId(LABEL_NEEDS_NAME_TESTID)).toBeNull()
    expect(within(node).queryByTestId('node-title-quoted')).toBeNull()
    expect(within(node).getByTestId('node-title').textContent).toBe('Customer Success Headcount')
  })

  it('CONTRAST — every banked authored name renders unmarked', () => {
    for (const label of REAL_AUTHORED_FACTOR_NAMES) {
      const node = renderFactorById(`n-${label.slice(0, 12)}`, { label })
      expect(
        within(node).queryByTestId(LABEL_NEEDS_NAME_TESTID),
        `"${label}" was wrongly marked as needing a name`
      ).toBeNull()
    }
  })
})

describe('Option differentiator — an unnamed factor is not asserted as an entity', () => {
  /**
   * ⚠ THREE options and THREE factors, and that is a PRECONDITION, not scenery.
   *
   * The "<X> is the key difference" branch needs exactly ONE option to claim a
   * factor as its top differentiator (`factorClaimCount <= 1`,
   * `OptionNode.tsx:299`). With only TWO options that is UNREACHABLE: each
   * option's score for a factor is `|mine − theirs|`, which is the SAME number
   * for both, so both always claim the same factor, the card takes the
   * "<X> → <value>" branch, and Phase 4 then dedupes the identical sentences
   * away. Three options, each dominant on its own factor, is the smallest
   * topology that reaches the branch.
   *
   * Getting this wrong does not fail loudly — it renders NO footer, and every
   * `not.toContain(...)` assertion below would pass while measuring nothing
   * (CLAUDE.md trap 13). It was wrong on the first run of this file, and
   * `expectDifferentiatorFooter` is what caught it.
   */
  const differentiatorState = (factorLabel: string, extra: Record<string, unknown> = {}) => ({
    viewMode: 'standard',
    nodes: [
      // ⚠ `is_baseline: false` is EXPLICIT and load-bearing. `detectBaseline`
      // is a SUBSTRING match over 13 keywords and fires only as a fallback when
      // the flag is null/undefined — and Paul's real option label, "Extend
      // Shift Hours at the Existing Site", contains "existing". Without the
      // explicit flag this option renders as the baseline card, which has no
      // differentiator footer at all, and every assertion below would measure
      // nothing.
      { id: 'option-1', type: 'option', data: { label: 'Extend Shift Hours at the Existing Site', type: 'option', is_baseline: false } },
      { id: 'option-2', type: 'option', data: { label: 'Open a Second Warehouse in Manchester', type: 'option', is_baseline: false } },
      { id: 'option-3', type: 'option', data: { label: 'Lease Overflow Space in Warrington', type: 'option', is_baseline: false } },
      { id: 'factor-1', type: 'factor', data: { label: factorLabel, observedState: { value: 0.5 }, ...extra } },
      { id: 'factor-2', type: 'factor', data: { label: 'Depot Handover Lead Time', observedState: { value: 0.5 } } },
      { id: 'factor-3', type: 'factor', data: { label: 'Agency Staffing Cover', observedState: { value: 0.5 } } },
    ],
    edges: [],
    ceeAnalysisReady: {
      options: [
        { id: 'option-1', interventions: { 'factor-1': 0.95, 'factor-2': 0.5, 'factor-3': 0.5 } },
        { id: 'option-2', interventions: { 'factor-1': 0.5, 'factor-2': 0.95, 'factor-3': 0.5 } },
        { id: 'option-3', interventions: { 'factor-1': 0.5, 'factor-2': 0.5, 'factor-3': 0.95 } },
      ],
    },
    results: { status: 'idle', report: null },
  })

  /** The footer, with its own existence asserted first. */
  function expectDifferentiatorFooter(container: HTMLElement): HTMLElement {
    const footer = Array.from(container.querySelectorAll('p')).find(p =>
      /key difference/i.test(p.textContent ?? '')
    )
    expect(
      footer,
      'PRECONDITION FAILED: no "key difference" footer rendered, so this test would measure nothing'
    ).toBeDefined()
    return footer as HTMLElement
  }

  function renderOptionCard() {
    const { container } = render(
      <ReactFlowProvider>
        <OptionNode
          {...baseFactorProps}
          id="option-1"
          type="option"
          data={{ label: 'Extend Shift Hours at the Existing Site', type: 'option', is_baseline: false }}
        />
      </ReactFlowProvider>
    )
    return container
  }

  it("never says a colleague's opinion IS the key difference", () => {
    applyStore(differentiatorState(PAUL_FACTOR_B, { source_quote: PAUL_FACTOR_B }))
    const container = renderOptionCard()
    const footer = expectDifferentiatorFooter(container)   // precondition, in-test
    const text = footer.textContent ?? ''
    // ⛔ THE EXACT DEFECT: the sentence asserted as the differentiating entity.
    expect(text).not.toContain(`${PAUL_FACTOR_B} is the key difference`)
    // Capitalised-leading form too — the pre-fix code upper-cased the token.
    const capitalised = PAUL_FACTOR_B.charAt(0).toUpperCase() + PAUL_FACTOR_B.slice(1)
    expect(text).not.toContain(`${capitalised} is the key difference`)
  })

  it('marks the differentiator as an unnamed factor and quotes it', () => {
    applyStore(differentiatorState(PAUL_FACTOR_B, { source_quote: PAUL_FACTOR_B }))
    const footer = expectDifferentiatorFooter(renderOptionCard())
    expect(footer.textContent).toMatch(/Unnamed factor/)
    expect(footer.textContent).toContain('“')
  })

  it('CONTRAST — a properly named differentiator keeps the plain sentence', () => {
    applyStore(differentiatorState('Carrier Cut-off Compliance'))
    const footer = expectDifferentiatorFooter(renderOptionCard())
    expect(footer.textContent).not.toMatch(/Unnamed factor/)
    expect(footer.textContent).toMatch(/is the key difference/)
  })
})
