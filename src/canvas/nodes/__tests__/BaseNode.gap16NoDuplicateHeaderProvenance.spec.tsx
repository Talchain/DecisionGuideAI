/**
 * ⛔ GAP-16 (DESIGN-GAP-AUDIT-20260924.md row 16) — no duplicate header mark
 * where the value line already carries the source.
 *
 * Contract §03: "Show useful exceptions, not the same provenance mark
 * everywhere." `NodeProvenanceMark` in the title row (`BaseNode.tsx:2356-
 * 2360`) can render a `claim="value"` mark for a factor/risk carrying a
 * declared value — and `FactorNode`/`RiskNode` ALSO render their own
 * value-line source mark (`valueSourceMark.tsx`, `factor-value-source-{id}`
 * / `factor-value-mark-slot-{id}`) for the SAME number, using the SAME
 * classifier (`classifyValueProvenance(observedState.source)`). That is one
 * fact stamped twice on one card.
 *
 * Fix: the header never renders a `claim="value"` mark — the value line
 * always carries it instead (verified below to still be present, so the
 * fact is not lost, only de-duplicated). `claim="structural"` marks are
 * UNTOUCHED: they answer a different question ("who put this element on
 * the board") that nothing else on the card states, including in the rare
 * two-mark disagreement case.
 *
 * Harness: `useCanvasStore.setState` directly (the real store), following
 * `FactorNode.boundedAnatomy.spec.tsx` — the mocked-store harness some
 * sibling provenance specs use renders the header from props alone but
 * leaves the factor's value LINE unmounted (missing store fields
 * `factorDisplayText` depends on), which would make this spec's own
 * "the fact is not lost" half untestable.
 *
 * Bound by identity: each case renders one node id and reads that card's
 * own testids, never a text/label predicate another card could satisfy.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { OptionNode } from '../OptionNode'
import { useCanvasStore } from '../../store'

const baseNodeProps = {
  selected: false,
  dragging: false,
  zIndex: 0,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

function seed(id: string, type: string, data: Record<string, unknown>) {
  useCanvasStore.setState({
    nodes: [{ id, type, position: { x: 0, y: 0 }, data }],
    edges: [],
    ceeAnalysisReady: null,
    viewMode: 'standard',
    lodRung: 'full',
    goalConstraints: [],
    analysisStateV1: null,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    v5AnalysisFact: null,
    hasCompletedFirstRun: false,
    importPendingServerRegistration: false,
    currentScenarioId: 'gap16-scenario',
    results: { status: 'idle', report: null },
    highlightedNodes: new Set(),
    dimmedNodeIds: new Set(),
  } as never)
}

function renderFactor(id: string, data: Record<string, unknown>) {
  seed(id, 'factor', data)
  return render(
    <ReactFlowProvider>
      <FactorNode {...(baseNodeProps as any)} id={id} type="factor" data={data as never} />
    </ReactFlowProvider>,
  )
}

function renderOption(id: string, data: Record<string, unknown>) {
  seed(id, 'option', data)
  return render(
    <ReactFlowProvider>
      <OptionNode {...(baseNodeProps as any)} id={id} type="option" data={data as never} />
    </ReactFlowProvider>,
  )
}

const headerValueMarks = () =>
  screen
    .queryAllByTestId('node-provenance-mark')
    .filter((el) => el.getAttribute('data-provenance-claim') === 'value')

describe('GAP-16 — the header never repeats the value line\'s own source mark', () => {
  it('an unconfirmed Olumi estimate: header carries NO value-claim mark; the value line still carries est.', () => {
    renderFactor('fac_ai', {
      label: 'Hiring rate',
      type: 'factor',
      category: 'controllable',
      provenance: 'ai_inferred',
      observedState: { value: 0.08, unit: '%', display_value: '8%', extractionType: 'inferred', source: 'cee_inference' },
    })
    expect(headerValueMarks(), 'the header must not duplicate the value line\'s mark').toHaveLength(0)
    // The fact is not lost — it is told once, on the value line. This
    // fixture is an unconfirmed Olumi estimate, so `factorValueSourceMark`
    // routes to `EstimateMarker` (`est.`) rather than the generic
    // `ValueSourceMark` — still the value line's own mark, just its 'olumi'
    // rendering path (`FactorNode.tsx`'s `renderValueSourceMark`).
    expect(screen.getByTestId('estimate-marker')).toBeTruthy()
    expect(screen.getByTestId('factor-recorded-value')).toBeTruthy()
  })

  it('a user-edited factor: header carries NO value-claim mark; the value line carries "you"', () => {
    renderFactor('fac_you', {
      label: 'Hiring rate',
      type: 'factor',
      category: 'controllable',
      provenance: 'user_set',
      observedState: { value: 0.5, unit: '%', display_value: '50%', source: 'user_override' },
    })
    expect(headerValueMarks()).toHaveLength(0)
    const own = screen.getByTestId('factor-value-source-fac_you')
    expect(own).toBeTruthy()
    expect(own.getAttribute('data-value-source')).toBe('you')
  })

  // ⛔ Review 5822866079: the value line's classifier is NOT the header's. When
  // it reads `unknown`, the header's mark was the only one with a kind, and a
  // number must never be left unmarked (Paul, 23 Sep point 1).
  it('⭐ OPPOSITE CONTROL — a stamped `ai` source WITHOUT extractionType: the value line reads unknown, so the header KEEPS its "AI estimate" value mark', () => {
    renderFactor('fac_ai_unclassified', {
      label: 'Hiring rate',
      type: 'factor',
      category: 'controllable',
      provenance: 'ai_inferred',
      observedState: { value: 0.08, unit: '%', display_value: '8%', source: 'cee_inference' },
    })
    expect(screen.getByTestId('factor-recorded-value')).toBeTruthy()
    const header = headerValueMarks()
    expect(header, 'the only mark with a kind must survive').toHaveLength(1)
    expect(header[0].getAttribute('data-provenance-kind')).toBe('ai')
    expect(header[0].getAttribute('aria-label') ?? '').not.toBe('')
  })

  it('⭐ OPPOSITE CONTROL — no source at all: header keeps its mark and the value line still says "no source"', () => {
    renderFactor('fac_ai_nosource', {
      label: 'Hiring rate',
      type: 'factor',
      category: 'controllable',
      provenance: 'ai_inferred',
      observedState: { value: 0.08, unit: '%', display_value: '8%' },
    })
    expect(headerValueMarks()).toHaveLength(1)
    expect(screen.getByTestId('factor-value-source-fac_ai_nosource').textContent).toContain('no source')
  })

  it('CONTRAST — an OPTION card (no value field at all) still gets its structural header mark', () => {
    renderOption('opt_rebuild', {
      label: 'Rebuild',
      type: 'option',
      provenance: 'ai_inferred',
    })
    const marks = screen.queryAllByTestId('node-provenance-mark')
    expect(marks, 'the structural claim is a different question and is not a duplicate').toHaveLength(1)
    expect(marks[0].getAttribute('data-provenance-claim')).toBe('structural')
  })
})
