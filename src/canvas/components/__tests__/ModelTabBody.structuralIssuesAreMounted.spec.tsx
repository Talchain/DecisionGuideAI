/**
 * ⭐⭐⭐ THE MOUNT IS THE FIX. THE COMPUTATION WAS NEVER BROKEN.
 *
 * `useModelHealth` has always computed, per option, *"X has no path to the goal. Its interventions
 * can't influence the outcome."* — real BFS, `severity: 'blocker'`, `affectedIds: [opt.id]` — and it
 * has always had its own passing spec. **No user could see any of it.** Its only consumer,
 * `canvas/components/ModelHealthSection.tsx`, had ZERO importers, while an IDENTICALLY-NAMED twin at
 * `canvas/components/model-tab/ModelHealthSection.tsx` occupied the name `ModelTabBody` mounts.
 *
 * Measured with contrast controls at `232b2d314`: target (non-`model-tab` importers) **0**;
 * contrast `useNodeDisplayMetadata` importers **450**; second contrast `model-tab/ModelHealthSection`
 * imported at `ModelTabBody.tsx:46`. An earlier sweep of mine used an unquoted `--include=*.ts`,
 * which zsh ate, so BOTH target and contrast read zero — that dead instrument was discarded, not
 * reported.
 *
 * ⛔ WHY THIS FILE EXISTS SEPARATELY FROM THE COMPONENT'S OWN SPEC. The sibling spec
 * (`model-tab/__tests__/theStructuralCheckReachesTheReader.spec.tsx`) renders the section directly.
 * **That spec would pass just as happily on the dark version** — the orphan component rendered
 * perfectly well too; it simply had no importer. A component test cannot observe darkness. So the
 * decisive assertion is THIS one: drive the surface that is actually mounted, and let the mutant be
 * REMOVING THE MOUNT. That mutant REDs here and nowhere else.
 *
 * ⚠ CLAUDE.md trap 3b — bind to the surface the deployed build actually mounts. `ModelTabBody` is
 * that surface: it is what renders the live Model card, outside the deleted
 * `LEGACY_DETAILED_EDITOR_MOUNTED` gate (this file's subject imports it at `:46`/`:47`).
 * ⚠ CLAUDE.md trap 3 — jsdom cannot prove visibility. This asserts MOUNTING and TEXT only.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Node } from '@xyflow/react'

let mockCanvasState: any

vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    (selector: (s: any) => unknown) => selector(mockCanvasState),
    { getState: () => mockCanvasState },
  ),
}))
vi.mock('../../../stores/uiStore', () => ({
  useUIStore: Object.assign(
    (selector: (s: any) => unknown) => selector({ pendingModelTabSection: null }),
    { getState: () => ({ requestModelTabSection: vi.fn() }) },
  ),
}))
vi.mock('../../../telemetry/guidanceEvents', () => ({ trackGuidance: vi.fn() }))
vi.mock('../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
// Heavy siblings stubbed. ⛔ `StructuralIssuesSection` is NOT stubbed — stubbing the subject is
// exactly how this file would pass vacuously.
vi.mock('../model-tab/ModelAdjustments', () => ({ ModelAdjustments: () => null }))
vi.mock('../model-tab/StreamingDiagnostics', () => ({ StreamingDiagnostics: () => null }))
vi.mock('../model-tab/ReanalyseBar', () => ({ ReanalyseBar: () => null }))
vi.mock('../model-tab/ModelFooter', () => ({ ModelFooter: () => null }))

import { ModelTabBody } from '../ModelTabBody'

/**
 * `opt_stranded` has no outgoing edge; `opt_wired` reaches the goal through a factor.
 * They differ ONLY in connectivity, so naming one and not the other can only be catching
 * reachability — never a value predicate the other could satisfy (CLAUDE.md trap 19).
 */
const NODES: Node[] = [
  { id: 'goal_1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Reach 20k MRR' } },
  { id: 'fac_1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price elasticity' } },
  { id: 'opt_wired', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Hold price steady' } },
  { id: 'opt_stranded', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Raise price to 55' } },
]
const EDGES: any[] = [
  { id: 'e1', source: 'opt_wired', target: 'fac_1' },
  { id: 'e2', source: 'fac_1', target: 'goal_1' },
]

beforeEach(() => {
  mockCanvasState = {
    // ⚠ `ModelTabBody` receives nodes/edges as PROPS, but `useModelHealth` reads the STORE.
    // Both resolve to the same graph in the app; the store is set here because the store is
    // what the subject under test actually consumes.
    nodes: NODES,
    edges: EDGES,
    updateEdge: vi.fn(),
    ceeAnalysisReady: null,
    ceePipelineTrace: null,
    repairsApplied: null,
    results: { status: 'idle' },
    hasCompletedFirstRun: false,
    rawV2Response: null,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    currentScenarioId: null,
    v5AnalysisFact: null,
    selection: { nodeIds: new Set(), edgeIds: new Set() },
  }
})

function renderModelTab() {
  return render(
    <ModelTabBody
      showDebug={false}
      hasDiagnostics={false}
      diagnostics={null}
      hasTrim={false}
      effectiveCorrelationId={null}
      correlationMismatch={false}
      correlationIdHeader={null}
      nodes={NODES}
      edges={EDGES}
      robustness={null}
      expertMode={false}
    />,
  )
}

describe('the structural check is MOUNTED on the Model tab, not dark', () => {
  it('⭐ THE MUTANT TARGET: removing the mount from ModelTabBody REDs this', () => {
    renderModelTab()

    // Positive control first: the Model tab really did render, so a null below would be a fact
    // about the section and not about a tab that never mounted (CLAUDE.md trap 13).
    expect(screen.getByTestId('model-health-section')).toBeTruthy()

    expect(screen.getByTestId('structural-issues-section')).toBeTruthy()
    expect(screen.getByTestId('structural-issue-disconnected-option-opt_stranded')).toBeTruthy()
  })

  it('names the stranded option and NOT the wired one — the discriminating pair', () => {
    renderModelTab()

    expect(screen.getByText(/Raise price to 55.*no path to the goal/)).toBeTruthy()
    expect(screen.queryByTestId('structural-issue-disconnected-option-opt_wired')).toBeNull()
  })

  it('a model whose options all reach the goal mounts the tab and NO structural section', () => {
    mockCanvasState.nodes = [
      { id: 'goal_1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Reach 20k MRR' } },
      { id: 'opt_wired', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Hold price steady' } },
    ]
    mockCanvasState.edges = [{ id: 'e1', source: 'opt_wired', target: 'goal_1' }]
    renderModelTab()

    // The tab still mounts — so the absence below is the section's own verdict, not a dead render.
    expect(screen.getByTestId('model-health-section')).toBeTruthy()
    expect(screen.queryByTestId('structural-issues-section')).toBeNull()
  })
})
