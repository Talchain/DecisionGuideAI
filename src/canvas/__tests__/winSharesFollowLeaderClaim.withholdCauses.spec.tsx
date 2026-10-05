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
import { leaderWithholdCause } from '../../components/results/analysisNew/analysisNewCopy'

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
  goal_path_unsized: 'This comparison turns on the link from ‘Investment firm outreach’ to ‘Investment firm meetings’, whose strength nobody has set yet. Set it to see how much it matters.',
  intake_identity_unverified: 'This comparison depends on which of the model’s options are the ones your brief lists, and that hasn’t been confirmed yet.',
  goal_path_unsized_unnamed: 'This comparison turns on a link whose strength nobody has set yet.',
  intake_options_missing: 'Your brief lists at least one option that isn’t in the model yet, so this comparison leaves it out. Check the model’s options against your brief.',
  /** RT-10 a8's R6 follow-up codes (Science d5, #87 6002718281); the goal is Paul's goal node, by its own label. */
  goal_product_not_read: 'This comparison depends on how the parts of ‘securing funding’ combine, which Olumi hasn’t been able to read yet.',
  options_identical: 'In this model, your options change the same things by the same amounts, so their results come out the same. Change what one of them does to see how they compare.',
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
  ['goal_path_unsized with NO such warning → its unnamed line, never a guessed link', 'goal_path_unsized', [], WORDS.goal_path_unsized_unnamed],
  ['goal_path_unsized naming a node the canvas lacks → its unnamed line', 'goal_path_unsized',
    [{ ...UNSIZED_WARNING, node_ids: [FROM, 'not_on_this_canvas'] }], WORDS.goal_path_unsized_unnamed],
  ['⭐ goal_product_not_read (RT-10 R6), the goal named by its own node label', 'goal_product_not_read', [], WORDS.goal_product_not_read],
  ['⭐ options_identical (RT-10 R6)', 'options_identical', [], WORDS.options_identical],
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

describe('goal_product_not_read never guesses the goal', () => {
  it('no goal label in the context: the existing fallback, never a goal-free paraphrase', () => {
    expect(winShareWithheldReason(stamp('goal_product_not_read'), { goalLabel: null })).toBe(WITHHELD_REASON_FALLBACK)
    expect(winShareWithheldReason(stamp('goal_product_not_read'))).toBe(WITHHELD_REASON_FALLBACK)
  })
  it('two goal nodes on the canvas: no goal is named (the selector falls back)', () => {
    seed('goal_product_not_read')
    const state = useCanvasStore.getState()
    const second = { id: 'second_goal', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Another goal', type: 'goal' } }
    expect(selectWinShareWithheldReason({ ...state, nodes: [...state.nodes, second] } as never)).toBe(WITHHELD_REASON_FALLBACK)
  })
  it('PRECONDITION: Paul\'s canvas holds exactly one goal node, labelled "securing funding"', () => {
    seed('goal_product_not_read')
    expect(useCanvasStore.getState().nodes.filter((n) => n.type === 'goal').map((n) => (n.data as { label: string }).label))
      .toEqual(['securing funding'])
  })
})

describe('the gate, without a store', () => {
  it('goal_path_unsized with no context (a caller that passes none) → its unnamed line', () => {
    expect(winShareWithheldReason(stamp('goal_path_unsized'))).toBe(WORDS.goal_path_unsized_unnamed)
  })
  it('a label longer than a display line is not shown → its unnamed line', () => {
    const long = 'x'.repeat(121)
    expect(winShareWithheldReason(stamp('goal_path_unsized'), {
      inferenceWarnings: [UNSIZED_WARNING], labelOf: (id) => (id === FROM ? long : 'Investment firm meetings'),
    })).toBe(WORDS.goal_path_unsized_unnamed)
  })
})

describe('MC P0\'s full list (`links`, nearest the goal first): read in its order, every link or none', () => {
  const labels: Record<string, string> = { a: 'Hours on the AI module', b: 'AI module availability', c: 'Team capacity', d: 'Delivered points' }
  const labelOf = (id: string) => labels[id] ?? null
  const reason = (warning: Record<string, unknown>) => winShareWithheldReason(stamp('goal_path_unsized'), { inferenceWarnings: [warning], labelOf })
  it('`links` outranks node_ids: its first link is the one named', () => {
    expect(reason({ code: 'GOAL_FIGURES_PLACEHOLDER_PATH', node_ids: ['c', 'd'], links: [{ from: 'a', to: 'b' }] }))
      .toBe('This comparison turns on the link from ‘Hours on the AI module’ to ‘AI module availability’, whose strength nobody has set yet. Set it to see how much it matters.')
  })
  it('a duplicated link is one link', () => {
    expect(reason({ code: 'GOAL_FIGURES_PLACEHOLDER_PATH', node_ids: ['a', 'b'], links: [{ from: 'a', to: 'b' }, { from: 'a', to: 'b' }] }))
      .toBe('This comparison turns on the link from ‘Hours on the AI module’ to ‘AI module availability’, whose strength nobody has set yet. Set it to see how much it matters.')
  })
  it('one link that cannot be named → no partial list: the unnamed line', () => {
    expect(reason({ code: 'GOAL_FIGURES_PLACEHOLDER_PATH', node_ids: ['a', 'b'], links: [{ from: 'a', to: 'b' }, { from: 'c', to: 'not_on_this_canvas' }] }))
      .toBe(WORDS.goal_path_unsized_unnamed)
  })
})

describe('Science d5 20:3xZ: several links, the separation echo, the overlap, and the two rewritten causes', () => {
  const labels: Record<string, string> = { a: 'A1', b: 'B1', c: 'C1', d: 'D1', e: 'E1', f: 'F1', g: 'G1', h: 'H1', i: 'I1', j: 'J1' }
  const labelOf = (id: string) => labels[id] ?? null
  const warn = (pairs: string[][]) => [{ code: 'GOAL_FIGURES_PLACEHOLDER_PATH', node_ids: pairs[0], links: pairs.map(([from, to]) => ({ from, to })) }]
  const say = (cause: string, warnings: unknown = []) => winShareWithheldReason(stamp(cause), { inferenceWarnings: warnings, labelOf })
  it('⭐ two links: both named, plural', () => {
    expect(say('goal_path_unsized', warn([['a', 'b'], ['c', 'd']])))
      .toBe('This comparison turns on the links from ‘A1’ to ‘B1’ and from ‘C1’ to ‘D1’, whose strengths nobody has set yet. Set them to see how much they matter.')
  })
  it('three links: all three named', () => {
    expect(say('goal_path_unsized', warn([['a', 'b'], ['c', 'd'], ['e', 'f']])))
      .toBe('This comparison turns on the links from ‘A1’ to ‘B1’, from ‘C1’ to ‘D1’ and from ‘E1’ to ‘F1’, whose strengths nobody has set yet. Set them to see how much they matter.')
  })
  it('five links: the first three (nearest the goal), then "and 2 more"', () => {
    expect(say('goal_path_unsized', warn([['a', 'b'], ['c', 'd'], ['e', 'f'], ['g', 'h'], ['i', 'j']])))
      .toBe('This comparison turns on the links from ‘A1’ to ‘B1’, from ‘C1’ to ‘D1’, from ‘E1’ to ‘F1’ and 2 more, whose strengths nobody has set yet. Set them to see how much they matter.')
  })
  it('⭐ separation_unavailable ECHOING an unsized withhold (Acceptance R6): the upstream cause, never "run again"', () => {
    expect(say('separation_unavailable', warn([['a', 'b']])))
      .toBe('This comparison turns on the link from ‘A1’ to ‘B1’, whose strength nobody has set yet. Set it to see how much it matters.')
  })
  it('separation_unavailable with no upstream withhold: run it again', () => {
    expect(say('separation_unavailable'))
      .toBe('Olumi couldn’t measure how far apart the options’ results are on this run. Run it again to see the comparison.')
  })
  it('options_do_not_separate (a real overlap): the overlap sentence', () => {
    expect(say('options_do_not_separate'))
      .toBe('In this model, the options’ results overlap too much to tell apart. Change a figure you’re unsure about to see what separates them.')
  })
  it('constraint_verdict_withheld stays at staging\'s sentence: names the checks, never a limit (pending Science\'s no-limits words)', () => {
    // CEE sends this token for any unentitled verdict, including a first pass on a brief with no limits
    // (theWithholdNamesNoLimitsTheUserNeverSet), so a sentence naming "a limit" is false there.
    expect(leaderWithholdCause('constraint_verdict_withheld'))
      .toBe("Olumi's checks on this run do not support putting one option forward.")
  })
  it('options_not_reconciled_with_brief', () => {
    expect(leaderWithholdCause('options_not_reconciled_with_brief'))
      .toBe('This comparison includes an option Olumi added that your brief didn’t name. Remove it and run again to see the comparison.')
  })
  it.each([
    // constraint_verdict_withheld is held at staging's sentence until Science rules words that name no limits (above).
    'no_option_meets_limit', 'every_option_likely_breaks_limit', 'separation_unavailable',
    'options_not_reconciled_with_brief', 'intake_identity_unverified', 'intake_options_missing', 'goal_path_unsized',
    'options_do_not_separate',
  ])('the copy rule over the WHOLE map: %s never recommends, ranks or says "put one forward"', (code) => {
    const words = leaderWithholdCause(code)
    expect(words).toBeTruthy()
    expect(words).not.toMatch(/recommend|\bbest\b|winner|you should|give a figure|put (one|an option) forward|putting one option forward/i)
  })
})

describe('the copy rule (DL #87 6002222614, Paul "It doesn\'t provide a recommendation"): a withhold is an invitation', () => {
  it.each(Object.entries(WORDS))('%s never recommends, ranks or tells the user what to do', (_code, words) => {
    expect(words).not.toMatch(/recommend|\bbest\b|winner|you should|give a figure/i)
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
