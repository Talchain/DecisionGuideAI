import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { OptionChanceCellProvider } from '../shared/OptionChanceCellProvider'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { useCanvasStore } from '../../store'
import { withLicensedOptionChances } from './__helpers__/optionChanceFixture'
import { GOAL_ANCHOR_COPY } from '../../../components/results/utils/goalAnchorCopy'

const attentionFixture = vi.hoisted(() => ({ active: false }))
vi.mock('../shared/useNodeAttention', () => ({ useNodeAttention: () => ({ reasons: attentionFixture.active ? [{ kind: 'fragile_link', order: 1, label: 'The comparison depends on a link from here. How sure are you of it?' }] : [], marked: attentionFixture.active, markedCount: 1, candidateCount: 1, fromLastRun: null }) }))

vi.mock('@xyflow/react', async () => ({ ...await vi.importActual('@xyflow/react'), Handle: () => null }))
const node = { id: 'mark-option', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Try a pilot', type: 'option', kind: 'option', provenance: 'ai_inferred' } }
function seed({ withheld = false, changed = false, leftOut = false, baseline = false, detailed = false, targets = false } = {}) {
  const data = { ...node.data, is_baseline: baseline, ...(targets ? { interventions: { factor: { value: 2, source: 'user_specified' } } } : {}) }
  const report = { option_probabilities: { ...(!leftOut ? { [node.id]: { status: 'computed', win_probability: .72 } } : {}), other: { status: 'computed', win_probability: .28 } },
    ...(withheld ? { producer_leader_permission: { permitted: false, producer_cause: 'constraint_verdict_withheld' } } : {}) }
  useCanvasStore.setState({ nodes: [{ ...node, data }, { ...node, id: 'other' }, ...(targets ? [{ id: 'factor', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Capacity', type: 'factor', observed_state: { value: 1, source: 'user' } } }] : [])], edges: [], ceeAnalysisReady: null,
    lodRung: 'full', viewMode: detailed ? 'expert' : 'standard', analysisStateV1: null, goalThreshold: 100,
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: '2026-10-07T12:00:00Z' },
    analysisFreshnessDirty: changed, importPendingServerRegistration: false, currentScenarioId: 'marks',
    v5AnalysisFact: { scenarioId: 'marks', analysisHash: 'run', hasRunAnalysisFact: true }, hasCompletedFirstRun: true,
    results: { status: 'complete', hash: 'run', report: !withheld && !leftOut
      ? withLicensedOptionChances(report, { [node.id]: 41, other: 29 }) : report },
  } as never)
  return render(<ReactFlowProvider><OptionChanceCellProvider><OptionNode id={node.id} type="option" data={data} selected={false} isConnectable positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0} deletable selectable draggable /></OptionChanceCellProvider></ReactFlowProvider>)
}
function mark(testId: string, id: string, words: string) {
  const el = screen.getByTestId(testId)
  expect(el).toHaveAttribute('data-card-mark', id)
  expect(el).toHaveAttribute('aria-label', words)
  expect(el.getAttribute('title') ?? '').toBe('')
  expect(el.textContent).not.toContain(words)
  expect(screen.getByTestId(`option-bottom-marks-${node.id}`).contains(el)).toBe(true)
  return el
}
beforeEach(() => { attentionFixture.active = false; useGuidanceStore.setState({ _sendMessage: () => {}, guidanceItems: [] } as never); useCanvasStore.setState({ results: { status: 'idle', report: null } } as never) })
afterEach(cleanup)
it('share-withheld: exact words become a bottom glyph; permitted is the contrast', () => {
  seed({ withheld: true })
  mark(`option-not-ranked-${node.id}`, 'share-withheld', 'Compared · share not shown')
  expect(screen.queryByTestId(`option-win-readout-${node.id}`)).toBeNull()
  cleanup(); seed()
  expect(screen.queryByTestId(`option-not-ranked-${node.id}`)).toBeNull()
  expect(screen.getByTestId(`option-win-readout-${node.id}`)).toHaveTextContent(GOAL_ANCHOR_COPY.phrase('41%', false))
})
it.each([false, true])('the visible Last run caption precedes the retained chance once (detailed %s); current is the contrast', (detailed) => {
  seed({ changed: true, detailed })
  const caption = screen.getByTestId(`option-win-anchor-${node.id}`)
  const readout = screen.getByTestId(`option-win-readout-${node.id}`)
  expect(caption).toHaveAttribute('aria-label', 'Last run')
  expect(caption).toHaveTextContent('Last run')
  expect(caption.compareDocumentPosition(readout) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getAllByTestId(`option-win-anchor-${node.id}`)).toHaveLength(1)
  // WS5-1: the caption is visible in the chance slot, and continues to carry the single status description.
  expect(screen.queryByTestId(`option-stale-state-${node.id}`)).toBeNull()
  expect(caption).toHaveAttribute('aria-description', 'Also: no new comparison yet')
  expect(screen.getByTestId(`option-bottom-marks-${node.id}`).querySelectorAll('[data-card-mark="last-run"],[data-card-mark="no-new-comparison"]')).toHaveLength(0)
  expect(readout).toHaveTextContent(GOAL_ANCHOR_COPY.phrase('41%', false))
  expect(screen.getByTestId(`option-analysis-currency-${node.id}`).getAttribute('aria-label')).not.toContain('of runs')
  cleanup(); seed()
  expect(screen.getByTestId(`option-win-anchor-${node.id}`)).toHaveTextContent('Current model')
  expect(screen.queryByTestId(`option-stale-state-${node.id}`)).toBeNull()
})
it('not-analysed chip becomes a glyph; computed is the contrast', () => {
  seed({ leftOut: true })
  mark(`option-not-analysed-chip-${node.id}`, 'not-analysed', 'Not analysed')
  cleanup(); seed()
  expect(screen.queryByTestId(`option-not-analysed-chip-${node.id}`)).toBeNull()
})
it('baseline becomes a glyph; a candidate is the contrast', () => {
  seed({ baseline: true })
  mark(`option-baseline-meta-${node.id}`, 'baseline-no-changes', 'Baseline · no changes')
  cleanup(); seed()
  expect(screen.queryByTestId(`option-baseline-meta-${node.id}`)).toBeNull()
})
it('all information marks are bottom-left, title has full width, Olumi stays in its original action rail', () => {
  seed({ withheld: true })
  const band = screen.getByTestId(`option-bottom-marks-${node.id}`)
  expect(band).toHaveClass('absolute', 'bottom-1.5', 'left-3')
  expect(band).toHaveAttribute('data-card-bottom-band', 'true')
  expect(band.contains(screen.getByTestId('node-provenance-mark'))).toBe(true)
  for (const el of document.querySelectorAll('[data-card-mark]')) expect(band.contains(el)).toBe(true)
  const title = screen.getByTestId('node-title')
  expect(title.parentElement?.parentElement?.querySelector('[data-card-mark], [data-testid="node-provenance-mark"]')).toBeNull()
  expect(screen.queryByTestId('node-title-corner-spacer')).toBeNull()
  const olumi = screen.getByTestId(`node-coaching-icon-${node.id}`)
  expect(band.contains(olumi)).toBe(false)
  expect(olumi.querySelector('img')).toHaveAttribute('src', '/olumi-mark-card.svg')
  const rail = olumi.closest(`[data-testid="node-card-rail-${node.id}"]`)!
  expect(rail).toHaveAttribute('data-rail-placement', 'inset')
  expect(rail).toHaveClass('bottom-[5px]', 'right-[6px]')
  expect(olumi.querySelector('img')).toHaveAttribute('data-icon', 'olumi-brand-mark')
  expect(olumi.querySelector('img')).toHaveAttribute('width', '15')
  expect(olumi.querySelector('img')).toHaveAttribute('height', '15')
})

it('baseline with a concrete target has its own shape and exact words', () => {
  seed({ baseline: true, targets: true })
  mark(`option-baseline-meta-${node.id}`, 'baseline-option', 'Baseline option')
  expect(document.querySelector('[data-card-mark="baseline-no-changes"]')).toBeNull()
})
it('the source button moves into the band with its existing value-specific inspector route', () => {
  seed({ targets: true })
  const band = screen.getByTestId(`option-bottom-marks-${node.id}`)
  const source = screen.getByTestId(`option-change-row-source-${node.id}-factor`)
  expect(source).toHaveAttribute('data-card-mark', 'source-you')
  expect(source.getAttribute('aria-label')).toContain('Set by you')
  expect(source.querySelector('.lucide-user-check')).not.toBeNull()
  expect(band.contains(source)).toBe(true)
  expect(screen.getByTestId(`option-change-row-${node.id}-factor`).contains(source)).toBe(false)
})

it('attention and coaching keep their exact words and move to the same band; absent signals are the contrast', () => {
  attentionFixture.active = true
  useGuidanceStore.setState({ guidanceItems: [{ item_id: 'mark-guidance', category: 'should_fix', source: 'structural', title: 'Review this node', priority: 50, primary_action: { type: 'discuss', prompt: 'Let us discuss.' }, target_object: { type: 'node', id: node.id } }] } as never)
  seed()
  const band = screen.getByTestId(`option-bottom-marks-${node.id}`)
  const attention = screen.getByTestId(`attention-marker-${node.id}`)
  const coaching = screen.getByTestId(`node-coaching-marker-${node.id}`)
  expect(attention).toHaveAttribute('aria-label', 'Worth reviewing: The comparison depends on a link from here. How sure are you of it?')
  expect(coaching).toHaveAttribute('aria-label', 'Coaching suggestion: Review this node')
  expect(attention.querySelector('.lucide-locate-fixed')).not.toBeNull()
  expect(band.contains(attention)).toBe(true)
  expect(band.contains(coaching)).toBe(true)
  expect(screen.getByTestId('node-header-row').contains(attention)).toBe(false)
  expect(screen.queryByTestId('node-title-corner-spacer')).toBeNull()
  cleanup(); attentionFixture.active = false; useGuidanceStore.setState({ guidanceItems: [] }); seed()
  expect(screen.queryByTestId(`attention-marker-${node.id}`)).toBeNull()
  expect(screen.queryByTestId(`node-coaching-marker-${node.id}`)).toBeNull()
})
