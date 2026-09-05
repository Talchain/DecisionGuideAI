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
 * recovery. Both nodes carry a node-level aria-label ("option node: Hire
 * Three Account Executives. One possible course of action") which does NOT
 * contain the truncated words. A recovery only counts when the recovering
 * string ACTUALLY CONTAINS the visible prefix and is LONGER than the visible
 * text. Every assertion below is written to that standard.
 *
 * ⚠ NOT a licence to un-truncate. The file's standing rule is "label
 * truncates, value NEVER truncates" (PR #1220, merged and deployed). The
 * label truncation here is BY DESIGN and stays; what changes is that the
 * elided text becomes recoverable — the standard the file already sets for
 * itself at the intervention-chip site ("so the full string was recoverable").
 *
 * Assertions bind by IDENTITY (the exact factor label under test), never by a
 * value predicate another node could satisfy.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

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
 * The RECOVERY STANDARD, applied to one `<p>`.
 *
 * `visible` must genuinely be an ellipsised string (otherwise the test would
 * pass on a sentence nothing elided, i.e. by testing nothing — so the
 * precondition is pinned IN-TEST, not assumed).
 */
const assertRecoverable = (el: HTMLElement, expectedFullFragment: string) => {
  const visible = el.textContent ?? ''
  // Precondition: this really is an elided string. Without this the whole
  // assertion could hold on a sentence that was never truncated.
  expect(visible).toContain('…')
  const prefix = visible.split('…')[0]
  expect(prefix.length).toBeGreaterThan(0)

  const title = el.getAttribute('title')
  expect(title).not.toBeNull()
  // The recovery must CONTAIN the visible prefix — a node-level aria-label
  // that merely exists does not recover anything.
  expect(title!).toContain(prefix)
  // …and it must be LONGER than what is already on screen, or it recovers
  // nothing.
  expect(title!.length).toBeGreaterThan(visible.length)
  // …and it must carry the specific elided words, bound by identity.
  expect(title!).toContain(expectedFullFragment)
  // The recovery is the whole sentence, not a bare label: it keeps the frame
  // so the hover reads as the same claim.
  expect(title!).not.toContain('…')
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
            { id: 'option-1', interventions: { 'factor-ae': 0.9 } },
            { id: 'option-2', interventions: { 'factor-budget': 0.9 } },
          ],
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { label: 'Hire Three Account Executives', type: 'option' } },
          { id: 'option-2', type: 'option', data: { label: 'Hold Headcount', type: 'option' } },
          {
            id: 'factor-ae',
            type: 'factor',
            data: { label: 'Account Executives hired', observedState: { unit: 'scale', value: 0.1 } },
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
    const p = screen.getByText(/is the key difference/i)
    expect(p.tagName).toBe('P')
    expect(p.textContent).toBe('Account Executives… is the key difference')
    assertRecoverable(p, 'Account Executives hired is the key difference')
  })

  // Witnessed shape 2: "Platform Engineer… → Low (0)".
  it('recovers the elided factor label on the "→ value" branch', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [
            { id: 'option-1', interventions: { 'factor-pe': { value: 0.1, display_value: 'Low (0)' } } },
            { id: 'option-2', interventions: { 'factor-pe': { value: 0.9, display_value: 'High (1)' } } },
          ],
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { label: 'Hire Three Account Executives', type: 'option' } },
          { id: 'option-2', type: 'option', data: { label: 'Hold Headcount', type: 'option' } },
          {
            id: 'factor-pe',
            type: 'factor',
            data: { label: 'Platform Engineers hired', observedState: { unit: 'scale', value: 0.5 } },
          },
        ],
        viewMode: 'standard',
      }) as any),
    )
    renderOption({ label: 'Hire Three Account Executives' })

    const p = screen.getByText(/Platform Engineers… → Low \(0\)/)
    expect(p.tagName).toBe('P')
    assertRecoverable(p, 'Platform Engineers hired → Low (0)')
  })

  // NEGATIVE CONTROL — nothing elided, so hover must NOT repeat the visible
  // text. Without this the fix could pass by attaching a title unconditionally.
  it('attaches no title when nothing was elided', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [
            { id: 'option-1', interventions: { 'factor-budget': 0.9 } },
            { id: 'option-2', interventions: { 'factor-other': 0.9 } },
          ],
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { label: 'Hire Three Account Executives', type: 'option' } },
          { id: 'option-2', type: 'option', data: { label: 'Hold Headcount', type: 'option' } },
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

    const p = screen.getByText(/is the key difference/i)
    expect(p.tagName).toBe('P')
    expect(p.textContent).toBe('Budget is the key difference')
    expect(p.textContent).not.toContain('…')
    expect(p.getAttribute('title')).toBeNull()
  })
})
