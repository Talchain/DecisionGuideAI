/**
 * ⭐⭐ "SHOW ME THE MODEL CARD" LANDED ON A GROUP THAT IS EMPTY BY CONSTRUCTION.
 *
 * `MODEL_SECTION_TARGET` (`ModelTabBody.tsx:134`) maps the six addressable
 * section NAMES onto testids. Five map onto outline groups that hold rows.
 * The sixth did not:
 *
 *     modelcard → 'model-group-v2-evidence-review'
 *
 * MEASURED AT `3b2df4ce`, by rendering the real panel with a fully drafted
 * model (goal + option + factor + risk + edge) and opening every group:
 *
 *     goal 5 · options 5 · factors 8 · outcomes-risks 4 · relationships 4
 *     assumptions-provenance 0 · evidence-review 0
 *
 * and `model-group-v2-evidence-review`'s rendered text was, verbatim:
 * "▾ Evidence & review state0Nothing in this group yet".
 *
 * That zero is STRUCTURAL, not a state a model can grow out of. `toModelRows`
 * (`adapters.ts:533-676`) is the sole producer of `ModelRow[]`, and every
 * `group:` it assigns comes from `KIND_GROUP` (`adapters.ts:233-241`, codomain
 * of five ids) or the literal `'relationships'`. Repo-wide, the string
 * `evidence-review` appears in five places and NONE is in `adapters.ts`. No
 * input produces a row in that group, so the deep link could never arrive
 * anywhere useful, for any user, on any model.
 *
 * Meanwhile the Model card the caller asked for — `ModelHealthSection`, the
 * quality dimensions, methodology, audit trail and inference warnings — renders
 * BELOW the outline, inside `model-scientific-transparency`, entirely outside
 * the group the link points at.
 *
 * ⚠ SCOPE, STATED PRECISELY (trap 20 — a claim must not outgrow its evidence).
 * No in-repo caller passes `'modelcard'`: the literal `requestModelTabSection`
 * arguments in `src/` are `'relationships'` (×2) and `'factors'` (×2). The
 * reachable path is the ASSISTANT's — `applyV5State.ts:1161-1169` narrows a
 * server-supplied `open_section` id through `isModelTabSectionId` and forwards
 * anything in `MODEL_TAB_SECTION_IDS`, which includes `'modelcard'`. So this is
 * a live, sanctioned route with a broken destination. It is NOT a claim that a
 * wire capture has been seen carrying it.
 *
 * ⚠ AND WHY NO EXISTING TEST SAW IT: the one prior pin
 * (`ModelTabBody.v1StackCollapsed.spec.tsx:126-133`) asserts a scroll happened
 * to `model-group-v2-relationships` — a group that DOES hold rows. It binds to
 * the container and, for its own section, the container is the right answer.
 * Nothing asserted that each target CONTAINS what its name promises.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'
import '@testing-library/jest-dom/vitest'

vi.mock('../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))
vi.mock('../../../telemetry/guidanceEvents', () => ({ trackGuidance: vi.fn() }))

const mockGraph: { nodes: unknown[]; edges: unknown[] } = { nodes: [], edges: [] }
function getMockState() {
  return {
    nodes: mockGraph.nodes,
    edges: mockGraph.edges,
    updateNode: vi.fn(),
    updateEdge: vi.fn(),
    ceePipelineTrace: null,
    highlightedNodes: new Set<string>(),
    highlightedEdges: new Set<string>(),
    setHighlightedNodes: vi.fn(),
    setHighlightedEdges: vi.fn(),
    currentScenarioId: null,
    currentStage: null,
    graphEditedSinceLastRun: false,
    goalThreshold: null,
    goalThresholdRepresentation: null,
  }
}
vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    vi.fn((selector: (state: unknown) => unknown) => selector(getMockState())),
    { getState: getMockState },
  ),
}))
vi.mock('../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { ModelTabBody } from '../ModelTabBody'
import { useUIStore } from '../../../stores/uiStore'

const NODES: Node[] = [
  {
    id: 'goal_margin',
    type: 'goal',
    position: { x: 0, y: 0 },
    data: { label: 'Protect gross margin' },
  },
  {
    id: 'fac_budget',
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: 'Budget',
      category: 'observable',
      observedState: { value: 0.5, source: 'cee_inference' },
    },
  },
] as Node[]
const EDGES: Edge[] = []
const DEFAULT_PROPS = {
  showDebug: false,
  hasDiagnostics: false,
  diagnostics: null,
  hasTrim: false,
  effectiveCorrelationId: null,
  correlationMismatch: false,
  correlationIdHeader: null,
  robustness: null,
}

const scrollContexts: Element[] = []
let originalScrollIntoView: unknown

function renderTab() {
  return render(<ModelTabBody {...DEFAULT_PROPS} nodes={NODES} edges={EDGES} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGraph.nodes = NODES
  mockGraph.edges = EDGES
  scrollContexts.length = 0
  originalScrollIntoView = (Element.prototype as unknown as Record<string, unknown>).scrollIntoView
  ;(Element.prototype as unknown as Record<string, unknown>).scrollIntoView =
    function (this: Element) { scrollContexts.push(this) }
  useUIStore.setState({ pendingModelTabSection: null })
})

afterEach(() => {
  ;(Element.prototype as unknown as Record<string, unknown>).scrollIntoView =
    originalScrollIntoView
  useUIStore.setState({ pendingModelTabSection: null })
})

describe('a section request lands on the content it names', () => {
  it('⭐ "modelcard" scrolls to something that CONTAINS the model card', async () => {
    renderTab()
    act(() => { useUIStore.getState().requestModelTabSection('modelcard') })

    await waitFor(() => expect(scrollContexts).toHaveLength(1))
    const landed = scrollContexts[0]

    // The Model card's own content, bound by IDENTITY — `model-card-methodology`
    // is rendered by `ModelHealthSection` and by nothing else (trap 19: never a
    // value predicate another element could satisfy). Before the fix the link
    // landed on `model-group-v2-evidence-review`, which contains none of it.
    const modelCardContent =
      screen.queryByTestId('model-card-methodology')
      ?? screen.queryByTestId('model-card-pre-analysis')
    expect(modelCardContent, 'the Model card must be on the page at all').not.toBeNull()
    expect(landed.contains(modelCardContent!)).toBe(true)
  })

  it('⚠ and NOT on an outline group — the empty-by-construction one no longer renders at all', async () => {
    renderTab()
    act(() => { useUIStore.getState().requestModelTabSection('modelcard') })
    await waitFor(() => expect(scrollContexts).toHaveLength(1))

    // ⭐⭐ RE-AIMED DURING A REBASE, NOT DELETED (9 Sep 2026).
    //
    // This case was written while `model-group-v2-evidence-review` still
    // rendered, and it asserted the link did not land ON it, with an in-test
    // precondition that the group was row-less. That group has since been
    // REMOVED outright — no producer could ever fill it (see
    // `everyOutlineGroupCanBePopulated.spec.tsx`, which asserts the relation
    // rather than a list). So `getByTestId` for it would now THROW, and this
    // case would fail for a reason that has nothing to do with what it guards.
    //
    // Resolving that by deleting the case would have been a silent loss of a
    // real guard. The original assertion is instead preserved as the STRONGER
    // fact it has become: you cannot land on a group that is not rendered. If
    // the group is ever reinstated, this fails loudly and a human re-decides —
    // which is exactly the property the original precondition was protecting.
    expect(screen.queryByTestId('model-group-v2-evidence-review')).toBeNull()

    // And the discrimination this case actually exists for survives intact: the
    // model-card link must not land on an OUTLINE GROUP at all. That is what the
    // original defect was, and a future re-point could recreate it against any
    // of the five SURVIVING groups — which the assertion above could not see.
    const landedTestId = scrollContexts[0].getAttribute('data-testid') ?? ''
    expect(landedTestId, 'the model-card link landed on an outline group')
      .not.toMatch(/^model-group-v2-/)
    expect(landedTestId).toBe('model-health-section')
  })

  it('CONTRAST CONTROL: the five row-bearing targets are unchanged', async () => {
    // Proves the fix is surgical — exactly one of six mappings was wrong — and
    // that this harness can observe a CORRECT routing, not only a broken one.
    // Without it, a change that pointed every section at the model card would
    // pass the two cases above.
    renderTab()
    act(() => { useUIStore.getState().requestModelTabSection('relationships') })

    await waitFor(() => expect(scrollContexts).toHaveLength(1))
    expect(scrollContexts[0]).toBe(screen.getByTestId('model-group-v2-relationships'))
  })

  it('⭐ OPENS the card, so the request does not land on a collapsed heading', async () => {
    // The defect #1275 shipped for the outline groups, which is why
    // `setOpenGroupRequest` exists: the wrapper renders whether or not the
    // content does, so a scroll can "succeed" onto a closed heading. The Model
    // card is an Accordion in the transparency block, not an outline group, so
    // the group-opening line cannot reach it.
    //
    // ⚠ BOUND TO `aria-expanded`, NOT TO THE PRESENCE OF THE BODY. Measured
    // here: with the card collapsed, `model-card-pre-analysis` is STILL in the
    // DOM — this Accordion hides its body with the `hidden` ATTRIBUTE rather
    // than unmounting it (see the deep-link comment in `ModelTabBody`, which
    // relies on exactly that so `querySelector` keeps resolving). A presence
    // assertion would therefore have passed in both states and pinned nothing
    // (trap 3: jsdom proves presence, never visibility). `aria-expanded` is the
    // state a screen reader is told, and the one the user experiences.
    renderTab()
    const header = screen.getByRole('button', { name: /model card/i })

    // Close it first — the request must be able to REVEAL, not merely land on
    // something that happened to be open already.
    expect(header).toHaveAttribute('aria-expanded', 'true')
    act(() => { fireEvent.click(header) })
    expect(header).toHaveAttribute('aria-expanded', 'false')

    act(() => { useUIStore.getState().requestModelTabSection('modelcard') })

    await waitFor(() => expect(header).toHaveAttribute('aria-expanded', 'true'))
  })

  it('consumes the request either way, so a second section can be asked for', async () => {
    renderTab()
    act(() => { useUIStore.getState().requestModelTabSection('modelcard') })
    await waitFor(() => expect(scrollContexts).toHaveLength(1))
    expect(useUIStore.getState().pendingModelTabSection).toBeNull()
  })
})
