/**
 * OptionNode — the differentiator footer's elided text must be RECOVERABLE.
 *
 * WITNESSED ON DEPLOYED STAGING `16336b13` (canvas nodes, every text node
 * inside `.react-flow__node` walked and each ellipsis classified): six
 * truncations, four recoverable via an ancestor `title`, and TWO
 * UNRECOVERABLE — both this `<p>`:
 *
 *     "Platform Engineer… → Low (0)"
 *     "Account Executive… is the key difference"
 *
 * Both carry `text-overflow: clip`, so the "…" is IN THE TEXT: a JS
 * truncation, and the full string is simply ABSENT from the DOM. The second
 * is the serious one — a claim about what differentiates an option, with the
 * SUBJECT of the claim truncated away.
 *
 * ⭐ THE RECOVERY STANDARD THESE TESTS ENFORCE, and why it is not
 * `toBeTruthy()`: the first probe of the deployed build reported "zero
 * unrecoverable" because it counted ANY ancestor `title`/`aria-label` as
 * recovery. Both nodes carry a node-level aria-label (GAP-36, 24 Sep 2026:
 * now "Option: Hire Three Account Executives. Open details.", was "option
 * node: Hire Three Account Executives. One possible course of action") which
 * does NOT contain the truncated words either way. A recovery only counts
 * when the recovering string ACTUALLY CONTAINS the visible prefix and is
 * LONGER than the visible text. Every assertion below is written to that
 * standard.
 *
 * ⚠ NOT a licence to un-truncate. The file's standing rule is "label
 * truncates, value NEVER truncates" (PR #1220, merged and deployed). The
 * label truncation here is BY DESIGN and stays; what changes is that the
 * elided text becomes recoverable — the standard the file already sets for
 * itself at the intervention-chip site ("so the full string was recoverable").
 *
 * Assertions bind by IDENTITY (the exact factor label under test), never by a
 * value predicate another node could satisfy.
 *
 * ⚠ FIXTURES WIDENED WITH THEIR REASON (NODE-ANATOMY v3.2, ED #63 5806266691:
 * "differentiator only when additive"). The footer now renders only when it
 * adds something the change rows don't — never "<only row> is the key
 * difference", never "<shown row> → <its value>". So each fixture gives option-1
 * a second, SHARED change (equal on both options, so it never differentiates):
 * the key-difference form then says which of two changes matters, and the
 * "→ value" form names a change that sits behind "+N more". The recovery
 * standard is untouched.
 *
 * ⭐ RE-POINTED BY THE BOUNDED ANATOMY (ED #63 5809278282, 24 Sep 2026: the S3
 * detail — including the differentiator — moves "to the existing hover/focus
 * popover and inspector rather than expanding layout geometry"). The sentence
 * is no longer a card footer compacted to the card's budget: it lives in the
 * option's popover, which has the room, and renders WHOLE there. So the
 * standard this file enforces gets STRONGER, not weaker — there is no elided
 * form left anywhere in the DOM for a user to be stranded on, and the negative
 * control still refuses a hover that merely repeats what is shown.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { optionPreviewDetail } from './__helpers__/optionPreview'
import { compactFactorLabel } from '../../utils/labelUtils'
import { NODE_ROW_LABEL_MAX_CHARS } from '../../utils/nodeLayoutConstants'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
// Pass-through popover: the moved detail is in the DOM to be read by identity.
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => <div data-testid="node-popover">{children}</div>,
}))

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  hoveredOptionId: null,
  nodes: [],
  edges: [],
  ceeAnalysisReady: null,
  results: { status: 'idle', report: null },
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
    winRate: null,
    isResultsMode: false,
    predictedOutcome: null,
    valueOfInformation: null,
    voiRank: null,
  })),
}))

import { useCanvasStore } from '../../store'
import { useLayoutStore } from '../../layoutStore'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'

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
  // React Flow's NodeProps requires these three. The sibling OptionNode.spec
  // omits them and carries a standing typecheck error for it; this spec does
  // not add a second one to the baseline.
  deletable: true,
  selectable: true,
  draggable: true,
}

const renderOption = (data: Record<string, unknown> = {}) =>
  render(
    <ReactFlowProvider>
      <OptionNode {...baseProps} data={{ label: 'Hire Three Account Executives', type: 'option', ...data }} />
    </ReactFlowProvider>
  )

/**
 * The RECOVERY STANDARD, applied where the sentence now lives.
 *
 * The line must be the option's own popover line (identity: its test id, inside
 * `option-preview-detail-<id>`), carry the WHOLE sentence — the specific words
 * the card used to elide — with no "…", and the elided form must exist NOWHERE
 * in the document (the defect was an ellipsis with nowhere to go; now there is
 * no ellipsis to strand anyone on).
 */
const assertWhole = (el: HTMLElement, expectedFull: string, fullLabel: string) => {
  // Identity: THIS option's line, inside THIS option's popover detail.
  expect(el.getAttribute('data-testid')).toBe('option-differentiator-option-1')
  expect(optionPreviewDetail('option-1')!.contains(el)).toBe(true)
  // Precondition, COMPUTED by the card's own compaction at its own budget: the
  // old footer really elided this label — so the test is about a sentence that
  // used to be cut, not one that never was.
  expect(expectedFull.startsWith(fullLabel)).toBe(true)
  const compact = compactFactorLabel(fullLabel, NODE_ROW_LABEL_MAX_CHARS)
  expect(compact).toContain('…')
  expect(el.textContent).toBe(expectedFull)
  expect(el.textContent).not.toContain('…')
  // …and the elided SENTENCE (the compact label followed by the sentence frame)
  // exists nowhere. (The popover's own change row may still show the compact
  // LABEL with its full name beside it — that is a row, not this claim.)
  const elidedSentenceStart = compact + expectedFull.slice(fullLabel.length, fullLabel.length + 4)
  expect(document.body.textContent).not.toContain(elidedSentenceStart)
}

describe('OptionNode differentiator — elided text is recoverable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState() as any))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: false,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    } as any)
    vi.mocked(useLayoutStore).mockImplementation(((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
      selector({ layoutNodeWidth: null })) as never)
  })

  // Witnessed shape 1: "Account Executive… is the key difference".
  it('recovers the elided factor label on the "is the key difference" branch', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [
            { id: 'option-1', interventions: { 'factor-ae': 0.9, 'factor-shared': { value: 3, display_value: '£3k' } } },
            { id: 'option-2', interventions: { 'factor-budget': 0.9, 'factor-shared': { value: 3, display_value: '£3k' } } },
          ],
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { label: 'Hire Three Account Executives', type: 'option' } },
          { id: 'option-2', type: 'option', data: { label: 'Hold Headcount', type: 'option' } },
          { id: 'factor-shared', type: 'factor', data: { label: 'Tooling spend' } },
          {
            id: 'factor-ae',
            type: 'factor',
            data: { label: 'Account Executives hired in region', observedState: { unit: 'scale', value: 0.1 } },
          },
          {
            id: 'factor-budget',
            type: 'factor',
            data: { label: 'Budget', observedState: { unit: 'scale', value: 0.1 } },
          },
        ],
        viewMode: 'standard',
      }) as any),
    )
    renderOption({ label: 'Hire Three Account Executives' })

    // IDENTITY binding: the sentence for THIS option's own top factor.
    const p = screen.getByTestId('option-differentiator-option-1')
    expect(p.tagName).toBe('P')
    // ⚠ CASING UPDATED WITH ITS REASON, never silently. The producer wrote
    // "Account Executives hired"; the card's intervention row has always
    // sentence-cased a factor name and this sentence did not, so one card
    // named one factor two ways (measured on the `pricing-model` starter —
    // `OptionNode.oneFactorOneName.spec.tsx`). Both carriers now delegate to
    // `sentenceCaseFactorLabel`. The TRUNCATION under test here is unchanged.
    // ⚠ FIXTURE LENGTHENED WITH ITS REASON, never silently. The row-label budget
    // is now DERIVED from the card width and the counter-scale
    // (`NODE_ROW_LABEL_MAX_CHARS`, measured at 25 against a hand-set 20), and at
    // 25 the old fixture "Account Executives hired" is 24 characters — it
    // renders WHOLE, so this test's subject stopped existing. A test for
    // recoverable ELISION needs a label that is still elided. The recovery
    // standard below is untouched; only the fixture is longer.
    // ⚠ CUT MOVED WITH THE CARD (S4, 9914ffa3; ED #63 5806207128 / NODE-ANATOMY
    // v3.2 L4 "the fix is card anatomy (shorter cards)"): the budget is now
    // derived from the 260 card — 18 characters — so the visible cut is earlier.
    // The label is still elided and the recovery standard is unchanged.
    // Bounded anatomy: the card cut ("Account executives… is the key
    // difference") is gone; the popover line is the whole sentence.
    assertWhole(p, 'Account executives hired in region is the key difference', 'Account executives hired in region')
  })

  // Witnessed shape 2: "Platform Engineer… → Low (0)".
  it('recovers the elided factor label on the "→ value" branch', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [
            // Two shared, equal changes come first in the shared order, so the
            // differentiating factor sits behind "+1 more" and the footer ADDS it.
            { id: 'option-1', interventions: { 'factor-tools': { value: 3, display_value: '£3k' }, 'factor-hours': { value: 40, display_value: '40h' }, 'factor-pe': { value: 0.1, display_value: 'Low (0)' } } },
            { id: 'option-2', interventions: { 'factor-tools': { value: 3, display_value: '£3k' }, 'factor-hours': { value: 40, display_value: '40h' }, 'factor-pe': { value: 0.9, display_value: 'High (1)' } } },
          ],
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { label: 'Hire Three Account Executives', type: 'option' } },
          { id: 'option-2', type: 'option', data: { label: 'Hold Headcount', type: 'option' } },
          { id: 'factor-tools', type: 'factor', data: { label: 'Tooling spend' } },
          { id: 'factor-hours', type: 'factor', data: { label: 'Weekly hours' } },
          {
            id: 'factor-pe',
            type: 'factor',
            data: { label: 'Platform Engineers hired onto the team', observedState: { unit: 'scale', value: 0.5 } },
          },
        ],
        viewMode: 'standard',
      }) as any),
    )
    renderOption({ label: 'Hire Three Account Executives' })

    // Same casing change as above; the recovery standard is what this asserts.
    // Same fixture lengthening as above, same reason.
    // Precondition: the factor it names is NOT a shown row (it is behind "+1 more").
    expect(screen.queryByTestId('option-change-row-option-1-factor-pe')).toBeNull()
    expect(within(optionPreviewDetail('option-1')!).getByTestId('option-change-more-option-1').textContent).toBe('+1 more')
    // Same S4 cut as above (18 characters at the 260 card, 9914ffa3).
    // S5 (24 Sep): at rest the reading sheds its internal-scale number (R6, as
    // every change row does); the hover keeps the producer's full reading.
    // Bounded anatomy: the popover line keeps the producer's full reading —
    // the at-rest collapse ("→ Low") was a card-budget measure the popover
    // does not need.
    const p = screen.getByTestId('option-differentiator-option-1')
    expect(p.tagName).toBe('P')
    assertWhole(p, 'Platform engineers hired onto the team → Low (0)', 'Platform engineers hired onto the team')
  })

  // NEGATIVE CONTROL — nothing elided, so hover must NOT repeat the visible
  // text. Without this the fix could pass by attaching a title unconditionally.
  it('attaches no title when nothing was elided', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [
            { id: 'option-1', interventions: { 'factor-budget': 0.9, 'factor-shared': { value: 3, display_value: '£3k' } } },
            { id: 'option-2', interventions: { 'factor-other': 0.9, 'factor-shared': { value: 3, display_value: '£3k' } } },
          ],
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { label: 'Hire Three Account Executives', type: 'option' } },
          { id: 'option-2', type: 'option', data: { label: 'Hold Headcount', type: 'option' } },
          { id: 'factor-shared', type: 'factor', data: { label: 'Tooling spend' } },
          {
            id: 'factor-budget',
            type: 'factor',
            data: { label: 'Budget', observedState: { unit: 'scale', value: 0.1 } },
          },
          {
            id: 'factor-other',
            type: 'factor',
            data: { label: 'Runway', observedState: { unit: 'scale', value: 0.1 } },
          },
        ],
        viewMode: 'standard',
      }) as any),
    )
    renderOption({ label: 'Hire Three Account Executives' })

    const p = screen.getByTestId('option-differentiator-option-1')
    expect(p.tagName).toBe('P')
    expect(optionPreviewDetail('option-1')!.contains(p)).toBe(true)
    expect(p.textContent).toBe('Budget is the key difference')
    expect(p.textContent).not.toContain('…')
    expect(p.getAttribute('title')).toBeNull()
  })
})
