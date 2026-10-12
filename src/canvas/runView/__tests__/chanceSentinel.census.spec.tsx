/**
 * ⭐⭐ #2747 RE-SCOPE 2 (U1): THE BEHAVIOURAL SENTINEL CENSUS — the proof that no surface composes its own chance.
 *
 * Three UI rounds in a row each found one more surface saying a figure or words of its own (Compare's 46% beside a
 * withheld cell; the Results range lines' "chance of meeting your goal"; "Goal: at least 10%" for a change target). A name
 * census and a lint rule could not see them, so this census looks at what is ON THE SCREEN.
 *
 * Every surface the deployed flags mount that has ever shown a chance (or a win share) is mounted against the sentinel Run
 * (`helpers/chanceSentinels.ts`), where every raw probability-like field holds a UNIQUE value:
 *  (a) CEE's canonical cells WITHHELD → no sentinel rendering anywhere, in text or aria, on any surface;
 *  (b) the cells LICENSED with served strings no raw field holds → still no sentinel anywhere; the served figures appear
 *      ONLY on the journey-path surfaces (U0: the Results hero, option cards and range lines; the chat analysis card),
 *      and there in CEE's words, never a UI-composed chance phrase.
 * No surface says the hiring CHANGE target as a level ("at least 10%" without "higher than today").
 * Win shares are sentinels too (DL ruling (A), 12 Oct): CEE serves no wording or Run authority for them, so in C none shows.
 *
 * The deployed flags are DERIVED: `e2e/core/journey/stack/ui.staging-flags.env` (the J1 harness's copy of staging's
 * netlify.toml) through `src/flags.ts`'s envKey → storageKey map, set as the storage overrides the flag reader honours.
 *
 * SCOPE: the surfaces listed in SURFACES and FUNCTIONS, mounted in jsdom: presence and absence of strings and aria, not
 * layout. The lint rule (`chance-gate/no-raw-chance-read`) stays as a regression aid and claims no completeness.
 */
import '@testing-library/jest-dom/vitest'
import type { ComponentProps } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('@xyflow/react', async importOriginal => ({ ...await importOriginal<typeof import('@xyflow/react')>(), Handle: () => null }))
vi.mock('../../../contexts/AuthContext', async importOriginal => ({
  ...await importOriginal<typeof import('../../../contexts/AuthContext')>(),
  useAuth: () => ({ authenticated: false, user: null }),
}))
vi.mock('../../../hooks/useISLConformal', () => ({ useISLConformal: () => ({ data: null, loading: false, predict: vi.fn() }) }))
vi.mock('../../hooks/useComparisonDetection', () => ({ useComparisonDetection: () => ({ optionNodes: [], isComparison: false }) }))
vi.mock('../../graphChanges/rowCanvasLink', async importOriginal => ({
  ...await importOriginal<typeof import('../../graphChanges/rowCanvasLink')>(), canvasLinkOfTarget: vi.fn(), useCanvasLight: vi.fn(),
}))
vi.mock('../../../components/results/coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
const sharedSnapshot = vi.fn()
vi.mock('../../../services/scenarioService', () => ({ getSharedSnapshotBySlug: (...args: unknown[]) => sharedSnapshot(...args) }))

import { ResultsBody } from '../../../components/results/ResultsBody'
import { AnalysisNewTabBody } from '../../../components/results/analysisNew/AnalysisNewTabBody'
import { useResultsSectionData } from '../../../components/results/useResultsSectionData'
import { V5AnalysisResultBlock } from '../../../v5/blocks/V5AnalysisResultBlock'
import { V5ComparisonBlock } from '../../../v5/blocks/V5ComparisonBlock'
import { InlineBlocks } from '../../conversation/InlineBlocks'
import type { V5AnalysisResultBlock as V5AnalysisResultBlockType } from '../../conversation/types'
import { OptionNode } from '../../nodes/OptionNode'
import { GoalNode } from '../../nodes/GoalNode'
import { DecisionNode } from '../../nodes/DecisionNode'
import { OutcomeNode } from '../../nodes/OutcomeNode'
import { OptionChanceCellProvider } from '../../nodes/shared/OptionChanceCellProvider'
import { CompareRunPairBody } from '../../compare-tab/CompareRunPairBody'
import { RunChangesSummary } from '../../components/RunChangesSummary'
import { ConditionalWinnerCards } from '../../../components/results/ConditionalWinnerCards'
import { LensInfoPanel } from '../../components/LensInfoPanel'
import { VersionResultDiff } from '../../versions/VersionResultDiff'
import { canvasLinkOfTarget, useCanvasLight } from '../../graphChanges/rowCanvasLink'
import { GoalConstraintsSection } from '../../components/model-tab/GoalConstraintsSection'
import { ModelTabV2Panel } from '../../model-tab-v2/ModelTabV2Panel'
import { GoalPanel } from '../../ui/inspector-v2/panels/GoalPanel'
import { OptionPanel } from '../../ui/inspector-v2/panels/OptionPanel'
import { DecisionPanel } from '../../ui/inspector-v2/panels/DecisionPanel'
import { OutcomePanel } from '../../ui/inspector-v2/panels/OutcomePanel'
import { RiskPanel } from '../../ui/inspector-v2/panels/RiskPanel'
import { DecisionSummary } from '../../components/DecisionSummary'
import { ComparisonCanvasLayout } from '../../components/ComparisonCanvasLayout'
import { useComparisonStore } from '../../stores/comparisonStore'
import SharedBriefPage from '../../../pages/SharedBriefPage'
import { buildAskAiQuestion } from '../../conversation/askAi'
import { buildSnapshotFromV5Analysis } from '../../stores/v5RunSnapshotFactory'
import { renderTimelineSummary } from '../../journey/renderTimelineSummary'
import { useCanvasStore } from '../../store'
import {
  A, B, DISPLAY_A, EDGES, FACE_A, FACE_B, LOW_DISPLAY, LOW_FACE, FACE_B_SAME, GENERIC_CHANCE_PHRASES, UI_CHANCE_LABELS, type SentinelForm, GRAPH_HASH, LABEL, NODES, RAW, RUN_ID, SENTINELS, SERVED_FIGURES, SQ,
  ONE_IN, SQ_LINE, WHY_A, WHY_B, resetSentinel, seedSentinel, seededForm, sentinelBlock, sentinelHits, sentinelPatterns, sentinelRunDelta,
} from './helpers/chanceSentinels'
import { openEveryDisclosure, readSurface } from './helpers/sentinelScan'

type Form = SentinelForm
interface Surface {
  readonly name: string
  /** U0: a journey-path surface, which keeps chances from CEE's served cells only. */
  readonly u0: boolean
  /** Mount the surface; `hash` is the seeded Run's response hash. Returns its root. */
  readonly mount: (hash: string) => Element | Promise<Element>
  /** What a U0 surface must say in each form (a positive control, so an absence is never vacuous). */
  readonly says?: Readonly<Record<Form, readonly string[]>>
  /** Rendered-text floor: an empty mount would make the census vacuous. */
  readonly minText?: number
  /** Elements a form must draw (by test id): the branch the form exists to reach is on the screen, so it is censused. */
  readonly reaches?: Partial<Readonly<Record<Form, readonly string[]>>>
  /** [test id, words]: the element must say CEE's served words itself (bound to the element, not the whole surface). */
  readonly saysWithin?: Partial<Readonly<Record<Form, ReadonlyArray<readonly [string, string]>>>>
}

// ─── the deployed flags, derived ───
const ROOT = process.cwd()
const FLAG_STORAGE: ReadonlyMap<string, string> = new Map([...readFileSync(join(ROOT, 'src/flags.ts'), 'utf8')
  .matchAll(/envKey:\s*'([A-Z0-9_]+)',\s*storageKey:\s*'([^']+)'/g)].map(m => [m[1], m[2]]))
const DEPLOYED = readFileSync(join(ROOT, 'e2e/core/journey/stack/ui.staging-flags.env'), 'utf8').split('\n')
  .map(line => /^(VITE_[A-Z0-9_]+)=(.*)$/.exec(line.trim())).filter((m): m is RegExpExecArray => m !== null)
function setDeployedFlags(): number {
  let set = 0
  for (const [, key, value] of DEPLOYED) {
    const storage = FLAG_STORAGE.get(key)
    if (storage === undefined) continue
    localStorage.setItem(storage, value === 'false' || value === '0' ? '0' : '1')
    set += 1
  }
  return set
}

function sectionData() {
  const { result, unmount } = renderHook(() => useResultsSectionData())
  const data = result.current
  unmount()
  return data
}
/** A node's props as React Flow passes them, typed as the card's own props. */
const nodeProps = <P,>(id: string, type: string): P => {
  const n = NODES.find(x => x.id === id)!
  return { id, type, data: n.data, selected: false, isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false,
    zIndex: 0, deletable: true, selectable: true, draggable: true } as unknown as P
}
const panel = { techMode: false, onClose: () => {}, onNavigate: () => {} }
/** `leading`: the Run's named leader. A null leader hides the share row on its own, so a leader-named card is censused too. */
const chatBlock = (leading: string | null = null) => {
  const b = sentinelBlock(seededForm()) as { enrichment: unknown; win_probabilities: unknown }
  return { type: 'v5_analysis_result', summary: 'The analysis completed.', leading_option_id: leading, win_probabilities: b.win_probabilities,
    enrichment: b.enrichment, computed_against_hash: GRAPH_HASH, run_id: RUN_ID } as unknown as V5AnalysisResultBlockType
}
const win = (id: string) => RAW.win_probability[id as keyof typeof RAW.win_probability]
const label = (id: string) => LABEL[id as keyof typeof LABEL]

const SURFACES: readonly Surface[] = [
  {
    name: 'Analysis tab (ResultsBody: hero, option cards, range lines, goal block)', u0: true,
    mount: () => render(<ResultsBody resultsSectionData={sectionData()} tornadoData={{ rows: [], expectedOutcome: null }}
      onSendMessage={() => {}} expertMode={false} />).container,
    says: { withheld: [WHY_A, WHY_B, SQ_LINE], licensed: [FACE_A, FACE_B, SQ_LINE], same_bounds: [FACE_A, FACE_B_SAME, SQ_LINE],
      agreeing_low: [LOW_FACE[A], LOW_FACE[B], LOW_FACE[SQ]], no_words: [FACE_A, FACE_B, SQ_LINE] },
    // Every option's figure passes the gate, so each Results card draws its goal row (and, before C, a low-chance badge).
    reaches: { agreeing_low: [`goal-readout-${A}`, `goal-readout-${B}`] },
    // Each card's goal row is captioned by CEE's own face for that option (DL 12 Oct), on the card itself.
    saysWithin: { agreeing_low: [[`option-card-${A}`, LOW_FACE[A]], [`option-card-${B}`, LOW_FACE[B]]] },
  },
  {
    name: 'Reasoning tab (AnalysisNewTabBody: decision matrix, options comparison, glance, commitment, model strip)', u0: false,
    mount: hash => render(<AnalysisNewTabBody resultsSectionData={sectionData()} isPreRun={false} isRunning={false} isStale={false}
      responseHash={hash} />).container,
  },
  {
    name: 'chat analysis card (V5AnalysisResultBlock)', u0: true,
    mount: () => render(<V5AnalysisResultBlock block={chatBlock()} />).container,
    says: { withheld: [WHY_A, WHY_B, SQ_LINE], licensed: [FACE_A, FACE_B, SQ_LINE], same_bounds: [FACE_A, FACE_B_SAME, SQ_LINE],
      agreeing_low: [LOW_FACE[A], LOW_FACE[B], LOW_FACE[SQ]], no_words: [FACE_A, FACE_B, SQ_LINE] },
  },
  {
    name: 'chat analysis card, the Run names a leader (V5AnalysisResultBlock)', u0: true,
    mount: () => render(<V5AnalysisResultBlock block={chatBlock(A)} />).container,
    says: { withheld: [WHY_A, WHY_B, SQ_LINE], licensed: [FACE_A, FACE_B, SQ_LINE], same_bounds: [FACE_A, FACE_B_SAME, SQ_LINE],
      agreeing_low: [LOW_FACE[A], LOW_FACE[B], LOW_FACE[SQ]], no_words: [FACE_A, FACE_B, SQ_LINE] },
  },
  {
    name: 'chat comparison card (V5ComparisonBlock)', u0: false, minText: 10,
    mount: () => render(<V5ComparisonBlock block={{ type: 'v5_comparison', narrative: 'How the options compare.',
      options: [A, B, SQ].map(id => ({ option_id: id, label: label(id), win_probability: win(id) })) } as never} />).container,
  },
  {
    name: 'chat deterministic comparison block (InlineBlocks "comparison")', u0: false, minText: 10,
    mount: () => render(<InlineBlocks blocks={[{ type: 'comparison', narrative: 'How the options compare.',
      options: [A, B].map((id, i) => ({ id, label: label(id), rank: i + 1, probability: win(id) })) } as never]} />).container,
  },
  {
    name: 'canvas option cards (OptionNode ×3)', u0: false, minText: 10,
    mount: () => render(<ReactFlowProvider><OptionChanceCellProvider>
      {[A, B, SQ].map(id => <OptionNode key={id} {...nodeProps<ComponentProps<typeof OptionNode>>(id, 'option')} />)}
    </OptionChanceCellProvider></ReactFlowProvider>).container,
  },
  {
    name: 'canvas goal card (GoalNode)', u0: false, minText: 10,
    mount: () => render(<ReactFlowProvider><GoalNode {...nodeProps<ComponentProps<typeof GoalNode>>('productivity', 'goal')} /></ReactFlowProvider>).container,
  },
  {
    name: 'canvas decision card (DecisionNode)', u0: false, minText: 10,
    mount: () => render(<ReactFlowProvider><DecisionNode {...nodeProps<ComponentProps<typeof DecisionNode>>('decide', 'decision')} /></ReactFlowProvider>).container,
  },
  {
    name: 'canvas outcome card (OutcomeNode)', u0: false, minText: 5,
    mount: () => render(<ReactFlowProvider><OutcomeNode {...nodeProps<ComponentProps<typeof OutcomeNode>>('delivery', 'outcome')} /></ReactFlowProvider>).container,
  },
  {
    name: 'canvas decision summary (DecisionSummary)', u0: false, minText: 10,
    mount: () => render(<DecisionSummary />).container,
  },
  {
    name: 'canvas comparison layout (ComparisonCanvasLayout)', u0: false, minText: 10,
    mount: () => {
      act(() => useComparisonStore.getState().setComparisonMode({ active: true,
        scenarios: [{ label: label(A), optionId: A, nodes: NODES, edges: EDGES }, { label: label(B), optionId: B, nodes: NODES, edges: EDGES }] as never,
        labels: [label(A), label(B)], selectedIndices: [0, 1], hasMoreOptions: false, allOptionsCount: 2, comparison: null,
        apiResponse: { analysis_status: 'complete', option_comparison: [A, B].map(id => ({ option_id: id, option_label: label(id),
          outcome: { mean: 10, p10: 7, p50: 10, p90: 13 }, win_probability: win(id) })) } } as never))
      return render(<ComparisonCanvasLayout />).container
    },
  },
  {
    name: 'Compare tab (CompareRunPairBody: goal chances, run shares)', u0: false,
    mount: hash => render(<CompareRunPairBody responseHash={hash} />).container,
  },
  {
    // Mounted inside the Analysis tab's act-on-it queue; the sentinel Run withholds the leader, which hides its labels, so
    // the card is mounted directly with the leader PERMITTED (a Run that names one) — the arm where it says the most.
    name: 'Analysis tab conditional-scenario cards, leader permitted (ConditionalWinnerCards)', u0: false, minText: 10,
    mount: () => render(<ConditionalWinnerCards winners={sectionData().confidence.conditionalWinners ?? []} recommendedOptionId={A}
      mayNameLeader />).container,
  },
  {
    // The robustness lens's panel (graph lens deployed): its fragile links, read from the Run. It portals into the overlay
    // band, so the whole document is read.
    name: 'canvas robustness lens panel (LensInfoPanel, lens = robustness)', u0: false, minText: 10,
    mount: () => {
      useCanvasStore.setState({ lens: { ...useCanvasStore.getState().lens, active: 'robustness' } } as never)
      render(<LensInfoPanel />)
      expect(screen.getByTestId('lens-info-robustness'), 'the robustness view mounted (else this row is vacuous)').toBeInTheDocument()
      return document.body
    },
  },
  {
    name: 'canvas "Since the last run" strip (RunChangesSummary)', u0: false, minText: 10,
    mount: () => render(<RunChangesSummary />).container,
  },
  {
    name: 'versions: recorded results for two saved versions (VersionResultDiff → WhatsChanged)', u0: false, minText: 10,
    mount: () => render(<VersionResultDiff fromVersion={{ versionNumber: 1, label: null }} toVersion={{ versionNumber: 2, label: null }}
      results={{ status: 'available', kind: 'paired_runs', run_delta: sentinelRunDelta(),
        prior_run: { run_id: 'run-before-sentinel', computed_at: '2026-10-12T01:00:00.000Z' },
        current_run: { run_id: RUN_ID, computed_at: '2026-10-12T02:00:00.000Z' } } as never} />).container,
  },
  {
    name: 'Model tab goal targets (GoalConstraintsSection)', u0: false, minText: 5,
    mount: () => render(<GoalConstraintsSection constraints={null} nodes={NODES as never} />).container,
  },
  {
    name: 'Model tab v2 (ModelTabV2Panel)', u0: false, minText: 10,
    mount: () => render(<ModelTabV2Panel nodes={NODES as never} edges={EDGES as never} goalThreshold={10} />).container,
  },
  { name: 'goal inspector (GoalPanel)', u0: false, minText: 10, mount: () => render(<GoalPanel nodeId="productivity" {...panel} />).container },
  { name: 'option inspector (OptionPanel)', u0: false, minText: 10, mount: () => render(<OptionPanel nodeId={A} {...panel} />).container },
  { name: 'decision inspector (DecisionPanel)', u0: false, minText: 10, mount: () => render(<DecisionPanel nodeId="decide" {...panel} />).container },
  { name: 'outcome inspector (OutcomePanel)', u0: false, minText: 5, mount: () => render(<OutcomePanel nodeId="delivery" {...panel} />).container },
  { name: 'risk inspector (RiskPanel)', u0: false, minText: 5, mount: () => render(<RiskPanel nodeId="delay_risk" {...panel} />).container },
  {
    name: 'shared brief page (SharedBriefPage)', u0: false, minText: 10,
    mount: async () => {
      sharedSnapshot.mockResolvedValue({
        graph: { nodes: NODES.map(n => ({ id: n.id, kind: n.type, label: (n.data as { label: string }).label })), edges: EDGES.map(e => ({ from: e.source, to: e.target })) },
        analysis: { version: '1', graph_hash: GRAPH_HASH, lineage: { run_id: RUN_ID },
          headline: `‘${label(A)}’ produced the best outcome in ${Math.round(RAW.snapshot_headline_share * 100)}% of runs of this model.`,
          analysis_summary: { leading_option: label(A), robustness_band: 'moderate', win_probability: win(A) },
          options: [A, B].map((id, i) => ({ rank: i + 1, label: label(id), option_id: id, win_probability: win(id) })),
          robustness: 'moderate', top_drivers: [], what_would_change: [], key_assumptions: [], warnings: [], warning_codes: [] },
        brief_text: 'How should we lift productivity?', graph_hash: GRAPH_HASH, seed: null, created_at: '2026-10-12T02:00:00Z', expires_at: null,
      })
      const view = render(<MemoryRouter initialEntries={['/brief/sentinel']}><Routes>
        <Route path="/brief/:slug" element={<SharedBriefPage />} /></Routes></MemoryRouter>)
      await screen.findAllByText('How should we lift productivity?')
      return view.container
    },
  },
]

/** Builders whose output reaches a person or the AI. Each returns what it says. */
const FUNCTIONS: ReadonlyArray<readonly [string, () => string]> = [
  ['ask-AI questions (buildAskAiQuestion: explain the goal and an option, with options)', () =>
    [buildAskAiQuestion({ intent: 'explain', nodeIds: ['productivity'], includeOptions: true } as never).question,
      buildAskAiQuestion({ intent: 'explain', nodeIds: [A], includeOptions: true } as never).question].join(' | ')],
  ['analysis snapshot record (buildSnapshotFromV5Analysis → buildAnalysisSnapshot)', () => {
    const snapshot = buildSnapshotFromV5Analysis({ enrichment: (sentinelBlock() as { enrichment: unknown }).enrichment, responseHash: RUN_ID,
      nodes: NODES as never, edges: EDGES as never, runNumber: 2, events: [], previousSnapshotTimestamp: null } as never)
    expect(snapshot, 'the sentinel enrichment must make a snapshot (else this row is vacuous)').not.toBeNull()
    return JSON.stringify(snapshot)
  }],
  ['journey timeline summary (renderTimelineSummary)', () => renderTimelineSummary([{ id: 'e1', event_type: 'analysis_run', source: 'ai',
    created_at: '2026-10-12T02:00:00Z', details: { winner: label(A), probability: Math.round(win(A) * 100), robustness: 'moderate' } }] as never)],
]

/** The hiring target is a CHANGE (10% higher than today); "at least 10%" with no reference to today reads as a level. */
const LEVEL_MISREADING = /\bat least 10%(?! higher than today| from today)/
const levelHits = (said: string): string[] => {
  const m = LEVEL_MISREADING.exec(said)
  return m === null ? [] : [said.slice(Math.max(0, m.index - 60), m.index + 30)]
}

beforeEach(() => {
  setDeployedFlags()
  vi.mocked(canvasLinkOfTarget).mockImplementation((target) => (target ? { target, focus: vi.fn(), highlight: vi.fn() } : null) as never)
  vi.mocked(useCanvasLight).mockReturnValue({ on: vi.fn(), off: vi.fn() } as never)
})
afterEach(() => {
  cleanup()
  resetSentinel()
  useComparisonStore.getState().resetComparison()
  localStorage.clear()
})

describe('CONTROLS: the sentinel Run is what the census says it is', () => {
  it('every sentinel is unique, and each of its renderings is caught', () => {
    const pcts = SENTINELS.map(s => s.pct)
    expect(new Set(pcts).size, `sentinel percents collide: ${pcts.join(',')}`).toBe(pcts.length)
    for (const s of SENTINELS) {
      expect(sentinelHits(`it is ${s.pct}% likely`), `${s.field} whole percent`).not.toEqual([])
      expect(sentinelHits(`${s.pct} in 100 runs`), `${s.field} "in 100"`).not.toEqual([])
      if (s.fraction !== null) {
        expect(sentinelHits(`p = ${s.fraction.toFixed(2)}`), `${s.field} fraction`).not.toEqual([])
        expect(sentinelHits(JSON.stringify({ p: s.fraction })), `${s.field} raw value in a record`).not.toEqual([])
      }
      expect(sentinelPatterns(s).length).toBeGreaterThanOrEqual(2)
    }
    // No served figure is a sentinel rendering, and the level reading is caught.
    expect(sentinelHits(SERVED_FIGURES.join(' '))).toEqual([])
    expect(levelHits('Goal: at least 10%')).not.toEqual([])
    expect(levelHits('at least 10% higher than today')).toEqual([])
  })

  it('the raw fields reach the store the surfaces read (the mapper carried them)', () => {
    seedSentinel('licensed')
    const json = JSON.stringify(useCanvasStore.getState().results?.report)
    for (const v of [RAW.win_probability[A], RAW.probability_of_goal[A], RAW.probability_of_joint_goal[A],
      RAW.root_probability_of_goal, RAW.constraint_probability, RAW.conditional_probability, RAW.marginal_probability]) {
      expect(json, String(v)).toContain(String(v))
    }
    expect(json).toContain(`"pct_by_option":{"${A}":71`)
    expect(json).toContain(`"low_pct":${RAW.range_low_pct}`)
    expect(json).toContain(`"pct_if_side":${RAW.driver_pct_if_side}`)
    expect(json).toContain(`"one_in":${ONE_IN}`)
    expect(sentinelHits('a 1-in-7 chance each')).not.toEqual([])
    expect(json, 'the conditional-scenario rows reach the report').toContain(String(RAW.conditional_win.high))
    expect(json, 'the fragile link\'s switch probability reaches the report').toContain(String(RAW.switch_probability))
    // The per-limit fields reach the Run the surfaces read (the block's entry), so a surface reading them would show one.
    const block = JSON.stringify(sentinelBlock())
    for (const v of [RAW.prob_satisfied, RAW.constraint_probability_by_option, RAW.joint_probability]) expect(block, String(v)).toContain(String(v))
    expect(JSON.stringify(useCanvasStore.getState().runDelta)).toContain(`"pct":${RAW.run_delta_prior}`)
  })

  it('the scanner reads an element boundary as a separator (a figure split from the text before it is still caught)', () => {
    const { container } = render(<div>Sensitive assumptions: 0.<span>{Math.round(RAW.switch_probability * 100)}%</span></div>)
    const { text, spaced } = readSurface(container)
    expect(sentinelHits(text), 'the run of text glues "0." to the figure').toEqual([])
    expect(sentinelHits(spaced).join(' ')).toContain('switch_probability=86')
  })

  it('the deployed flags are set from the staging flag file (derived, not listed)', () => {
    expect(FLAG_STORAGE.size).toBeGreaterThan(30)
    expect(setDeployedFlags()).toBeGreaterThanOrEqual(20)
    expect(localStorage.getItem('feature.compareTab')).toBe('1')
    expect(localStorage.getItem('feature.decisionOverview')).toBe('1')
  })
})

const FORM_TITLE: Readonly<Record<Form, string>> = { withheld: '(a) canonical cells WITHHELD', licensed: '(b) canonical cells LICENSED',
  same_bounds: '(c) LICENSED, the range\'s served bounds = its raw bounds (finding 2)',
  agreeing_low: '(d) LICENSED, the licence and the cell agree on a figure under 10% (value-dependent branches)',
  no_words: '(e) LICENSED, CEE serves no chance words (the UI\'s target words are the only words)' }
const LOW_FIGURES = Object.values(LOW_DISPLAY).map(d => d.replace('about ', ''))
/** A served figure, matched whole ("6%" is not inside "86%"). */
const figureAt = (said: string, f: string): number => new RegExp(`(?<![\\d.])${f.replace('.', '\\.')}`).exec(said)?.index ?? -1
for (const form of ['withheld', 'licensed', 'same_bounds', 'agreeing_low', 'no_words'] as const) {
  describe(`${FORM_TITLE[form]}: what every mounted surface says`, () => {
    for (const surface of SURFACES) {
      it(`${surface.name}${surface.u0 ? ' [U0]' : ''}`, async () => {
        const hash = seedSentinel(form)
        const root = await surface.mount(hash)
        openEveryDisclosure(root)
        const { text, spaced, aria } = readSurface(root)
        // Negative checks read the run of text, the element-separated text and the aria (`readSurface`).
        const said = `${text} || ${spaced} || ${aria}`
        expect(text.length, 'the surface rendered nothing: the census would be vacuous').toBeGreaterThan(surface.minText ?? 40)
        // SAME_BOUNDS: on a journey-path surface the range bounds are CEE's served words (FACE_B_SAME), not a raw read.
        const raw = sentinelHits(said, form === 'same_bounds' && surface.u0 ? ['range_low_pct', 'range_high_pct'] : [])
        expect.soft(raw, `a raw probability-like field reached the screen: ${raw.join(' ; ')}`).toEqual([])
        const level = levelHits(said)
        expect.soft(level, `the CHANGE target said as a level: ${level.join(' ; ')}`).toEqual([])
        const servedFigures = form === 'same_bounds' ? [...SERVED_FIGURES.filter(f => f !== '18%' && f !== '26%'), '23%', '29%']
          : form === 'agreeing_low' ? [...SERVED_FIGURES.filter(f => !['64%', '18%', '26%'].includes(f)), ...LOW_FIGURES] : SERVED_FIGURES
        if (!surface.u0 || form === 'withheld') {
          const served = servedFigures.filter(f => figureAt(said, f) >= 0).map(f => said.slice(Math.max(0, figureAt(said, f) - 60), figureAt(said, f) + 10))
          expect.soft(served, `${surface.u0 ? 'a figure with every cell withheld' : 'a chance figure off the journey path (U0)'}: ${served.join(' ; ')}`).toEqual([])
        }
        if (surface.u0 || form !== 'withheld') {
          const generic = GENERIC_CHANCE_PHRASES.map(re => re.exec(said)).filter((m): m is RegExpExecArray => m !== null)
            .map(m => said.slice(Math.max(0, m.index - 50), m.index + 40))
          expect.soft(generic, `a UI-composed chance phrase: ${generic.join(' ; ')}`).toEqual([])
          const labels = UI_CHANCE_LABELS.map(re => re.exec(said)).filter((m): m is RegExpExecArray => m !== null)
            .map(m => said.slice(Math.max(0, m.index - 40), m.index + 40))
          expect.soft(labels, `a UI-composed label beside a chance (only CEE's served words may label it): ${labels.join(' ; ')}`).toEqual([])
        }
        for (const words of surface.says?.[form] ?? []) expect.soft(text, 'CEE\'s served words, verbatim').toContain(words)
        for (const id of surface.reaches?.[form] ?? []) expect.soft(root.querySelector(`[data-testid="${id}"]`), `the form's branch is drawn: ${id}`).not.toBeNull()
        for (const [id, words] of surface.saysWithin?.[form] ?? []) {
          expect.soft(root.querySelector(`[data-testid="${id}"]`)?.textContent ?? '', `${id} says CEE's served words itself`).toContain(words)
        }
        if (surface.u0 && form === 'licensed') expect.soft(text).toContain(DISPLAY_A.replace('about ', ''))
        // A figure the gate passed is said in CEE's words: "about 6%" appears only inside CEE's served face, never in a
        // chance sentence the UI worded itself (the low-chance badge's "About 6% chance of …", without "in this model" or
        // the provisional clause).
        if (surface.u0 && form === 'agreeing_low') {
          for (const id of [A, B, SQ] as const) {
            const rest = text.split(LOW_FACE[id]).join(' ‖ ')
            const worded = [...rest.matchAll(new RegExp(LOW_DISPLAY[id], 'gi'))].map(m => rest.slice(Math.max(0, m.index - 30), m.index + 90))
            expect.soft(worded, `a chance figure worded by the UI, outside CEE's face: ${worded.join(' ; ')}`).toEqual([])
          }
        }
      })
    }
    for (const [name, say] of FUNCTIONS) {
      it(`${name} (reaches a person or the AI)`, () => {
        seedSentinel(form)
        const said = say()
        expect(said.length).toBeGreaterThan(10)
        const raw = sentinelHits(said)
        expect(raw, `a raw probability-like field: ${raw.join(' ; ')}`).toEqual([])
        expect([...SERVED_FIGURES, ...LOW_FIGURES].filter(f => figureAt(said, f) >= 0)).toEqual([])
        expect(levelHits(said)).toEqual([])
      })
    }
  })
}
