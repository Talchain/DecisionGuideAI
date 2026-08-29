/**
 * CEE quality sub-scores — the panel may print only the dimensions CEE scored.
 *
 * ── THE DEFECT (CLASS 1: absence represented as value) ──────────────────────
 *
 * Both draft-ingestion twins mapped CEE's `quality` block like this:
 *
 *     causality: rawQuality.causality ?? rawQuality.overall ?? 5,
 *     structure: rawQuality.structure ?? rawQuality.overall ?? 5,
 *     ...
 *
 * (`canvas/utils/applyDraftResult.ts` and `canvas/components/DraftChat.tsx` —
 * a hand-mirrored pair, this estate's chronic defect shape.)
 *
 * **CEE HAS NO `causality` SCORE AND DELIBERATELY REMOVED ONE.** Derived at the
 * producer's bytes on CEE `staging` @ `f18d941b`:
 *
 *   · `src/schemas/cee-v3.ts:792-797` — the quality block declares
 *     `overall`, `structure`, `coverage`, `structural_proxy`, `safety`.
 *     No `causality`.
 *   · `src/cee/quality/index.ts:118-119` —
 *     `// Renamed from 'causality' — this score measures structural
 *      completeness, not causal validity. A genuine causality score requires
 *      scientific definition (see roadmap B5.28b).`
 *     `const structural_proxy = structure;`
 *
 * Contrast control, same run: `structural_proxy` returns 13 hits in CEE `src/`
 * and appears in all five shipped starter drafts
 * (`src/canvas/starters/data/*.draft.json`, `"structural_proxy": 8`), while
 * `causality` as a quality field returns ZERO in CEE — its 13 textual hits are
 * prose, tests, and the rename note itself. So `rawQuality.causality` is
 * `undefined` on EVERY real payload and the row was ALWAYS `overall`.
 *
 * The user was therefore shown **"Causality: 7"** with a green/amber/red bar
 * (`ModelHealthSection.QualityRow`) and `· Causality 7` in `ModelSnapshot` — a
 * score for causal validity that the producer refuses to compute, wearing the
 * overall score's number. A false scientific claim, which is the worst class
 * this product has.
 *
 * ── WHY THE HONEST ANSWER IS "NOT SCORED" AND NOT `structural_proxy` ────────
 *
 * `structural_proxy` is not a causality score either — it is `structure`,
 * assigned from it on the line above (`const structural_proxy = structure;`).
 * Rendering it as a second row would print ONE number twice under TWO labels
 * and read as two independent signals. That is a proven duplicate, so it is not
 * shown; the row instead says the producer did not score this, which is true,
 * useful, and leaves the hook for B5.28b visible.
 *
 * ── THE SECOND HALF: `?? overall` ON EVERY DIMENSION ────────────────────────
 *
 * `structure` / `coverage` / `safety` are each `.optional()` in the producer
 * schema, so the contract admits their absence (CLAUDE.md trap 13d — check what
 * the corpus EXCLUDES). Where one is absent the panel printed `overall` under
 * that dimension's name: four independent-looking assessments derived from one
 * number. `ModelSnapshot` already guards each dimension with `!= null` — the
 * honest branch existed and was UNREACHABLE, because ingestion made sure the
 * field was never absent.
 *
 * ── BINDING (CLAUDE.md trap 19) ─────────────────────────────────────────────
 * Assertions bind to a dimension BY ITS NAME (`quality-row-causality`, the
 * `causality` key), never by the value 7 — every dimension in the defective
 * output carries the same number, so a value predicate here would be satisfied
 * by any of them. Proven by a discriminating mutant pair recorded in the PR body.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { applyDraftResult } from '../applyDraftResult'
import { ModelHealthSection } from '../../components/model-tab/ModelHealthSection'
import { DetailToggleContext } from '../../components/model-tab/DetailToggleContext'

const mockSetCeeQuality = vi.fn()
let storeNodes: unknown[] = []
let storeEdges: unknown[] = []

vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(vi.fn(), {
    getState: () => ({
      nodes: storeNodes,
      edges: storeEdges,
      pushHistory: vi.fn(),
      applyLayout: vi.fn(() => Promise.resolve()),
      setPendingLayout: vi.fn(),
      setOutcomeNode: vi.fn(),
      setCeeAnalysisReady: vi.fn(),
      markAnalysisFreshnessDirty: vi.fn(),
      setAnalysisFreshness: vi.fn(),
      setCeePipelineTrace: vi.fn(),
      setCeeQuality: mockSetCeeQuality,
      setGoalConstraints: vi.fn(),
      setLastAuthoritativeGraph: vi.fn(),
      setDraftCoaching: vi.fn(),
      setPreAnalysisSensitivity: vi.fn(),
      currentScenarioId: null,
      batchUpdateNodes: vi.fn(() => ({ updatedCount: 0 })),
    }),
    setState: vi.fn((update: { nodes?: unknown[]; edges?: unknown[] }) => {
      if (update.nodes) storeNodes = update.nodes
      if (update.edges) storeEdges = update.edges
    }),
  }),
}))

vi.mock('../../store/scenarios', () => ({ saveAutosave: vi.fn() }))

vi.mock('../../../adapters/cee/types', () => ({
  hasAnalysisReady: () => false,
  isCEEv3Response: () => false,
}))

vi.mock('../../components/GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../../../components/results/Accordion', () => ({
  Accordion: ({ children, testId }: { children: React.ReactNode; testId?: string }) => (
    <div data-testid={testId}>{children}</div>
  ),
}))

/** One node so `applyDraftResult` does not early-return. */
const MINIMAL_GRAPH = {
  nodes: [{ id: 'g1', kind: 'goal', label: 'Revenue' }],
  edges: [],
}

/** CEE's ACTUAL shape — derived from `cee/src/cee/quality/index.ts`. No `causality`. */
const REAL_CEE_QUALITY = {
  overall: 7,
  structure: 9,
  coverage: 6,
  structural_proxy: 9,
  safety: 8,
}

function lastQuality(): Record<string, unknown> {
  expect(mockSetCeeQuality).toHaveBeenCalled()
  return mockSetCeeQuality.mock.calls[mockSetCeeQuality.mock.calls.length - 1][0]
}

describe('CEE quality sub-scores — ingestion may not invent a dimension the producer did not score', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeNodes = []
    storeEdges = []
  })

  it('does not manufacture a causality score — CEE emits none', () => {
    applyDraftResult({ ...MINIMAL_GRAPH, quality: REAL_CEE_QUALITY } as never)
    expect(lastQuality().causality).toBeUndefined()
  })

  it('does not fill an absent dimension from `overall`', () => {
    // `structure` is `.optional()` in the producer schema; absence must survive.
    const { structure: _dropped, ...withoutStructure } = REAL_CEE_QUALITY
    applyDraftResult({ ...MINIMAL_GRAPH, quality: withoutStructure } as never)
    expect(lastQuality().structure).toBeUndefined()
  })

  it('carries a dimension the producer DID score through unchanged', () => {
    // Positive control: the working case must keep working. Bound by NAME —
    // `coverage` is the only dimension whose value is 6.
    applyDraftResult({ ...MINIMAL_GRAPH, quality: REAL_CEE_QUALITY } as never)
    const q = lastQuality()
    expect(q.overall).toBe(7)
    expect(q.structure).toBe(9)
    expect(q.coverage).toBe(6)
    expect(q.safety).toBe(8)
  })
})

/** The panel's sub-scores render only under the "Show full detail" toggle. */
function renderDetail() {
  return render(
    <DetailToggleContext.Provider value={{ showDetail: true }}>
      <ModelHealthSection ceeQuality={{ overall: 7, structure: 9, coverage: 6, safety: 8 }} />
    </DetailToggleContext.Provider>,
  )
}

describe('CEE quality sub-scores — the panel says a dimension was not scored rather than printing a number', () => {
  it('prints no causality NUMBER, and says it was not scored', () => {
    renderDetail()
    const row = screen.getByTestId('quality-row-causality')
    expect(row).toHaveTextContent(/not scored/i)
    // Bound by the ROW, not by the panel: `overall` is 7 elsewhere on screen.
    expect(row.textContent).not.toMatch(/\d/)
  })

  it('still prints the dimensions the producer DID score', () => {
    renderDetail()
    expect(screen.getByTestId('quality-row-structure')).toHaveTextContent('9')
    expect(screen.getByTestId('quality-row-coverage')).toHaveTextContent('6')
    expect(screen.getByTestId('quality-row-safety')).toHaveTextContent('8')
  })
})
