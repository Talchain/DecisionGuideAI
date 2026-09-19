/**
 * THE FOUNDER'S FACTOR CARD FACE — RENDER-REACHABLE, NOT MODULE-REACHABLE.
 *
 * ⭐ WHY THIS FILE EXISTS ALONGSIDE THE UNIT SPEC. The policy is pinned at
 * `formatFactorDisplayValue`'s own boundary in
 * `src/utils/__tests__/formatFactorDisplayValue.placeholderMagnitude.spec.ts`.
 * That proves the FORMATTER is right. It does not prove the formatter is what
 * the founder is looking at — and in this estate that gap has cost two lanes in
 * one day: an import-graph closure shortlisted `NodeInspector`/`EdgeInspector`
 * as live on a genuine depth-5 chain while both are statically dead behind a
 * module-literal flag and an early `return`. **An early return above a use site
 * is invisible to a closure.**
 *
 * So the family was established by EXECUTION, and this spec is that execution,
 * kept: it renders the real `FactorNode` and reads its text content. The
 * discriminating measurement, run at pristine before the fix:
 *   · `{ value: 0.3, unit: 'scale' }` with NO `display_value` → card body EMPTY
 *     (the two numeric gates hold, exactly as their docblocks claim);
 *   · the SAME state plus `display_value: '0.3 scale'` → face reads
 *     `0.3 scale`.
 * One input differs; the face changes. That isolates the `display_value`
 * verbatim passthrough as the path the founder sees, and it is a claim about
 * what RENDERS, not about what imports what.
 *
 * ⭐ THE FIRST TEST BELOW IS THE DISCRIMINATOR AND IT PINS ITS OWN PRECONDITION.
 * It asserts the no-`display_value` arm is EMPTY in the same run as the
 * passthrough arm. If a later change makes the numeric gates start rendering
 * something, the two arms stop differing and this spec REDs rather than
 * quietly agreeing with itself — the decay that cost a merged PR its control
 * today.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

/**
 * ⚠ `viewMode` IS NOT A DETAIL — IT DECIDES WHETHER THE FOUNDER'S FACE EXISTS.
 * `FactorNode.tsx:62` is `isDetailed = viewMode === 'expert'`, and the `est.`
 * marker renders only when `isInferred && !isDetailed`. The founder's cards read
 * `0.3 scale est.`, so his board is in the STANDARD view. A spec fixed to
 * 'expert' would be testing a face he is not looking at — trap 3b's shape, where
 * every instrument agrees because all of them point at the wrong surface. This
 * harness therefore runs the founder's view by default and pins the expert view
 * separately.
 */
let viewMode: 'expert' | 'standard' = 'standard'

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) =>
    selector({
      hoveredOptionId: null, nodes: [], edges: [], ceeAnalysisReady: null,
      results: { status: 'idle', report: null }, highlightedNodes: new Set(),
      dimmedNodeIds: new Set(), goalThreshold: null, goalConstraints: [],
      viewMode,
    })
  ),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null,
    stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))

vi.mock('../../hooks/useScienceIcons', () => ({ useScienceIcons: vi.fn(() => []) }))

vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="factor-node-popover">{children}</div>
  ),
}))

vi.mock('../../../flags', () => ({
  isGraphBadgesEnabled: vi.fn(() => false),
  isCrossHighlightEnabled: vi.fn(() => false),
  isGraphLensEnabled: vi.fn(() => false),
}))

// ⚠ `deletable`, `selectable` and `draggable` are REQUIRED by NodeProps and are
// spelled out rather than cast away. The sibling FactorNode specs carry this as
// a baselined type error; a new file may not add one, and the typecheck ratchet
// is right to refuse it — so this props object is complete instead.
const baseProps = {
  id: 'factor-1', type: 'factor', position: { x: 0, y: 0 }, selected: false,
  isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0,
  dragging: false, zIndex: 0, deletable: true, selectable: true, draggable: true,
}

const renderFactor = (data: Record<string, unknown>) =>
  render(<ReactFlowProvider><FactorNode {...baseProps} data={data} /></ReactFlowProvider>)

const faceText = (c: HTMLElement) => (c.textContent ?? '').replace(/\s+/g, ' ').trim()

/** The founder's shape: an inferred factor on a placeholder scale. */
const founderFactor = (value: number, displayValue: string | null) => ({
  label: 'Team Capability',
  type: 'factor',
  ...(displayValue === null ? {} : { display_value: displayValue }),
  observedState: { value, unit: 'scale', extractionType: 'inferred' as const },
})

describe('FactorNode face: a placeholder unit never reaches the card as if measured', () => {
  beforeEach(() => { vi.clearAllMocks(); viewMode = 'standard' })

  it('DISCRIMINATOR: the numeric gates render nothing; only display_value reaches the face', () => {
    // Arm 1 — no display_value. Pattern 1 skips placeholder units, Pattern 2
    // calls them meaningless. Nothing should render.
    const withoutDv = faceText(renderFactor(founderFactor(0.3, null)).container)
    expect(withoutDv).toContain('Team Capability')
    expect(withoutDv).not.toContain('0.3')
    expect(withoutDv).not.toContain('scale')

    // Arm 2 — identical state PLUS the producer's string. This is the path.
    const withDv = faceText(renderFactor(founderFactor(0.3, '0.3 scale')).container)
    expect(withDv).toContain('Team Capability')

    // PRECONDITION PINNED: the two arms must genuinely differ, or this spec is
    // agreeing with itself and proves nothing about which path renders.
    expect(withDv).not.toBe(withoutDv)

    // And the face is now honest.
    expect(withDv).toContain('Low')
    expect(withDv).not.toContain('scale')
    expect(withDv).not.toContain('0.3')
  })

  it.each([
    [0, 'Very low'],
    [0.2, 'Very low'],
    [0.3, 'Low'],
    [0.5, 'Medium'],
    [0.55, 'Medium'],
    [0.75, 'High'],
    [0.8, 'High'],
    [0.85, 'Very high'],
  ])('a card at value %s reads "%s" and shows no placeholder unit', (value, expected) => {
    const text = faceText(renderFactor(founderFactor(value, `${value} scale`)).container)
    expect(text).toContain(expected)
    expect(text).not.toContain('scale')
    expect(text).not.toContain(`${value} scale`)
  })

  it('THE FOUNDER\'S EXACT FACE: "0.3 scale est." becomes "Low est."', () => {
    // The card he is looking at, marker and all. The fix changes the WORD and
    // nothing else — the provenance disclosure is untouched, so the reader still
    // learns the value was filled in for them.
    const { container } = renderFactor(founderFactor(0.3, '0.3 scale'))
    // ⚠ ASSERTED AS TWO ELEMENTS, NOT ONE STRING. The word and the marker are
    // siblings separated by a CSS gap, so `textContent` joins them as "Lowest."
    // — pinning that would be a LAYOUT claim, and jsdom cannot make one. Each
    // part is bound by identity instead.
    const marker = container.querySelector('[data-testid="estimate-marker"]')
    expect(marker, 'the est. marker must still render').toBeTruthy()
    expect(marker!.textContent).toBe('est.')
    const text = faceText(container)
    expect(text).toContain('Low')
    expect(text).not.toContain('0.3 scale')
    expect(text).not.toContain('scale')
  })

  it('the expert view keeps its own rendering and is equally free of the placeholder', () => {
    viewMode = 'expert'
    const text = faceText(renderFactor(founderFactor(0.3, '0.3 scale')).container)
    expect(text).toContain('Low')
    expect(text).not.toContain('scale')
  })

  it('contextual prose on the same shape is untouched', () => {
    const text = faceText(renderFactor({
      label: 'Tech Lead', type: 'factor',
      display_value: 'No dedicated tech lead',
      observedState: { value: 0, unit: 'scale', extractionType: 'inferred' },
    }).container)
    expect(text).toContain('No dedicated tech lead')
  })

  it('a real unit on the face is untouched', () => {
    const text = faceText(renderFactor({
      label: 'Budget', type: 'factor',
      observedState: { value: 0.2, raw_value: 40000, unit: '£', cap: 200000 },
    }).container)
    expect(text).toContain('£40,000')
  })
})
