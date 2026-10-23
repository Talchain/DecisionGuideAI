import { installCanonicalFixtureState } from '../../../components/results/analysis-hero/__tests__/helpers/canonicalTestCells'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { OptionChanceCellProvider } from '../shared/OptionChanceCellProvider'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { useCanvasStore } from '../../store'
import { withLicensedOptionChances } from './__helpers__/optionChanceFixture'

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
  useCanvasStore.setState(installCanonicalFixtureState(useCanvasStore.getState()) as never)
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
  // #2747 re-scope 2 (U0): the permitted contrast's chance readout ("41%") is deleted — the canvas card shows no chance in C.
})
// #2747 re-scope 2 (U0): row deleted — "the visible Last run caption precedes the retained chance": its only subject, the
// chance-slot caption beside the retained chance, is removed in C (the card shows no chance). The current-run negative
// (no stale mark) stays pinned in OptionNode.optionStates.spec.tsx row 22c.
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
  // Vision spec §2c (23 Oct): Olumi's authorship mark ("Olumi suggested this") sits right after the name; every other
  // information mark stays in the band.
  const title = screen.getByTestId('node-title')
  const authorship = screen.getByTestId('node-provenance-mark')
  expect(title.contains(authorship)).toBe(true)
  expect(authorship).toHaveAttribute('data-provenance-claim', 'structural')
  expect(band.contains(authorship)).toBe(false)
  for (const el of document.querySelectorAll('[data-card-mark]')) if (el !== authorship) expect(band.contains(el)).toBe(true)
  expect([...title.parentElement!.parentElement!.querySelectorAll('[data-card-mark], [data-testid="node-provenance-mark"]')]).toEqual([authorship])
  expect(screen.queryByTestId('node-title-corner-spacer')).toBeNull()
  const olumi = screen.getByTestId(`node-coaching-icon-${node.id}`)
  expect(band.contains(olumi)).toBe(false)
  expect(olumi.querySelector('img')).toHaveAttribute('src', '/olumi-mark-card.svg')
  const rail = olumi.closest(`[data-testid="node-card-rail-${node.id}"]`)!
  expect(rail).toHaveAttribute('data-rail-placement', 'inset')
  expect(rail).toHaveClass('bottom-[5px]', 'right-[6px]')
  expect(olumi.querySelector('img')).toHaveAttribute('data-icon', 'olumi-brand-mark')
  // Paul 14 Oct 2026: the node Olumi mark is the panel's 12px AI glyph (was 15).
  expect(olumi.querySelector('img')).toHaveAttribute('width', '12')
  expect(olumi.querySelector('img')).toHaveAttribute('height', '12')
})

it('baseline with a concrete target has its own shape and exact words', () => {
  seed({ baseline: true, targets: true })
  mark(`option-baseline-meta-${node.id}`, 'baseline-option', 'Baseline option')
  expect(document.querySelector('[data-card-mark="baseline-no-changes"]')).toBeNull()
})
// Vision I (23 Oct, spec §2a "a glyph before each figure"): the target's source button LEADS its figure in the row,
// keeping its value-specific words and inspector route; it is no longer in the band. (Was: "moves into the band".)
it('the source button leads its figure in the row with its existing value-specific inspector route; the band does not hold it', () => {
  seed({ targets: true })
  const band = screen.getByTestId(`option-bottom-marks-${node.id}`)
  const source = screen.getByTestId(`option-change-row-source-${node.id}-factor`)
  expect(source).toHaveAttribute('data-card-mark', 'source-you')
  expect(source.getAttribute('aria-label')).toContain('Set by you')
  expect(source.querySelector('.lucide-user-check')).not.toBeNull()
  expect(band.contains(source)).toBe(false)
  const dd = screen.getByTestId(`option-change-row-${node.id}-factor`)
  expect(dd.contains(source)).toBe(true)
  const figure = screen.getByTestId(`option-change-row-target-${node.id}-factor`)
  expect(source.compareDocumentPosition(figure) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

it('attention and coaching keep their exact words in ONE Olumi badge in the band (vision spec §3); each alone draws the same mark; absent signals are the contrast', () => {
  const SENTENCE = 'Worth reviewing: The comparison depends on a link from here. How sure are you of it?'
  attentionFixture.active = true
  useGuidanceStore.setState({ guidanceItems: [{ item_id: 'mark-guidance', category: 'should_fix', source: 'structural', title: 'Review this node', priority: 50, primary_action: { type: 'discuss', prompt: 'Let us discuss.' }, target_object: { type: 'node', id: node.id } }] } as never)
  seed()
  const band = screen.getByTestId(`option-bottom-marks-${node.id}`)
  const coaching = screen.getByTestId(`node-coaching-marker-${node.id}`)
  // Both sources → one badge: the producer's words, then the cue's, on the one accessible name.
  expect(screen.queryByTestId(`attention-marker-${node.id}`)).toBeNull()
  expect(coaching).toHaveAttribute('aria-label', `Coaching suggestion: Review this node · ${SENTENCE}`)
  expect(coaching.querySelector('[data-icon="olumi-brand-mark"]')).not.toBeNull()
  expect(band.contains(coaching)).toBe(true)
  expect(screen.getByTestId('node-header-row').contains(coaching)).toBe(false)
  expect(screen.queryByTestId('node-title-corner-spacer')).toBeNull()
  // The cue alone: the same Olumi mark, its exact words.
  cleanup(); useGuidanceStore.setState({ guidanceItems: [] }); seed()
  const attention = screen.getByTestId(`attention-marker-${node.id}`)
  expect(attention).toHaveAttribute('aria-label', SENTENCE)
  expect(attention.querySelector('[data-icon="olumi-brand-mark"]')).not.toBeNull()
  expect(attention.querySelector('.lucide-locate-fixed')).toBeNull()
  expect(screen.getByTestId(`option-bottom-marks-${node.id}`).contains(attention)).toBe(true)
  cleanup(); attentionFixture.active = false; seed()
  expect(screen.queryByTestId(`attention-marker-${node.id}`)).toBeNull()
  expect(screen.queryByTestId(`node-coaching-marker-${node.id}`)).toBeNull()
})
