/**
 * The cut-3 bar (DL e8, #87 6002009604): a withheld leader passes only with an explicit, correct reason. Production
 * (Acceptance (d)) withheld for an option↔brief correspondence the payload typed nowhere, and every typed surface read
 * "Olumi isn't naming an option on this run." Two CEE changes now state their causes, and this map reads them first
 * (reader-first: inert until CEE emits them):
 * - `goal_path_unsized` (MC P0): names the failing link's own ends, from the same Run's typed
 *   `GOAL_FIGURES_PLACEHOLDER_PATH` warning (`node_ids[0]` → `node_ids[1]`);
 * - `intake_identity_unverified` and `intake_options_missing` (a8): label-free words.
 * The words are Science d5's, verbatim. An unknown code keeps the existing fallback.
 *
 * Replayed on Paul's served Run fixture (4276f3f9), through the product mapper, on the store-reading surfaces: the
 * one selector (Compare, the run strip, the option inspector and the cards read it), the inspector's Decision and
 * Outcome panels, and the chat's comparison block.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useCanvasStore } from '../store'
import { mapV5AnalysisToReport } from '../../v5/mapV5AnalysisToReport'
import { DecisionPanel } from '../ui/inspector-v2/panels/DecisionPanel'
import { OutcomePanel } from '../ui/inspector-v2/panels/OutcomePanel'
import { V5ComparisonBlock } from '../../v5/blocks/V5ComparisonBlock'
import { runChangesSummaryLines } from '../graphChanges/runChangesSummaryLines'
import { WITHHELD_REASON_FALLBACK, selectWinShareWithheldReason, winShareWithheldReason } from '../state/winShareGate'

const fx = JSON.parse(
  readFileSync(resolve(process.cwd(), 'e2e/geometry/fixtures/securing-funding-4276f3f9.fixture.json'), 'utf8'),
) as { draft: { nodes: Array<{ id: string; kind: string; label: string }>; edges: Array<{ from: string; to: string }> }; analysis_block: unknown }

const report = mapV5AnalysisToReport(fx.analysis_block as never) as unknown as Record<string, unknown>
const nodes = fx.draft.nodes.map(n => ({ id: n.id, type: n.kind, position: { x: 0, y: 0 }, data: { label: n.label, type: n.kind } }))
const edges = fx.draft.edges.map((e, i) => ({ id: `e${i}`, source: e.from, target: e.to, data: {} }))

/** A real link of the served model: 'Investment firm outreach' → 'Investment firm meetings'. */
const FROM = 'investment_firm_outreach'
const TO = 'investment_firm_meetings'
const UNSIZED_WARNING = {
  code: 'GOAL_FIGURES_PLACEHOLDER_PATH', severity: 'warning', node_ids: [FROM, TO], option_ids: ['angel_bridge'],
  message: 'Not shown. Olumi hasn’t sized how ‘Investment firm outreach’ moves ‘Investment firm meetings’.',
}

/** Science d5's words, verbatim (#87 thread; one source). */
const WORDS = {
  goal_path_unsized: 'Olumi hasn’t sized how ‘Investment firm outreach’ moves ‘Investment firm meetings’, so it isn’t naming an option on this run. Give a figure for that link and Olumi will use it.',
  intake_identity_unverified: 'Olumi isn’t naming an option yet: it hasn’t confirmed that the model’s options are the ones your brief lists.',
  intake_options_missing: 'Olumi isn’t naming an option yet: your brief lists at least one option that isn’t in the model.',
} as const

const stamp = (cause: string) => ({ permitted: false, withheld_reason: 'leader_claim_withheld', producer_cause: cause })
const seed = (cause: string, warnings: unknown[] = []) => {
  const base = Array.isArray(report.inference_warnings) ? report.inference_warnings : []
  useCanvasStore.setState({
    nodes, edges,
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' },
    analysisFreshnessDirty: false,
    results: {
      status: 'complete', hash: 'run-4276',
      report: { ...report, inference_warnings: [...base, ...warnings], producer_leader_permission: stamp(cause) },
    },
  } as never)
}

afterEach(() => {
  cleanup()
  useCanvasStore.setState({ results: { status: 'idle', report: null }, analysisFreshness: null } as never)
})

/** Every case: the code, what the Run carries beside it, and the words each surface must read. */
const CASES: ReadonlyArray<readonly [string, string, unknown[], string]> = [
  ['⭐ goal_path_unsized, the link named from the Run\'s warning', 'goal_path_unsized', [UNSIZED_WARNING], WORDS.goal_path_unsized],
  ['⭐ intake_identity_unverified', 'intake_identity_unverified', [], WORDS.intake_identity_unverified],
  ['⭐ intake_options_missing (label-free)', 'intake_options_missing', [], WORDS.intake_options_missing],
  ['goal_path_unsized with NO such warning → the fallback, never guessed words', 'goal_path_unsized', [], WITHHELD_REASON_FALLBACK],
  ['goal_path_unsized naming a node the canvas lacks → the fallback', 'goal_path_unsized',
    [{ ...UNSIZED_WARNING, node_ids: [FROM, 'not_on_this_canvas'] }], WITHHELD_REASON_FALLBACK],
  ['CONTROL: an unknown code → the existing fallback, unchanged', 'a_cause_nobody_mapped', [], WITHHELD_REASON_FALLBACK],
  ['CONTROL: the old generic code (prod (d)) → the existing fallback, unchanged', 'analysis_leader_withheld', [], WITHHELD_REASON_FALLBACK],
]

describe('PRECONDITION — the served Run and its canvas', () => {
  it('the fixture has the link and its labels, and the mapper passes inference_warnings through', () => {
    expect(nodes.find(n => n.id === FROM)?.data.label).toBe('Investment firm outreach')
    expect(nodes.find(n => n.id === TO)?.data.label).toBe('Investment firm meetings')
    seed('goal_path_unsized', [UNSIZED_WARNING])
    const held = useCanvasStore.getState().results?.report as { inference_warnings?: Array<{ code: string }> }
    expect(held.inference_warnings?.some(w => w.code === 'GOAL_FIGURES_PLACEHOLDER_PATH')).toBe(true)
  })
})

describe.each(CASES)('%s', (_name, cause, warnings, words) => {
  it('the one selector (Compare, the run strip, the option inspector and the cards read it)', () => {
    seed(cause, warnings)
    expect(selectWinShareWithheldReason(useCanvasStore.getState() as never)).toBe(words)
  })

  it('the run strip says it as its "Moved" note', () => {
    seed(cause, warnings)
    const view = { inputs: { rows: [] }, movements: [], movementsUnavailable: false } as never
    expect(runChangesSummaryLines(view, true, selectWinShareWithheldReason(useCanvasStore.getState() as never)).movedNote).toBe(words)
  })

  it('the inspector\'s Decision and Outcome panels', () => {
    seed(cause, warnings)
    const decision = render(<DecisionPanel nodeId="decision_securing_funding" techMode={false} onClose={() => {}} onNavigate={() => {}} />)
    expect(decision.getByTestId('decision-panel-not-ranked').textContent).toBe(words)
    decision.unmount()
    const outcome = render(<OutcomePanel nodeId="investment_firm_meetings" techMode={false} onClose={() => {}} onNavigate={() => {}} />)
    expect(outcome.getByTestId('outcome-panel-not-ranked').textContent).toBe(words)
  })

  it('the chat\'s comparison block', () => {
    seed(cause, warnings)
    const block = { type: 'comparison', narrative: '', options: [{ option_id: '10979ab0', label: 'Convertible bridge from existing supporters', win_probability: 0.7966 }] }
    const { getByTestId } = render(<V5ComparisonBlock block={block as never} />)
    expect(getByTestId('v5-comparison-not-ranked').textContent).toBe(words)
  })
})

describe('the gate, without a store', () => {
  it('goal_path_unsized with no context (a caller that passes none) → the fallback', () => {
    expect(winShareWithheldReason(stamp('goal_path_unsized'))).toBe(WITHHELD_REASON_FALLBACK)
  })
  it('a label longer than a display line is not shown → the fallback', () => {
    const long = 'x'.repeat(121)
    expect(winShareWithheldReason(stamp('goal_path_unsized'), {
      inferenceWarnings: [UNSIZED_WARNING], labelOf: (id) => (id === FROM ? long : 'Investment firm meetings'),
    })).toBe(WITHHELD_REASON_FALLBACK)
  })
})

describe('every store-reading surface takes the reason from the ONE selector', () => {
  it.each([
    'src/canvas/compare-tab/CompareRunPairBody.tsx',
    'src/canvas/components/RunChangesSummary.tsx',
    'src/canvas/ui/inspector-v2/panels/OptionPanel.tsx',
    'src/canvas/nodes/OptionNode.tsx',
    'src/v5/blocks/V5ComparisonBlock.tsx',
  ])('%s reads selectWinShareWithheldReason', (path) => {
    const src = readFileSync(resolve(process.cwd(), path), 'utf8')
    expect(src).toMatch(/useCanvasStore\(selectWinShareWithheldReason\)/)
  })
})
