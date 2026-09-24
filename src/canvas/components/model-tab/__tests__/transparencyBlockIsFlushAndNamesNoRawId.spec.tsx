/**
 * ⭐⭐ V2 GAP 35 — TRANSPARENCY BLOCK BELOW THE OUTLINE: A NESTED CARD,
 * BLUE-BORDERED CARDS, A CANVAS-SCALED TYPE TOKEN AND RAW-ID LABEL FALLBACKS.
 *
 * `FIDELITY-GAPS-INDEX-20260924.txt` #35 (medium/quick). Four independent
 * defects across three components, each pinned separately so a mutant
 * reverting any ONE production edit REDs only its own assertions:
 *
 *   1. `GoalConstraintsSection` — a `rounded-lg border` card holding a
 *      SECOND `border rounded-lg` card per row (a card within a card).
 *   2. `ModelAdjustments` (both the compact single-item layout AND the
 *      multi-item collapsible) — a `border-info/30` blue-bordered card, with
 *      a `text-info` Wrench matching the tint.
 *   3. `StructuralIssuesSection` — another `rounded-lg border` card, set in
 *      `typography.nodeLabel` (the CANVAS type token, which scales with
 *      `--canvas-label-scale` — a variable this panel chrome has no
 *      business tracking) instead of `panelHeader`/`panelBody`.
 *   4. Raw-id label fallbacks: `StructuralIssuesSection` fell back to the
 *      bare node id when a label was blank, and `ModelTabBody`'s
 *      `model_adjustments` mapping fell back to a TITLE-CASED wire id
 *      (`opt_segment_2` → `Opt Segment 2` — still the id, with capitals and
 *      spaces). Both now resolve a genuine label or the shared
 *      `UNNAMED_ELEMENT_LABEL`, never a form of the id.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, act, within } from '@testing-library/react'

/**
 * ⚠ `getAttribute('class')`, NOT `.className` — an SVG element's `.className`
 * is an `SVGAnimatedString` object, not a plain string, so `.split` on it
 * throws. `getAttribute` returns the raw attribute text for both HTML and
 * SVG elements, which is what every caller here actually wants.
 */
function classTokens(el: Element): string[] {
  return (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
}

// ── 1. GoalConstraintsSection ───────────────────────────────────────────────

import { GoalConstraintsSection, GOAL_CONSTRAINTS_SECTION_TESTID, GOAL_CONSTRAINT_ROW_TESTID } from '../GoalConstraintsSection'

const CONSTRAINT = {
  constraint_id: 'c1',
  node_id: 'fac_spend',
  operator: '<=' as const,
  value: 100000,
  unit: '£',
  probability: 0.62,
}
const CONSTRAINT_NODES = [{ id: 'fac_spend', data: { label: 'Marketing spend' } }]

describe('1. GoalConstraintsSection carries no nested card', () => {
  afterEach(cleanup)

  it('the outer section is a hairline, not a rounded/bordered box', () => {
    render(<GoalConstraintsSection constraints={[CONSTRAINT]} nodes={CONSTRAINT_NODES} />)
    const tokens = classTokens(screen.getByTestId(GOAL_CONSTRAINTS_SECTION_TESTID))
    expect(tokens).toContain('border-b')
    expect(tokens).not.toContain('rounded-lg')
    expect(tokens).not.toContain('border')
  })

  it('each row carries no border and no background of its own', () => {
    render(<GoalConstraintsSection constraints={[CONSTRAINT]} nodes={CONSTRAINT_NODES} />)
    const tokens = classTokens(screen.getByTestId(GOAL_CONSTRAINT_ROW_TESTID('c1')))
    expect(tokens).not.toContain('border')
    expect(tokens).not.toContain('rounded-lg')
    expect(tokens).not.toContain('bg-panel')
  })

  it('rows are <li> in a plain list — a real list, not a stack of cards', () => {
    render(<GoalConstraintsSection constraints={[CONSTRAINT]} nodes={CONSTRAINT_NODES} />)
    const row = screen.getByTestId(GOAL_CONSTRAINT_ROW_TESTID('c1'))
    expect(row.tagName).toBe('LI')
    expect(row.parentElement!.tagName).toBe('UL')
  })
})

// ── 2. ModelAdjustments ──────────────────────────────────────────────────────

import { ModelAdjustments } from '../ModelAdjustments'

describe('2. ModelAdjustments carries no blue-bordered card', () => {
  afterEach(cleanup)

  it('the compact single-item layout has no border-info card or tinted Wrench', () => {
    render(<ModelAdjustments adjustments={[{ code: 'factor_reclassified', reason: 'Moved "A" to external' }]} />)
    const container = screen.getByTestId('model-adjustments')
    const tokens = classTokens(container)
    expect(tokens.some(t => t.startsWith('border-info'))).toBe(false)
    expect(tokens).not.toContain('rounded-lg')
    const wrench = container.querySelector('.lucide-wrench')
    expect(wrench, 'no Wrench icon rendered').not.toBeNull()
    expect(classTokens(wrench!)).not.toContain('text-info')
    expect(classTokens(wrench!)).toContain('text-text-light')
  })

  it('the multi-item collapsible layout has no border-info card or tinted Wrench', () => {
    render(
      <ModelAdjustments
        adjustments={[
          { code: 'factor_reclassified', reason: 'Moved "A" to external' },
          { code: 'risk_coefficient_corrected', reason: 'Direction mismatch' },
        ]}
      />,
    )
    const container = screen.getByTestId('model-adjustments')
    const tokens = classTokens(container)
    expect(tokens.some(t => t.startsWith('border-info'))).toBe(false)
    expect(tokens).not.toContain('rounded-lg')
    const wrench = container.querySelector('.lucide-wrench')
    expect(classTokens(wrench!)).not.toContain('text-info')
    expect(classTokens(wrench!)).toContain('text-text-light')
  })
})

// ── 3 & 4a. StructuralIssuesSection ─────────────────────────────────────────

const focusNodeById = vi.fn()
vi.mock('../../../utils/focusHelpers', () => ({
  focusNodeById: (id: string) => focusNodeById(id),
  focusEdgeById: vi.fn(),
}))

import { StructuralIssuesSection } from '../StructuralIssuesSection'
import { useCanvasStore } from '../../../store'
import { UNNAMED_ELEMENT_LABEL } from '../../../domain/canvasLabels'

const GOAL = { id: 'goal_1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Reach 20k MRR' } }
const FACTOR = { id: 'fac_1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price elasticity' } }
const WIRED = { id: 'opt_wired', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Hold price steady' } }
/** No `label` at all — the exact shape that fell back to the raw id. */
const UNLABELLED_STRANDED = { id: 'opt_segment_2', type: 'option', position: { x: 0, y: 0 }, data: {} }

function setState(partial: Record<string, unknown>) {
  act(() => {
    useCanvasStore.setState(partial as never)
  })
}

function setGraph() {
  setState({
    nodes: [GOAL, FACTOR, WIRED, UNLABELLED_STRANDED],
    edges: [
      { id: 'e1', source: 'opt_wired', target: 'fac_1' },
      { id: 'e2', source: 'fac_1', target: 'goal_1' },
    ],
  })
}

describe('3. StructuralIssuesSection carries no card and no canvas-scaled type', () => {
  beforeEach(() => {
    cleanup()
    focusNodeById.mockClear()
    setState({ nodes: [], edges: [], results: { status: 'idle' }, ceeAnalysisReady: null })
  })
  afterEach(cleanup)

  it('the section is a hairline, not a rounded/bordered/filled box', () => {
    setGraph()
    render(<StructuralIssuesSection />)
    const tokens = classTokens(screen.getByTestId('structural-issues-section'))
    expect(tokens).toContain('border-b')
    expect(tokens).not.toContain('rounded-lg')
    expect(tokens).not.toContain('border')
    expect(tokens).not.toContain('bg-panel')
  })

  it('the heading is panelHeader, never the canvas-scaled nodeLabel token', () => {
    setGraph()
    render(<StructuralIssuesSection />)
    const heading = screen.getByText(/no connector path shown to your goal/)
    // nodeLabel resolves to a `calc(...)` font-size utility; panelHeader is
    // the fixed `text-sm font-semibold` pair. Bound on the ABSENCE of the
    // scaling utility, since asserting presence of `text-sm` alone would
    // also be true of several unrelated tokens.
    expect(heading.className).not.toMatch(/calc\(/)
    expect(heading.className).toContain('font-semibold')
  })

  it('names the unlabelled option by UNNAMED_ELEMENT_LABEL, never its raw or title-cased id', () => {
    setGraph()
    render(<StructuralIssuesSection />)
    expect(screen.getByText(UNNAMED_ELEMENT_LABEL)).toBeInTheDocument()
    expect(screen.queryByText('opt_segment_2')).toBeNull()
    expect(screen.queryByText('Opt Segment 2')).toBeNull()
    expect(screen.queryByText(/Segment 2/)).toBeNull()
  })
})

// ── 4b. ModelTabBody's own model_adjustments raw-id fallback ───────────────

vi.mock('../../../stores/uiStore', () => ({
  useUIStore: Object.assign(
    (selector: (s: any) => unknown) => selector({ pendingModelTabSection: null }),
    { getState: () => ({ requestModelTabSection: vi.fn() }) },
  ),
}))
vi.mock('../../../telemetry/guidanceEvents', () => ({ trackGuidance: vi.fn() }))
vi.mock('../../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('../ReanalyseBar', () => ({ ReanalyseBar: () => null }))
vi.mock('../StreamingDiagnostics', () => ({ StreamingDiagnostics: () => null }))

import { ModelTabBody } from '../../ModelTabBody'

describe('4b. ModelTabBody resolves model_adjustments target labels honestly', () => {
  beforeEach(() => cleanup())
  afterEach(cleanup)

  it('an adjustment target with no matching node reads UNNAMED_ELEMENT_LABEL, never a title-cased id', () => {
    act(() => {
      useCanvasStore.setState({
        updateEdge: vi.fn(),
        ceeAnalysisReady: { model_adjustments: [{ target: 'opt_segment_2', code: 'X', reason: 'Y' }] },
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
        goalConstraints: [],
      } as never)
    })
    render(
      <ModelTabBody
        showDebug={false}
        hasDiagnostics={false}
        diagnostics={null}
        hasTrim={false}
        effectiveCorrelationId={null}
        correlationMismatch={false}
        correlationIdHeader={null}
        nodes={[]}
        edges={[]}
        robustness={null}
        expertMode={false}
      />,
    )
    // Scoped to the adjustments section — `nodes={[]}` means several OTHER
    // sections legitimately render `UNNAMED_ELEMENT_LABEL` too (an empty
    // model has no labelled goal either); this test is about THIS mapping,
    // not a claim that the string is unique on the page.
    const section = within(screen.getByTestId('model-adjustments'))
    expect(section.getByText(UNNAMED_ELEMENT_LABEL)).toBeInTheDocument()
    expect(section.queryByText('opt_segment_2')).toBeNull()
    expect(section.queryByText('Opt Segment 2')).toBeNull()
    expect(section.queryByText(/Segment 2/)).toBeNull()
  })
})
