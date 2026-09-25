/**
 * ⭐⭐ V2 GAP 29 — AT REST THE MODEL TAB WAS TWO BORDERED CARDS; REASONING USES
 * FULL-WIDTH DIVIDERS.
 *
 * `FIDELITY-GAPS-INDEX-20260924.txt` #29 (high/quick): witnessed on served
 * `4549b66b` — the outline (`ModelTabV2Panel`) was a `border …
 * rounded-lg p-2` box, 403px tall with a 14px radius, and the Model card
 * (`ModelHealthSection`, through the shared `Accordion`) was a SECOND
 * `border … rounded-lg` box below it. At 1440×900 those two boxes plus the
 * footer were the entire first screen. Reasoning already closes its
 * top-level sections with ONE full-width hairline
 * (`PANEL_RULE`/`PANEL_SURFACE`, `panelSurfaces.ts:65,148`) rather than a
 * card per section, and the prototype's own CSS agrees: `.section` is a
 * `border-top` hairline, never a bordered, radiused box
 * (`prototype-v2-reference.html`).
 *
 * Four sites, four assertions, each bound by IDENTITY (an element found by
 * testid/role, never a value another node could share):
 *
 *   1. `ModelTabV2Panel`'s own wrapper — no radius, no side borders, a single
 *      bottom rule.
 *   2. `Accordion`'s new opt-in `flush` prop — the geometry it renders, with
 *      a CONTRAST CONTROL proving every existing (non-opted-in) caller is
 *      byte-identical to before.
 *   3. `ModelFooter`'s divider — full-bleed, not content-width.
 *   4. `ModelTabBody`'s top-level container — no `space-y-4` doubling the
 *      gap each section's own bottom rule already provides.
 *
 * A mutant reverting ANY ONE of the four production edits REDs its own
 * assertion here and nowhere else, so the four cannot mask one another.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'

/**
 * Exact Tailwind CLASS TOKEN membership, not substring matching. `border` is
 * a distinct utility from `border-b` and from colour utilities like
 * `border-panel-border` (which literally ends in the four letters "border"),
 * so a substring/regex check over the whole class string false-positives on
 * those. Splitting on whitespace and comparing whole tokens is what the
 * className API actually means by "carries a class".
 */
function classTokens(el: Element): string[] {
  return el.className.split(/\s+/).filter(Boolean)
}

// ── 1. ModelTabV2Panel's own wrapper ────────────────────────────────────────

vi.mock('../../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => ({ sendSystemEvent: vi.fn() }) }
})
vi.mock('../../../utils/focusHelpers', () => ({ focusNodeById: vi.fn(), focusEdgeById: vi.fn() }))

import { ModelTabV2Panel } from '../../../model-tab-v2/ModelTabV2Panel'
import { useCanvasStore } from '../../../store'
import { Accordion } from '../../../../components/results/Accordion'
import { ModelFooter } from '../ModelFooter'

afterEach(cleanup)

describe('1. ModelTabV2Panel is a full-width divider, not a bordered card', () => {
  it('carries a bottom rule, and NEITHER a radius NOR a full border', () => {
    useCanvasStore.setState({ nodes: [] as Node[], edges: [] as Edge[] } as never, false)
    render(<ModelTabV2Panel nodes={[]} edges={[]} goalThreshold={null} />)

    const panel = screen.getByTestId('model-tab-v2-panel')
    const tokens = classTokens(panel)
    expect(tokens).toContain('border-b')
    expect(tokens).toContain('border-panel-border')
    // The regression itself: a card carries BOTH the full `border` utility
    // and `rounded-lg`. Neither may survive.
    expect(tokens).not.toContain('rounded-lg')
    expect(tokens).not.toContain('border')
  })
})

// ── 2. Accordion's `flush` prop, with a contrast control ───────────────────

describe('2. Accordion(flush) renders one hairline; every other caller is untouched', () => {
  it('flush: no rounded-lg, no full border, no header border-b', () => {
    render(
      <Accordion title="Model card" testId="acc-flush" flush defaultExpanded>
        <p>Body</p>
      </Accordion>,
    )
    const section = screen.getByTestId('acc-flush')
    const tokens = classTokens(section)
    expect(tokens).toContain('border-b')
    expect(tokens).toContain('border-panel-border')
    expect(tokens).not.toContain('rounded-lg')
    expect(tokens).not.toContain('border')

    const header = screen.getByRole('button', { name: 'Model card' })
    expect(classTokens(header)).not.toContain('border-b')
  })

  it('CONTRAST CONTROL: without `flush`, the card keeps its old rounded border AND the header keeps its own border-b — unchanged for every existing caller', () => {
    render(
      <Accordion title="Your next steps" testId="acc-card" defaultExpanded>
        <p>Body</p>
      </Accordion>,
    )
    const section = screen.getByTestId('acc-card')
    const tokens = classTokens(section)
    expect(tokens).toContain('border')
    expect(tokens).toContain('rounded-lg')

    const header = screen.getByRole('button', { name: 'Your next steps' })
    expect(classTokens(header)).toContain('border-b')
  })
})

// ── 3. ModelFooter's divider is full-bleed ──────────────────────────────────

describe('3. ModelFooter divider spans the full panel width', () => {
  it('cancels its own gutter so the top rule is full-bleed, not content-width', () => {
    render(<ModelFooter onCopyText={vi.fn()} onCopyJson={vi.fn()} />)
    const footer = screen.getByTestId('model-footer')
    expect(footer.className).toContain('border-t')
    expect(footer.className).toContain('-mx-3')
    expect(footer.className).toContain('px-3')
  })
})

// ── 4. ModelTabBody's top-level container carries no extra section gap ─────

vi.mock('../../../../stores/uiStore', () => ({
  useUIStore: Object.assign(
    (selector: (s: any) => unknown) => selector({ pendingModelTabSection: null }),
    { getState: () => ({ requestModelTabSection: vi.fn() }) },
  ),
}))
vi.mock('../../../../telemetry/guidanceEvents', () => ({ trackGuidance: vi.fn() }))
vi.mock('../../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('../ModelAdjustments', () => ({ ModelAdjustments: () => null }))
vi.mock('../StreamingDiagnostics', () => ({ StreamingDiagnostics: () => null }))
vi.mock('../ReanalyseBar', () => ({ ReanalyseBar: () => null }))

import { ModelTabBody } from '../../ModelTabBody'

describe('4. ModelTabBody carries no space-y-4 doubling each section’s own rule', () => {
  it('the top-level container is not `space-y-4`', () => {
    useCanvasStore.setState(
      {
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
        goalConstraints: [],
      } as never,
      false,
    )
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
    const container = screen.getByTestId('model-tab')
    expect(classTokens(container)).not.toContain('space-y-4')
  })
})
