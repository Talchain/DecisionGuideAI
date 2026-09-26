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
 *
 * ⭐⭐ CONTRACT v3.1 (DESIGN-GAP-v31 #20, 26 Sep 2026) REPLACES THE FACE THIS
 * FILE PINNED. The earlier ruling here kept the figure — `0.3 est.` — and only
 * stripped the false unit. v3.1 `checks.factor` says "own-unit value … no bare
 * internal model scale", and the gap row names this exact face ("Localisation
 * and Compliance Cost 0.5 est.") with the ruling "omit, never invent". So an
 * Olumi estimate stated ONLY on the bare 0–1 scale now leaves the card's
 * figure, nothing substituted (`readoutIsBareModelScale`) — and, review F1
 * (#2085), KEEPS its figure-less `est.` mark: omit the number, never its
 * provenance.
 * What is kept, and pinned here as contrasts in the same runs:
 *   · the passthrough is still live — producer prose and a declared encoding
 *     still speak on the face;
 *   · an Olumi estimate in the reader's OWN unit keeps its figure and `est.`;
 *   · the model still admits its open assumptions on the Decision card
 *     ("Assumptions open for review", v3.1 #39) and in the inspector.
 * The earlier "an assumption must be visible to be challenged" pin holds: the
 * figure-less `est.` still marks WHICH card carries the assumption (F1).
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

// Spread the real flags module: `FactorNode` now reads the composed analysis
// verdict (`useModelChangedSinceRun`), whose source classifier calls a flag
// this factory never listed. A `vi.mock` factory REPLACES the module, so an
// unlisted flag is `undefined` and throws at render (CLAUDE.md trap 12).
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
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

  it('DISCRIMINATOR: the bare-scale figure is gone from both arms, the producer arm keeps only its `est.` mark (F1), and the passthrough is still alive', () => {
    // Arm 1 — no display_value. Pattern 1 skips placeholder units, Pattern 2
    // calls them meaningless. Nothing renders.
    const withoutDv = faceText(renderFactor(founderFactor(0.3, null)).container)
    expect(withoutDv).toContain('Team Capability')
    expect(withoutDv).not.toContain('0.3')
    expect(withoutDv).not.toContain('scale')

    // Arm 2 — identical state PLUS the producer's string. This is the path that
    // used to leak. v3.1 #20: the figure is a bare 0–1 Olumi estimate, so the
    // false unit AND the model-scale figure are gone — and review F1 (#2085)
    // keeps its provenance: the face is the title plus the figure-less `est.`.
    const withDv = faceText(renderFactor(founderFactor(0.3, '0.3 scale')).container)
    expect(withDv).toBe(`${withoutDv}est.`)
    expect(withDv).not.toContain('0.3')
    expect(withDv).not.toContain('scale')

    // ⭐ PRECONDITION PINNED. A third arm on the SAME passthrough must behave
    // differently again, which proves the passthrough is live and only this one
    // shape is rewritten.
    const prose = faceText(renderFactor({
      label: 'Team Capability', type: 'factor',
      display_value: 'No dedicated tech lead',
      observedState: { value: 0.3, unit: 'scale', extractionType: 'inferred' },
    }).container)
    expect(prose).not.toBe(withoutDv)
    expect(prose).toContain('No dedicated tech lead')
  })

  it.each([0, 0.2, 0.3, 0.5, 0.55, 0.75, 0.8, 0.85])(
    'a card at value %s states no bare model-scale figure and no placeholder unit (v3.1 #20)', (value) => {
      const { container } = renderFactor(founderFactor(value, `${value} scale`))
      const text = faceText(container)
      expect(text).toContain('Team Capability')
      expect(text).not.toContain('scale')
      // Bound by identity: the value line itself is absent, not merely reworded.
      expect(container.querySelector('[data-testid="factor-recorded-value"]')).toBeNull()
    })

  it('⭐⭐ THE `est.` MARKER SURVIVES WHEREVER A FIGURE DOES — an own-unit estimate keeps both', () => {
    // THE REGRESSION THIS PINNED. `FactorNode.tsx` gates the value and the
    // marker on ONE condition, so blanking the value took the marker with it.
    // v3.1 #20 omits a BARE-scale estimate's figure — and review F1 (#2085)
    // keeps its mark: omit the number, never its provenance. Bound by
    // identity, not by reading the text.
    const own = renderFactor({
      label: 'Team Capability', type: 'factor',
      observedState: { value: 0.3, raw_value: 30, unit: '%', extractionType: 'inferred' },
    }).container
    const marker = own.querySelector('[data-testid="estimate-marker"]')
    expect(marker, 'the est. marker vanished from an own-unit estimate — the guess is now invisible').toBeTruthy()
    expect(marker!.textContent).toBe('est.')
    // Same run: the bare-scale estimate loses its figure, never its mark (F1).
    const bare = renderFactor(founderFactor(0.3, '0.3 scale')).container
    expect(bare.querySelector('[data-testid="estimate-marker"]')!.textContent).toBe('est.')
    expect(bare.querySelector('[data-testid="factor-recorded-value"]')).toBeNull()
  })

  it("THE FOUNDER'S EXACT FACE: \"0.3 scale est.\" no longer reads as a measurement", () => {
    // The card he is looking at. The unreadable figure is withheld (v3.1 #20);
    // nothing is reworded into a magnitude the producer never declared.
    const { container } = renderFactor(founderFactor(0.3, '0.3 scale'))
    const text = faceText(container)
    expect(text).toContain('Team Capability')
    expect(text).not.toContain('0.3 scale')
    expect(text).not.toContain('scale')
    expect(text).not.toContain('0.3')
    // Review F1 (#2085): the figure is withheld, its provenance is not.
    expect(container.querySelector('[data-testid="estimate-marker"]')!.textContent).toBe('est.')
  })

  it('the expert view is equally free of the placeholder', () => {
    viewMode = 'expert'
    const text = faceText(renderFactor(founderFactor(0.3, '0.3 scale')).container)
    expect(text).not.toContain('scale')
  })

  it('⛔ REGRESSION: a declared encoding still speaks on the face', () => {
    // The independent review's reproduction, at the surface. A categorical
    // state must keep the producer's own words, not become a magnitude and not
    // be withheld.
    const text = faceText(renderFactor({
      label: 'Germany Market Entry', type: 'factor',
      display_value: '0 scale',
      encoding_map: { '0': 'Not pursued', '1': 'Pursued' },
      observedState: { value: 0, unit: 'scale', extractionType: 'inferred' },
    }).container)
    expect(text).toContain('Not pursued')
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
