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
 *
 * ⭐ ROUND 2 (Codex r1 FAIL on 369c17d0; DL A–D, 12 Oct): the census's inputs are DERIVED and its reading is exhaustive.
 *  - Every surface is read in every state a person reaches without typing: each disclosure opened AND each tab selected in
 *    turn (`exploreSurface`); Detailed view, technical detail and expert mode are rows of their own.
 *  - A: the chance-like payload fields come from the schema types, their docs and what production reads
 *    (`payloadChanceFields`); each is seeded with a sentinel or excluded with a stated reason (FIELD_DISPOSITION).
 *  - B: the surfaces come from the production import closure (`chanceReaderComponents`): each must RENDER in a row (read off
 *    React's fiber tree) or be excluded with a checked reason; every copy / print / download / share path is censused or
 *    excluded (`textBuilderFiles`, BUILDER_DISPOSITION).
 *  - C: on a journey surface a chance becomes text only as CEE's served string, verbatim: with CEE's strings removed, no
 *    served figure and no rounding of a raw field is left; form (f) holds CEE's boundary displays ("less than 1%", "more than
 *    99%") over 0.0031 / 0.9973, counted against form (d) as baseline.
 *  - D: form (f)'s licence target carries no frame; no reader may say it as a level.
 */
import '@testing-library/jest-dom/vitest'
import type { ComponentProps } from 'react'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Position, ReactFlowProvider } from '@xyflow/react'

vi.mock('@xyflow/react', async importOriginal => ({ ...await importOriginal<typeof import('@xyflow/react')>(), Handle: () => null,
  // The canvas edge's label row (its fragility cue) renders inline: outside a full <ReactFlow> there is no label layer.
  EdgeLabelRenderer: ({ children }: { children?: unknown }) => children }))
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
import { OptionChanceCellProvider, faceWithoutOwnLabel } from '../../nodes/shared/OptionChanceCellProvider'
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
import { renderTimelineSummary } from '../../journey/renderTimelineSummary'
import { EdgePanel } from '../../ui/inspector-v2/panels/EdgePanel'
import { StyledEdge } from '../../edges/StyledEdge'
import { ModelTabBody } from '../../components/ModelTabBody'
import { mapRobustness } from '../../../lib/mappers/mapRobustness'
import { buildDecisionBrief, decisionBriefToText } from '../../decisionBrief/buildDecisionBrief'
import { decisionBriefToHtml } from '../../decisionBrief/decisionBriefHtml'
import { DecisionBriefView } from '../../decisionBrief/DecisionBriefView'
import { DEFAULT_EDGE_DATA } from '../../domain/edges'
import { AnalysisStateV1Schema } from '@talchain/schemas/boundary'
import { useCanvasStore } from '../../store'
import { useCanonicalAnalysisViewStore } from '../../stores/canonicalAnalysisViewStore'
import { useDisplayedRunDeltaView } from '../../../components/results/analysisNew/displayedRunDeltaView'
import { pairChanceFigures, runViewOf } from '../runView'
import {
  A, B, DISPLAY_A, EDGES, FACE_A, FACE_B, LOW_FACE, SPREAD_NOTE, SHORTFALL_A, FACE_B_SAME, GENERIC_CHANCE_PHRASES, UI_CHANCE_LABELS, type SentinelForm, GRAPH_HASH, LABEL, NODES, RAW, RUN_ID, SENTINELS, SERVED_FIGURES, SQ,
  ONE_IN, SQ_LINE, WHY_A, WHY_B, resetSentinel, seedSentinel, seededForm, sentinelBlock, sentinelHits, sentinelPatterns, sentinelRunDelta,
  BOUNDARY_DISPLAY, BOUNDARY_FACE, BOUNDARY_VARIANTS, sentinelCanonical, sentinelFlipAnalysisBlock, sentinelReport,
  DISPLAY_B_SAME, LOW_DISPLAY, seedServedRangeState, WITHHELD_FACE, SQ_FACE,
} from './helpers/chanceSentinels'
import { ARIA_ATTRS, exploreSurface, openEveryDisclosure, readSurface, renderedComponentNames, withoutServed } from './helpers/sentinelScan'
import { readGoalChanceLicence } from '../../../components/results/utils/goalChanceLicence'
import { chanceReaderComponents, componentNamesOf, payloadChanceFields, productionModules, sourceFiles, textBuilderFiles } from './helpers/censusDerivation'

type Form = SentinelForm
/** Every component name React rendered in any census row (round 2, B): read by the surface derivation at the end. */
const RENDERED = new Set<string>()
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
  /**
   * The words the surface's own chance gate PASSED for the seeded Run, read from the gate itself (never from the screen):
   * only these strings are lifted out before the raw-figure scan. A figure the surface prints outside the gate stays in.
   */
  readonly gated?: (hash: string) => readonly string[]
  /** Forms in which the surface must draw the ruled goal-chance claim on CEE's identities (a positive control). */
  readonly claimsIn?: readonly Form[]
}

/**
 * Compare's gate (DL, 21 Oct 2026): the run pair's figures exactly as `pairChanceFigures` passes them for the view the
 * body displays (`useDisplayedRunDeltaView`), called here directly, so a figure the chart or its hook draws around the
 * gate is not whitelisted by it.
 */
function compareGateWords(hash: string): string[] {
  const { result, unmount } = renderHook(() => useDisplayedRunDeltaView(hash, 'all'))
  const view = result.current
  unmount()
  if (view === null) return []
  const state = useCanvasStore.getState()
  const report = state.results?.hash === hash ? state.results.report : null
  const held = useCanonicalAnalysisViewStore.getState()
  const canonical = held.scenarioId === state.currentScenarioId ? held.view : null
  const figures = pairChanceFigures(view, runViewOf(report, canonical))
  // Figure words only: a row's note and the caption are CEE's own words and are read like any other text.
  return figures.rows.flatMap(row => [row.earlier?.words, row.now?.words])
    .filter((w): w is string => typeof w === 'string' && w.length > 0)
}

/**
 * DL ruling, 21 Oct 2026: the ruled goal-chance claim sentence ("In this model, X is the most likely to meet your goal") is a
 * UI phrase allowed ONLY on CEE's identities: the element says which claim it words (`data-goal-chance-claim`) and for whom
 * (`data-option-id`), and both must equal the served licence's highest form and `leader_option_id`. Exempt from the
 * UI-phrase check only; every figure in it is still read by the raw-figure scan.
 */
function rulingClaimElements(root: Element, hash: string): Element[] {
  const state = useCanvasStore.getState()
  const report = state.results?.hash === hash ? state.results.report : null
  const held = useCanonicalAnalysisViewStore.getState()
  const licence = runViewOf(report, held.scenarioId === state.currentScenarioId ? held.view : null).goalChance
  const claims = licence === null || (licence.form !== 'highest' && licence.form !== 'highest_all_likely_to_miss') ? []
    : [...root.querySelectorAll('[data-goal-chance-claim]')]
      .filter(el => el.getAttribute('data-goal-chance-claim') === licence.form && el.getAttribute('data-option-id') === licence.leaderOptionId)
  return [...claims, ...attributionElements(root)]
}
/**
 * DL lease, 21 Oct 2026: Compare's "which change moved which chance" line names a chance in the UI's words, so it too is
 * allowed only on CEE's identities: the SERVED pair is `C1_attributable` with a `complete` input record, and the element
 * says exactly that (`data-attribution-case`, `data-input-coverage`). Same terms as the claim: UI-phrase check only, by node.
 */
function attributionElements(root: Element): Element[] {
  const delta = useCanvasStore.getState().runDelta?.delta
  if (delta?.attribution_case !== 'C1_attributable' || delta.input_coverage !== 'complete') return []
  return [...root.querySelectorAll('[data-attribution-case]')]
    .filter(el => el.getAttribute('data-attribution-case') === 'C1_attributable' && el.getAttribute('data-input-coverage') === 'complete')
}
/**
 * The surface's text and accessible attributes with ONLY the ruled claim's own words left out, by node (Codex r2): a text
 * node is left out when its NEAREST claim element is one of `claims` (a claim nested inside it is still read); an attribute
 * is left out only on such an element and only where it repeats that element's own text exactly (a `title` mirroring a
 * truncated line). Both the glued and the spaced readings are returned, so a phrase split across elements is still seen.
 */
function textOutside(root: Element, claims: readonly Element[]): string {
  const ownClaim = (el: Element | null): boolean => {
    const nearest = el?.closest('[data-goal-chance-claim], [data-attribution-case]') ?? null
    return nearest !== null && claims.includes(nearest)
  }
  const kept: string[] = []
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) if (n.textContent && !ownClaim(n.parentElement)) kept.push(n.textContent)
  const attrs: string[] = []
  for (const el of [root, ...root.querySelectorAll('*')]) {
    const own = claims.includes(el) ? (el.textContent ?? '').replace(/\s+/g, ' ').trim() : null
    for (const attr of ARIA_ATTRS) {
      const v = el.getAttribute(attr)
      if (v && !(own !== null && v.replace(/\s+/g, ' ').trim() === own)) attrs.push(v)
    }
  }
  return [kept.join(''), kept.join(' '), attrs.join(' | ')].join(' ‖ ').replace(/\s+/g, ' ')
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
/** The inspector with the person's "Show technical detail" toggle on (InspectorShell's tech toggle). */
const techPanel = { ...panel, techMode: true }
/** The canvas in Detailed view (the person's view toggle, `viewMode: 'expert'`): each card draws its details inline. */
const detailed = () => act(() => { useCanvasStore.setState({ viewMode: 'expert' } as never) })
/** `leading`: the Run's named leader. A null leader hides the share row on its own, so a leader-named card is censused too. */
const chatBlock = (leading: string | null = null) => {
  const b = sentinelBlock(seededForm()) as { enrichment: unknown; win_probabilities: unknown }
  return { type: 'v5_analysis_result', summary: 'The analysis completed.', leading_option_id: leading, win_probabilities: b.win_probabilities,
    enrichment: b.enrichment, computed_against_hash: GRAPH_HASH, run_id: RUN_ID } as unknown as V5AnalysisResultBlockType
}
const win = (id: string) => RAW.win_probability[id as keyof typeof RAW.win_probability]
const label = (id: string) => LABEL[id as keyof typeof LABEL]
/** The Results tab's sensitivity rows (outcome values, not chances), so the drivers lens draws its chart. */
const TORNADO = { rows: [{ factorKey: 'ramp_up', label: 'Ramp-up time', lowOutcome: 109, highOutcome: 116, canFocus: true, matchedNodeId: 'ramp_up',
  direction: 'negative' as const }], expectedOutcome: 112 }
/** The saved read CEE answers for the seeded scenario (graph, analysis verdict, canonical view, Run block): the brief's input. */
const savedRead = () => ({
  graph: { goal_node_id: 'productivity', nodes: NODES.map(n => ({ ...(n.data as Record<string, unknown>), id: n.id, kind: n.type })),
    edges: EDGES.map(e => ({ from: e.source, to: e.target })) },
  graphHash: GRAPH_HASH, analysisState: AnalysisStateV1Schema.parse(useCanvasStore.getState().analysisStateV1),
  canonicalAnalysisView: sentinelCanonical(seededForm()), analysisResult: sentinelBlock(seededForm()),
})
/** The same words in every form (typed per form, so a new form fails to compile here rather than going unchecked). */
const sayInEveryForm = (words: readonly string[]): Record<Form, readonly string[]> =>
  ({ withheld: words, licensed: words, same_bounds: words, agreeing_low: words, no_words: words, boundary: words })
/** The fragile link the edge rows mount (its id is the producer's fragile_edges key). */
const FRAGILE_EDGE_PROPS = {
  id: 'ramp_up->productivity', source: 'ramp_up', target: 'productivity', sourceX: 0, sourceY: 0, targetX: 100, targetY: 100,
  sourcePosition: Position.Right, targetPosition: Position.Left, selected: false, data: { ...DEFAULT_EDGE_DATA },
} as unknown as ComponentProps<typeof StyledEdge>
const FACES_OF: Readonly<Record<Form, readonly string[]>> = {
  withheld: [WHY_A, WHY_B, SQ_LINE], licensed: [FACE_A, FACE_B, SQ_LINE], same_bounds: [FACE_A, FACE_B_SAME, SQ_LINE],
  agreeing_low: [LOW_FACE[A], LOW_FACE[B], LOW_FACE[SQ]], no_words: [FACE_A, FACE_B, SQ_LINE],
  boundary: [BOUNDARY_FACE[A], BOUNDARY_FACE[B], BOUNDARY_FACE[SQ]],
}

/** What a canvas option card says per form: CEE's served cell face for each option (a withheld cell's own face). */
const CARD_FACES_OF: Readonly<Record<Form, readonly string[]>> = {
  withheld: [WITHHELD_FACE, SQ_FACE], licensed: [FACE_A, FACE_B, SQ_FACE], same_bounds: [FACE_A, FACE_B_SAME, SQ_FACE],
  agreeing_low: [LOW_FACE[A], LOW_FACE[B], LOW_FACE[SQ]], no_words: [FACE_A, FACE_B, SQ_FACE],
  boundary: [BOUNDARY_FACE[A], BOUNDARY_FACE[B], BOUNDARY_FACE[SQ]],
}

/** #2931 (DL 22 Oct): the canvas card is already named, so it says each served face without the face's own ‘label’: prefix. */
const CANVAS_CARD_LINES_OF = Object.fromEntries(Object.entries(CARD_FACES_OF)
  .map(([form, faces]) => [form, faces.map(faceWithoutOwnLabel)])) as unknown as Readonly<Record<Form, readonly string[]>>

/**
 * Round 2 (DL, restoring what staging said): on the chat card, CEE's own notes on A's chance follow A's served face in A's
 * own line — its spread sentence, then its shortfall sentence naming A — verbatim (bound by contiguity to A's face).
 */
const notesAfter = (face: string) => [['v5-analysis-result-goal-chances', `${face} ${SPREAD_NOTE} ${SHORTFALL_A}`]] as const
const CEE_NOTES_AFTER_A: Partial<Readonly<Record<Form, ReadonlyArray<readonly [string, string]>>>> = {
  licensed: notesAfter(FACE_A), same_bounds: notesAfter(FACE_A), no_words: notesAfter(FACE_A), agreeing_low: notesAfter(LOW_FACE[A]),
}

const SURFACES: readonly Surface[] = [
  {
    name: 'Analysis tab (ResultsBody: hero, option cards, range lines, goal block)', u0: true,
    mount: () => render(<ResultsBody resultsSectionData={sectionData()} tornadoData={TORNADO}
      onSendMessage={() => {}} expertMode={false} />).container,
    says: FACES_OF,
    // Every option's figure passes the gate, so each Results card draws its goal row (and, before C, a low-chance badge).
    reaches: { agreeing_low: [`goal-readout-${A}`, `goal-readout-${B}`], boundary: [`goal-readout-${A}`, `goal-readout-${B}`] },
    // Each card's goal row is captioned by CEE's own face for that option (DL 12 Oct), on the card itself; its readout is CEE's
    // display string itself (round 2, rule C: "more than 99%", never "100%").
    saysWithin: { agreeing_low: [[`option-card-${A}`, LOW_FACE[A]], [`option-card-${B}`, LOW_FACE[B]]],
      boundary: [[`goal-readout-${A}`, BOUNDARY_DISPLAY[A]], [`goal-readout-${B}`, BOUNDARY_DISPLAY[B]],
        [`option-card-${B}`, BOUNDARY_FACE[B]]] },
    // Round 2 (DL): a card's served RANGE row is pinned by its own row below ("SERVED VERBATIM"), in the one state that draws it.
  },
  {
    // Expert mode is the person's own toggle: each card adds its range bar (OptionRangeBar) and its expert detail.
    name: 'Analysis tab, expert mode (ResultsBody expertMode)', u0: true,
    mount: () => render(<ResultsBody resultsSectionData={sectionData()} tornadoData={TORNADO}
      onSendMessage={() => {}} expertMode />).container,
    says: FACES_OF,
    reaches: { boundary: [`goal-readout-${A}`, `goal-readout-${B}`] },
  },
  {
    // The decision matrix (reasoning artefact A1, reinstated 14 Oct on the DL's order) says each option's served cell, so this
    // tab is on the journey path: CEE's faces verbatim are its positive control, and rule C reads everything else.
    name: 'Reasoning tab (AnalysisNewTabBody: decision matrix, options comparison, glance, commitment, model strip)', u0: true,
    mount: hash => render(<AnalysisNewTabBody resultsSectionData={sectionData()} isPreRun={false} isRunning={false} isStale={false}
      responseHash={hash} />).container,
    says: CARD_FACES_OF,
  },
  {
    name: 'chat analysis card (V5AnalysisResultBlock)', u0: true,
    mount: () => render(<V5AnalysisResultBlock block={chatBlock()} />).container,
    says: FACES_OF,
    saysWithin: CEE_NOTES_AFTER_A,
  },
  {
    name: 'chat analysis card, the Run names a leader (V5AnalysisResultBlock)', u0: true,
    mount: () => render(<V5AnalysisResultBlock block={chatBlock(A)} />).container,
    says: FACES_OF,
    saysWithin: CEE_NOTES_AFTER_A,
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
    // Post-C UI item 1 (DL, 12 Oct): each card says CEE's served cell for its option, verbatim (`servedCellOf`), and nothing
    // of its own; so the row reads as a served-cell surface, with CEE's faces as the positive control.
    name: 'canvas option cards (OptionNode ×3)', u0: true, minText: 10,
    mount: () => render(<ReactFlowProvider><OptionChanceCellProvider>
      {[A, B, SQ].map(id => <OptionNode key={id} {...nodeProps<ComponentProps<typeof OptionNode>>(id, 'option')} />)}
    </OptionChanceCellProvider></ReactFlowProvider>).container,
    says: CANVAS_CARD_LINES_OF,
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
    gated: compareGateWords,
    claimsIn: ['boundary'],
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
    name: 'canvas What would change lens panel (LensInfoPanel, lens = what_changes)', u0: false, minText: 10,
    mount: () => {
      useCanvasStore.setState({ lens: { ...useCanvasStore.getState().lens, active: 'what_changes' } } as never)
      render(<LensInfoPanel />)
      expect(screen.getByTestId('lens-info-robustness'), 'the What would change view mounted (else this row is vacuous)').toBeInTheDocument()
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
  {
    // Round 2 (DL's condition on D): the canvas target formatter (`formatGoalTarget` / `formatGoalChangeBound`, exempt from D
    // because its callers pass the goal's own target, never a Run field) is live here, positively: the inspector says the
    // target in its own frame in every form, while every chance check on this row stays empty.
    name: 'goal inspector (GoalPanel)', u0: false, minText: 10, mount: () => render(<GoalPanel nodeId="productivity" {...panel} />).container,
    says: sayInEveryForm(['up at least 10% from today']),
  },
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
  {
    // Round 2 (B): Detailed view draws each card's second layer inline (the goal card's "Decision stability N%", which the
    // Standard view's retired popover never shows); the person switches to it with the canvas view toggle.
    // Post-C UI item 1: the option cards say CEE's served cells here too; the goal, decision and outcome cards still say no
    // chance (each comes back one surface at a time, with its own census row).
    name: 'canvas cards, Detailed view (OptionNode ×3, GoalNode, DecisionNode, OutcomeNode)', u0: true, minText: 10,
    says: CANVAS_CARD_LINES_OF,
    mount: () => {
      detailed()
      return render(<ReactFlowProvider><OptionChanceCellProvider>
        {[A, B, SQ].map(id => <OptionNode key={id} {...nodeProps<ComponentProps<typeof OptionNode>>(id, 'option')} />)}
        <GoalNode {...nodeProps<ComponentProps<typeof GoalNode>>('productivity', 'goal')} />
        <DecisionNode {...nodeProps<ComponentProps<typeof DecisionNode>>('decide', 'decision')} />
        <OutcomeNode {...nodeProps<ComponentProps<typeof OutcomeNode>>('delivery', 'outcome')} />
      </OptionChanceCellProvider></ReactFlowProvider>).container
    },
  },
  {
    // Round 2 (B): each inspector with "Show technical detail" on (its technical disclosures drawn).
    name: 'inspectors, technical detail on (Goal, Option, Decision, Outcome, Risk and Edge panels)', u0: false, minText: 10,
    mount: () => render(<>
      <GoalPanel nodeId="productivity" {...techPanel} /><OptionPanel nodeId={A} {...techPanel} /><DecisionPanel nodeId="decide" {...techPanel} />
      <OutcomePanel nodeId="delivery" {...techPanel} /><RiskPanel nodeId="delay_risk" {...techPanel} />
      <EdgePanel edgeId="ramp_up->productivity" {...techPanel} />
    </>).container,
  },
  {
    // Round 2 (B): the canvas edge in Detailed view (every fragile link badges there).
    name: 'canvas edge, a fragile link, Detailed view (StyledEdge)', u0: false, minText: -1,
    mount: () => {
      detailed()
      return render(<ReactFlowProvider><svg><StyledEdge {...FRAGILE_EDGE_PROPS} /></svg></ReactFlowProvider>).container
    },
  },
  {
    // Round 2 (Codex r1 blocking 4): the edge inspector printed the fragile link's switch figure ("86% flip risk").
    name: 'edge inspector, a fragile link (EdgePanel)', u0: false, minText: 10,
    mount: () => render(<EdgePanel edgeId="ramp_up->productivity" {...panel} />).container,
  },
  {
    // Round 2 (B): the canvas edge's fragility cue (its name, title and hover line) carried "(86% flip risk)".
    // The edge draws no text of its own here: its cue speaks through its name and title (aria), and the reach proves it drew.
    name: 'canvas edge, a fragile link (StyledEdge)', u0: false, minText: -1,
    mount: () => render(<ReactFlowProvider><svg><StyledEdge {...FRAGILE_EDGE_PROPS} /></svg></ReactFlowProvider>).container,
    reaches: { withheld: ['edge-fragile-tag'], licensed: ['edge-fragile-tag'], same_bounds: ['edge-fragile-tag'],
      agreeing_low: ['edge-fragile-tag'], no_words: ['edge-fragile-tag'], boundary: ['edge-fragile-tag'] },
  },
  {
    // Round 2 (A): the flip-analysis block carries its current winner's share (`current_winner.probability`).
    name: 'chat flip-analysis block (InlineBlocks "flip_analysis")', u0: false, minText: 10,
    mount: () => render(<InlineBlocks blocks={[sentinelFlipAnalysisBlock() as never]} />).container,
  },
  {
    // Round 2 (B): the dock's Model tab is ModelTabBody (its own health and robustness sections around the v2 panel),
    // mounted with the props OutputsDock passes; expert on, the person's own toggle.
    name: 'canvas dock Model tab (ModelTabBody, as OutputsDock mounts it)', u0: false, minText: 10,
    mount: () => render(<ModelTabBody showDebug={false} hasDiagnostics={false} diagnostics={null} hasTrim={false} effectiveCorrelationId={null}
      correlationMismatch={false} correlationIdHeader={null} nodes={NODES as never} edges={EDGES as never}
      robustness={mapRobustness((sentinelReport(seededForm()) as { robustness?: never }).robustness, { sourcePath: 'top_level' } as never)}
      ceeQuality={null} expertMode onToggleExpert={() => {}} onSendMessage={() => {}} />).container,
  },
  {
    // Round 2 (Codex r1 blocking 3): the decision brief printed each option's chance (17% / 18% / 19%) off the journey path.
    name: 'decision brief panel (DecisionBriefView, from the saved read)', u0: false, minText: 10,
    mount: () => render(<DecisionBriefView brief={buildDecisionBrief(savedRead() as never)} onShowNode={() => {}} />).container,
  },
]

/** Builders whose output reaches a person or the AI. Each returns what it says. */
const FUNCTIONS: ReadonlyArray<readonly [string, () => string]> = [
  ['ask-AI questions (buildAskAiQuestion: explain the goal and an option, with options)', () =>
    [buildAskAiQuestion({ intent: 'explain', nodeIds: ['productivity'], includeOptions: true } as never).question,
      buildAskAiQuestion({ intent: 'explain', nodeIds: [A], includeOptions: true } as never).question].join(' | ')],
  // Round 2: the analysis snapshot record is no longer a row here. It reaches neither a person nor the AI: production reads
  // only its run count and latest timestamp (checked in the derivation block below, "the analysis snapshot record").
  ['journey timeline summary (renderTimelineSummary)', () => renderTimelineSummary([{ id: 'e1', event_type: 'analysis_run', source: 'ai',
    created_at: '2026-10-12T02:00:00Z', details: { winner: label(A), probability: Math.round(win(A) * 100), robustness: 'moderate' } }] as never)],
  // Round 2 (Codex r1 blocking 3): the brief's copied text and its printable page carried the same chances.
  ['decision brief, copied text (decisionBriefToText)', () => decisionBriefToText(buildDecisionBrief(savedRead() as never))],
  ['decision brief, printable page (decisionBriefToHtml)', () => decisionBriefToHtml(buildDecisionBrief(savedRead() as never))],
]

/** The hiring target is a CHANGE (10% higher than today); "at least 10%" with no reference to today reads as a level. */
const LEVEL_MISREADING = /\bat least 10%(?! higher than today| from today| above today)/
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

describe('SERVED VERBATIM (round 2, DL): the restored Results range row says CEE\'s words and nothing else', () => {
  it('a Results card says a served RANGE cell verbatim (display + face), with no bar, beside the figure rows', () => {
    seedServedRangeState()
    const root = render(<ResultsBody resultsSectionData={sectionData()} tornadoData={TORNADO} onSendMessage={() => {}} expertMode={false} />).container
    expect(root.querySelector(`[data-testid="goal-readout-${A}"]`)?.textContent, 'the figure rows draw (the reach)').toBe(LOW_DISPLAY[A])
    expect(root.querySelector(`[data-testid="goal-readout-${B}"]`)?.textContent, 'B says CEE\'s range display itself').toBe(DISPLAY_B_SAME)
    const cardB = root.querySelector(`[data-testid="option-card-${B}"]`)
    expect(cardB?.textContent ?? '', 'B\'s card is captioned by CEE\'s face').toContain(FACE_B_SAME)
    // Nothing on B's card but CEE's words carries a chance figure (no UI rounding of the range, no bar readout).
    const rest = (cardB?.textContent ?? '').split(FACE_B_SAME).join(' ').split(DISPLAY_B_SAME).join(' ')
    expect(rest.match(/\d+(?:\.\d+)?\s?%/g) ?? []).toEqual([])
  })
})

describe('SERVED VERBATIM (last check, blocking 2): the chat card says CEE\'s spread sentence as served, or nothing', () => {
  // CEE's other spread sentence, byte for byte (CEE goal-chance-licence.ts SPREAD_NOTE_WITH_DOWNSIDE). The card has no downside.
  const SPREAD_NOTE_WITH = 'Its typical result falls short of your target: this chance comes from its wider spread, which also widens how far short it could fall (see its downside).'
  const servedAs = (note: string) => JSON.parse(JSON.stringify(chatBlock()).split(JSON.stringify(SPREAD_NOTE)).join(JSON.stringify(note))) as V5AnalysisResultBlockType
  const licenceOf = (block: V5AnalysisResultBlockType) =>
    readGoalChanceLicence(((block as unknown as Rec).enrichment as Rec).inference_warnings as Rec[])
  const chancesOf = (block: V5AnalysisResultBlockType) =>
    render(<V5AnalysisResultBlock block={block} />).container.querySelector('[data-testid="v5-analysis-result-goal-chances"]')?.textContent ?? ''

  it('CEE\'s without-downside sentence is said after A\'s chance, verbatim; the "see its downside" one says nothing, never swapped', () => {
    seedSentinel('licensed')
    // CONTROL: the served without-downside sentence follows A's face, then CEE's shortfall sentence.
    expect(chancesOf(chatBlock())).toContain(`${FACE_A} ${SPREAD_NOTE} ${SHORTFALL_A}`)
    cleanup()
    const withDownside = servedAs(SPREAD_NOTE_WITH)
    // Non-vacuity: the reader carries CEE's "see its downside" sentence for A (so the card, not the reader, is what drops it).
    expect(licenceOf(withDownside)?.spreadNoteByOption).toEqual({ [A]: SPREAD_NOTE_WITH })
    const text = chancesOf(withDownside)
    expect(text, 'A\'s face, then straight to CEE\'s shortfall sentence').toContain(`${FACE_A} ${SHORTFALL_A}`)
    for (const composed of [SPREAD_NOTE_WITH, SPREAD_NOTE, 'see its downside', 'wider spread', 'could fall further short']) {
      expect(text).not.toContain(composed)
    }
  })
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
    expect(levelHits('Productivity at least 10% above today')).toEqual([])
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
  no_words: '(e) LICENSED, CEE serves no chance words (the UI\'s target words are the only words)',
  boundary: '(f) LICENSED at CEE\'s boundary displays ("less than 1%", "more than 99%"), the highest named, no chance words, no target frame (rules C, D)' }
const FORMS = ['withheld', 'licensed', 'same_bounds', 'agreeing_low', 'no_words', 'boundary'] as const
type Rec = Record<string, unknown>
/** Every string CEE served for the Run in this form (its canonical view and its licence): the only text a chance may become. */
function servedStrings(form: Form): string[] {
  const out = new Set<string>()
  const walk = (v: unknown): void => {
    if (typeof v === 'string') { if (v.length >= 3 && /\s|%/.test(v)) out.add(v); return }
    if (Array.isArray(v)) { v.forEach(walk); return }
    if (v !== null && typeof v === 'object') Object.values(v).forEach(walk)
  }
  walk(sentinelCanonical(form))
  const licence = (((sentinelBlock(form) as Rec).enrichment as Rec).inference_warnings as Rec[]).find(w => w.code === 'GOAL_CHANCE_LICENSED')
  walk({ ...licence, message: undefined })
  return [...out]
}
/** The chance figures in CEE's served strings for a form ("64%"; "more than 99%" → "99%"), as a surface could show them. */
function servedFigures(form: Form): string[] {
  const figures = new Set<string>()
  for (const words of servedStrings(form)) for (const m of words.matchAll(/(?<![\d.])\d+(?:\.\d+)?\s*%/g)) figures.add(m[0].replace(/\s+/g, ''))
  // The target's own size ("at least 10% higher than today") is CEE's words for what the chance is OF, not a chance.
  figures.delete('10%')
  return [...figures]
}
/** With every cell withheld, no licensed form's figure may appear either. */
const figuresFor = (form: Form): string[] => (form === 'withheld' ? servedFigures('licensed') : servedFigures(form))
/** A served figure, matched whole ("6%" is not inside "86%"). */
const figureAt = (said: string, f: string): number => new RegExp(`(?<![\\d.])${f.replace('.', '\\.')}`).exec(said)?.index ?? -1
const around = (said: string, i: number): string => said.slice(Math.max(0, i - 60), i + 30)
/** Form (d)'s count of each boundary rounding per surface: the baseline form (f) is held to (round 2, rule C). */
const BOUNDARY_BASELINE = new Map<string, number[]>()
for (const form of FORMS) {
  describe(`${FORM_TITLE[form]}: what every mounted surface says`, () => {
    for (const surface of SURFACES) {
      it(`${surface.name}${surface.u0 ? ' [U0]' : ''}`, async () => {
        const hash = seedSentinel(form)
        const root = await surface.mount(hash)
        openEveryDisclosure(root)
        // The branch a form exists to reach, and words bound to an element, are read in the surface's first state.
        for (const id of surface.reaches?.[form] ?? []) expect.soft(root.querySelector(`[data-testid="${id}"]`), `the form's branch is drawn: ${id}`).not.toBeNull()
        for (const [id, words] of surface.saysWithin?.[form] ?? []) {
          expect.soft(root.querySelector(`[data-testid="${id}"]`)?.textContent ?? '', `${id} says CEE's served words itself`).toContain(words)
        }
        // Then every state a person can reach without typing: each disclosure open, each tab in turn (round 2, B).
        let claimsDrawn = 0
        const phraseTexts: string[] = []
        const { text, spaced, aria } = exploreSurface(root, () => {
          for (const el of [...document.body.children]) for (const n of renderedComponentNames(el)) RENDERED.add(n.replace(/\d+$/, ''))
          const claims = rulingClaimElements(root, hash)
          claimsDrawn += claims.length
          phraseTexts.push(textOutside(root, claims))
        })
        // A gated surface's own gate words are lifted out first (read from its gate, not the screen); all else is read.
        if (surface.claimsIn?.includes(form)) expect.soft(claimsDrawn, 'the ruled claim is drawn on CEE\'s identities').toBeGreaterThan(0)
        const said = withoutServed(`${text} || ${spaced} || ${aria}`, surface.gated?.(hash) ?? [])
        expect(text.length, 'the surface rendered nothing: the census would be vacuous').toBeGreaterThan(surface.minText ?? 40)
        const licensedU0 = surface.u0 && form !== 'withheld'
        const served = servedStrings(form)
        // ⭐ RULE C (round 2): a chance becomes text only as CEE served it. On a journey surface, what is left once CEE's
        // served strings are removed holds no rounding of a raw field and no served figure (nothing re-rounded, re-worded or
        // cut out of a served string). Off the journey path no served string may appear at all, so the whole text is read.
        const unserved = licensedU0 ? withoutServed(`${text} || ${aria}`, served) : said
        const raw = [...new Set([...sentinelHits(unserved),
          ...(licensedU0 ? sentinelHits(withoutServed(spaced, served), form === 'same_bounds' ? ['range_low_pct', 'range_high_pct'] : []) : [])])]
        expect.soft(raw, `a raw probability-like field reached the screen: ${raw.join(' ; ')}`).toEqual([])
        // The boundary roundings ("100%", "0%", "99%"…) are also ordinary figures a surface prints for other things (a factor's
        // influence scale "always shows 100%", a link's belief slider, an outcome of 0), so they are counted against the SAME
        // surface in form (d), where no chance is near a boundary: any occurrence beyond that baseline is a boundary chance.
        const counts = BOUNDARY_VARIANTS.map(re => (unserved.match(new RegExp(re.source, 'g')) ?? []).length)
        if (form === 'agreeing_low') BOUNDARY_BASELINE.set(surface.name, counts)
        if (form === 'boundary') {
          const base = BOUNDARY_BASELINE.get(surface.name)
          expect(base, 'form (d) ran first for this surface (the boundary baseline)').toBeDefined()
          const extra = BOUNDARY_VARIANTS.flatMap((re, i) => counts[i] > (base?.[i] ?? 0)
            ? [`${re.source} ×${counts[i]} (baseline ${base?.[i] ?? 0}) "${around(unserved, re.exec(unserved)?.index ?? 0)}"`] : [])
          expect.soft(extra, `a rounding of a boundary chance that is not CEE's display: ${extra.join(' ; ')}`).toEqual([])
        }
        const level = levelHits(said)
        expect.soft(level, `the CHANGE target said as a level: ${level.join(' ; ')}`).toEqual([])
        const figures = figuresFor(form)
        if (licensedU0) {
          const worded = figures.filter(f => figureAt(unserved, f) >= 0).map(f => around(unserved, figureAt(unserved, f)))
          expect.soft(worded, `a served figure outside CEE's served strings (re-worded or re-rounded by the UI): ${worded.join(' ; ')}`).toEqual([])
        } else {
          const shown = figures.filter(f => figureAt(said, f) >= 0).map(f => around(said, figureAt(said, f)))
          expect.soft(shown, `${surface.u0 ? 'a figure with every cell withheld' : 'a chance figure off the journey path (U0)'}: ${shown.join(' ; ')}`).toEqual([])
        }
        if (surface.u0 || form !== 'withheld') {
          // The ruled claim sentence, where its identities hold, is the only UI chance phrase allowed: those ELEMENTS are left
          // out of this check (by node), and their figures were read by the raw scan above.
          const phrased = withoutServed(phraseTexts.join(' ‖ '), surface.gated?.(hash) ?? [])
          const generic = GENERIC_CHANCE_PHRASES.map(re => re.exec(phrased)).filter((m): m is RegExpExecArray => m !== null).map(m => around(phrased, m.index))
          expect.soft(generic, `a UI-composed chance phrase: ${generic.join(' ; ')}`).toEqual([])
          const labels = UI_CHANCE_LABELS.map(re => re.exec(said)).filter((m): m is RegExpExecArray => m !== null).map(m => around(said, m.index))
          expect.soft(labels, `a UI-composed label beside a chance (only CEE's served words may label it): ${labels.join(' ; ')}`).toEqual([])
        }
        for (const words of surface.says?.[form] ?? []) expect.soft(text, 'CEE\'s served words, verbatim').toContain(words)
        if (surface.u0 && form === 'licensed') expect.soft(text).toContain(DISPLAY_A.replace('about ', ''))
      })
    }
    for (const [name, say] of FUNCTIONS) {
      it(`${name} (reaches a person or the AI)`, () => {
        seedSentinel(form)
        const said = say()
        expect(said.length).toBeGreaterThan(10)
        const raw = sentinelHits(said)
        expect(raw, `a raw probability-like field: ${raw.join(' ; ')}`).toEqual([])
        expect(figuresFor(form).filter(f => figureAt(said, f) >= 0)).toEqual([])
        if (form === 'boundary') expect(BOUNDARY_VARIANTS.filter(re => re.test(said)).map(String)).toEqual([])
        expect(levelHits(said)).toEqual([])
      })
    }
  })
}

/**
 * ⭐⭐ ROUND 2 — THE DERIVATIONS ARE THE PROOF (DL A and B, 12 Oct). The census's inputs are derived from the code at test
 * time (`helpers/censusDerivation.ts`), and each derived item must be ACCOUNTED FOR here: seeded and checked, or excluded
 * with a stated reason. A new chance-like payload field, a new component that reads one, or a new copy / print / download /
 * share path turns this RED until it is censused or its exclusion is written down.
 */
type FieldDisposition = { readonly seeded: readonly number[] } | { readonly excluded: string }
const NOT_A_NUMBER = 'not a number on the wire (an id, a label, a flag or a source name): no figure to render'
const DEBUG_ONLY = 'read only by the developer diagnostics panel, which mounts only with the ?diag opt-in (`debugPanelVisibility.ts`) and shows raw payloads by design'
const OUTCOME_QUANTITY = 'an outcome quantity in the outcome\'s own unit (its doc matched "percentile"), not a chance'
const FIELD_DISPOSITION: Readonly<Record<string, FieldDisposition>> = {
  probability_of_goal: { seeded: [RAW.probability_of_goal[A]] },
  probability_of_joint_goal: { seeded: [RAW.probability_of_joint_goal[A]] },
  win_probability: { seeded: [RAW.win_probability[A]] },
  win_probabilities: { seeded: [RAW.win_probability[B]] },
  option_probabilities: { seeded: [RAW.probability_of_goal[B]] },
  pct_by_option: { seeded: [RAW.pct_by_option[A]] },
  pct_if_side: { seeded: [RAW.driver_pct_if_side] },
  low_pct: { seeded: [RAW.range_low_pct] },
  high_pct: { seeded: [RAW.range_high_pct] },
  pct: { seeded: [RAW.run_delta_prior] },
  goal_chances: { seeded: [RAW.run_delta_current] },
  prob_satisfied: { seeded: [RAW.prob_satisfied] },
  constraint_probabilities: { seeded: [RAW.constraint_probability_by_option] },
  conditional_probabilities: { seeded: [RAW.conditional_probability, RAW.marginal_probability] },
  conditional_winners: { seeded: [RAW.conditional_win.high, RAW.conditional_win.low] },
  probability: { seeded: [RAW.constraint_probability] },
  switch_probability: { seeded: [RAW.switch_probability] },
  marginal_switch_probability: { seeded: [RAW.marginal_switch_probability] },
  evpi_percentage_points: { seeded: [RAW.evpi_percentage_points] },
  recommendation_stability: { seeded: [RAW.recommendation_stability] },
  p_win_sensitivity: { seeded: [RAW.p_win_sensitivity] },
  current_winner: { seeded: [RAW.current_winner_probability] },
  gap: { seeded: [RAW.near_tie_gap] },
  goal_probability: { excluded: 'the PLoT v1/v2 direct adapters\' name for probability_of_goal; the deployed Run arrives as CEE\'s V5 block (mapV5AnalysisToReport), which carries probability_of_goal, seeded above' },
  exists_probability: { excluded: 'a model INPUT: the belief that a link exists, authored by the person or by Olumi and shown with its source; not a Run result' },
  probability_threshold: { excluded: 'a configured threshold of the structural-challenge check (an input), not a result' },
  threshold: { excluded: 'an input: the person\'s target or limit, or a configured near-tie / flip threshold; not a result' },
  goal_threshold: { excluded: 'the person\'s own target (an input), not a chance' },
  probes_used: { excluded: 'a count of the flip search\'s probes, not a share' },
  mean_outcome: { excluded: OUTCOME_QUANTITY }, downside: { excluded: OUTCOME_QUANTITY }, p05: { excluded: OUTCOME_QUANTITY },
  p10: { excluded: OUTCOME_QUANTITY }, p50: { excluded: OUTCOME_QUANTITY }, p90: { excluded: OUTCOME_QUANTITY },
  winner_pct: { excluded: DEBUG_ONLY }, defaulted_percentage: { excluded: DEBUG_ONLY }, confidence_unique_values: { excluded: DEBUG_ONLY },
  never_truncate_key_max_length: { excluded: DEBUG_ONLY }, rank_displayed: { excluded: DEBUG_ONLY }, win_probability_displayed: { excluded: DEBUG_ONLY },
  chance_words: { excluded: 'CEE\'s served words (rule C: the only text a chance becomes); not a number' },
  goal_chance_leader: { excluded: 'an option id (whom CEE\'s goal-chance licence names highest), not a number; the ruled claim it permits is censused by identity (rulingClaimElements)' },
  goal_chance: { excluded: 'CEE\'s served goal-chance detail (its words and displays, which are CEE\'s served strings above); not a number' },
  alt_winner_label: { excluded: NOT_A_NUMBER }, alternative_winner: { excluded: NOT_A_NUMBER }, alternative_winner_id: { excluded: NOT_A_NUMBER },
  alternative_winner_label: { excluded: NOT_A_NUMBER }, percentiles_source: { excluded: NOT_A_NUMBER }, robust_winner: { excluded: NOT_A_NUMBER },
  shareable_url: { excluded: NOT_A_NUMBER }, shared_at: { excluded: NOT_A_NUMBER }, shared_mechanism: { excluded: NOT_A_NUMBER },
  switch_reading: { excluded: NOT_A_NUMBER }, switch_reason: { excluded: NOT_A_NUMBER }, win_probabilities_unavailable: { excluded: NOT_A_NUMBER },
  winner_flips: { excluded: NOT_A_NUMBER }, winner_id: { excluded: NOT_A_NUMBER }, winner_label: { excluded: NOT_A_NUMBER },
}

type SurfaceDisposition = 'rendered' | { readonly excluded: string }
const productionSources = (): Array<[string, string]> => [...productionModules()].map(f => [f, sourceFiles().get(f) ?? ''])
const NOT_RENDERED_HELPER_ONLY = 'never rendered: production imports only its helpers (no `<Name` JSX of it in a production file; checked below)'
const SURFACE_DISPOSITION: Readonly<Record<string, SurfaceDisposition>> = {
  'src/components/debug/PayloadLabTab.tsx': { excluded: DEBUG_ONLY },
  // Last check, blocking 1: SummaryTab no longer reads win_probability (its "N% confidence" is removed), so it is no reader.
  'src/components/results/RangeVisualization.tsx': { excluded: NOT_RENDERED_HELPER_ONLY },
}

const BUILDER_DISPOSITION: Readonly<Record<string, string>> = {
  'src/canvas/decisionBrief/DecisionBriefTrigger.tsx': 'censused: FUNCTIONS "decision brief, copied text" and "decision brief, printable page"; the panel is a SURFACE',
  'src/canvas/ErrorBoundary.tsx': 'copies the crash report (error, stack, logs, URL, the autosaved graph); no Run field',
  'src/canvas/components/ImportExportDialog.tsx': 'downloads the graph (`exportCanvasData({ nodes, edges })`); no Run field',
  'src/canvas/components/ModelTabBody.tsx': 'copies the model\'s inputs (labels, values, link strengths and their sources); no Run field; the tab is a SURFACE',
  'src/canvas/components/SnapshotManager.tsx': 'copies or downloads a saved graph snapshot (`persist.saveSnapshot({ nodes, edges })`); no Run field',
  'src/canvas/components/model-tab/StreamingDiagnostics.tsx': 'copies a correlation id',
  'src/canvas/conversation/zones/MessageMenu.tsx': 'copies a chat message\'s own text verbatim (CEE\'s words or the person\'s); composes nothing',
  'src/canvas/export/exportScenario.ts': 'downloads the scenario\'s metadata and graph; no Run field',
  'src/canvas/utils/safeRichText.ts': 'names `mailto:` only in its safe-link allowlist; builds no export',
  'src/lib/markdown.ts': 'names `mailto:` only in its safe-link allowlist; builds no export',
  'src/components/CanvasDrawer.tsx': 'downloads the sandbox drawer\'s notes (`exportSnapshot: JSON.stringify({ notes })`)',
  'src/components/RunReportDrawer.tsx': 'only on the legacy, unlinked /plot-legacy and /sandbox-v1 routes (the v1 engine sandbox, not the journey; listed in the handback)',
  'src/components/results/AdvancedSection.tsx': 'copies the Run\'s response hash; the section is censused inside the Analysis tab',
  'src/lib/export.ts': 'the sandbox stream panel\'s token export (plain text, JSON, Markdown of streamed tokens); no Run field',
  'src/pages/PanelSetupPage.tsx': 'copies a collaboration round\'s invite text',
  'src/poc/AppPoC.tsx': 'downloads the sandbox graph state (`nodes`, `edges`, `renames`)',
  'src/poc/export/exportCanvas.ts': 'serialises the canvas\'s rendered SVG: its text is what the censused canvas cards and edges render',
  'src/routes/CanvasMVP.tsx': 'copies a share URL',
  'src/utils/clipboard.ts': 'a helper; its callers copy a draft-error report (PreAnalysisPanel) or debug JSON (BoundaryCard, JsonViewer)',
  'src/components/DebugTray.tsx': DEBUG_ONLY,
  'src/components/debug/PayloadLabTab.tsx': DEBUG_ONLY,
  'src/components/debug/components/JsonViewer.tsx': DEBUG_ONLY,
  'src/components/debug/tabs/DataFlowTab.tsx': DEBUG_ONLY,
  'src/components/debug/tabs/PipelineTab.tsx': DEBUG_ONLY,
  'src/components/debug/tabs/RawTab.tsx': DEBUG_ONLY,
  'src/components/debug/utils/exportBundle.ts': DEBUG_ONLY,
}

describe('⭐⭐ ROUND 2: the census inputs are DERIVED, and every derived item is accounted for (DL A and B)', () => {
  it('A: every chance-like numeric payload field (schema types, their docs, and what production reads) is seeded or excluded', () => {
    const derived = payloadChanceFields()
    const missing = [...derived.keys()].filter(f => !(f in FIELD_DISPOSITION))
    const stale = Object.keys(FIELD_DISPOSITION).filter(f => !derived.has(f))
    expect(missing, `derived fields with no disposition: ${missing.map(f => `${f} [${[...derived.get(f)!].join(',')}]`).join(' ; ')}`).toEqual([])
    expect(stale, 'dispositions for fields the derivation no longer finds').toEqual([])
    // Contrast: the derivation sees the fields the round-1 census already seeded.
    for (const f of ['probability_of_goal', 'win_probability', 'switch_probability', 'pct_by_option']) expect(derived.has(f), f).toBe(true)
    // Every seeded field's sentinel reaches what the surfaces read (Run block, mapped report, canonical view, run delta, chat).
    seedSentinel('licensed')
    const store = JSON.stringify([sentinelBlock('licensed'), useCanvasStore.getState().results?.report, sentinelCanonical('licensed'),
      useCanvasStore.getState().runDelta, sentinelFlipAnalysisBlock(), (useCanvasStore.getState().results?.report as Rec | undefined)?.goal_constraints])
    for (const [field, d] of Object.entries(FIELD_DISPOSITION)) {
      if ('seeded' in d) for (const v of d.seeded) expect(store, `${field}: its sentinel ${v} is seeded where the surfaces read it`).toContain(String(v))
      else expect(d.excluded.length, `${field}: an exclusion states its reason`).toBeGreaterThan(20)
    }
  }, 60000)

  it('B: every production component that reads a chance-like field is RENDERED by a census row, or excluded with a reason', () => {
    const derived = chanceReaderComponents()
    const notRendered: string[] = []
    for (const file of derived) {
      const d = SURFACE_DISPOSITION[file] ?? 'rendered'
      const names = componentNamesOf(file)
      if (d === 'rendered') {
        if (!names.some(n => RENDERED.has(n))) notRendered.push(`${file} (${names.join(', ')})`)
      } else if (d.excluded === NOT_RENDERED_HELPER_ONLY) {
        // The claim is checked, not asserted: no production file draws any of its components.
        const prod = [...productionSources()].filter(([f]) => f !== file)
        for (const n of names) expect(prod.filter(([, t]) => new RegExp(`<${n}[\\s/>]`).test(t)).map(([f]) => f), `${file}: <${n}> is drawn`).toEqual([])
      }
    }
    expect(notRendered, `chance-reading components no census row rendered: ${notRendered.join(' ; ')}`).toEqual([])
    expect(Object.keys(SURFACE_DISPOSITION).filter(f => !derived.includes(f)), 'dispositions for files the derivation no longer finds').toEqual([])
    // Contrast: the derivation finds the surfaces the census mounts by name.
    for (const f of ['src/components/results/OptionCards.tsx', 'src/v5/blocks/V5AnalysisResultBlock.tsx']) expect(derived, f).toContain(f)
  }, 60000)

  it('the analysis snapshot record reaches no person or AI: production reads only its run count and latest timestamp', () => {
    // The record carries raw Run fields (it is a stored record, not text). Its store's readers outside its own module may
    // only add, clear, count or read the latest timestamp; a reader of its figures would have to be censused here.
    const readers = productionSources().filter(([f, t]) => f !== 'src/canvas/stores/analysisSnapshotStore.ts' && t.includes('useAnalysisSnapshotStore'))
    expect(readers.length, 'contrast: the store is used in production').toBeGreaterThan(0)
    const uses = readers.flatMap(([f, t]) => [...t.matchAll(/(?:useAnalysisSnapshotStore\.getState\(\)|snapshotStore)\.(\w+)\(\)?(?:\?\.(\w+))?/g)]
      .map(m => `${f}: ${m[1]}${m[2] ? `().${m[2]}` : ''}`))
    expect(uses.filter(u => !/: (?:addSnapshot|clearSnapshots|getRunCount|getLatest\(\)\.timestamp)$/.test(u)), 'a reader of the snapshot record\'s figures').toEqual([])
  }, 60000)

  it('B: every production copy / print / download / share path is censused or excluded with a reason', () => {
    const derived = textBuilderFiles()
    expect(derived.filter(f => !(f in BUILDER_DISPOSITION)), 'builder paths with no disposition').toEqual([])
    expect(Object.keys(BUILDER_DISPOSITION).filter(f => !derived.includes(f)), 'dispositions for paths the derivation no longer finds').toEqual([])
    expect(derived, 'contrast: the brief\'s copy-and-print trigger is derived').toContain('src/canvas/decisionBrief/DecisionBriefTrigger.tsx')
  }, 60000)
})

afterAll(() => { if (process.env.CENSUS_DUMP) writeFileSync(process.env.CENSUS_DUMP, JSON.stringify([...RENDERED].sort())) })

describe('the ruled-claim exemption is bound to its own node (Codex r2 probes)', () => {
  const dom = (html: string): { root: Element; claim: Element } => {
    const root = document.createElement('div')
    root.innerHTML = html
    return { root, claim: root.querySelector('[data-option-id="b"]')! }
  }
  const phrase = (t: string): boolean => GENERIC_CHANCE_PHRASES.some(re => re.test(t))
  it("the licensed claim's own words are left out (contrast: without the exemption they are read)", () => {
    const { root, claim } = dom('<h3 data-goal-chance-claim="highest" data-option-id="b">In this model, Birch plan is the most likely to meet your goal</h3>')
    expect(phrase(textOutside(root, [claim]))).toBe(false)
    expect(phrase(textOutside(root, []))).toBe(true)
  })
  it('a wrong-id claim nested inside the licensed one is still read', () => {
    const { root, claim } = dom('<h3 data-goal-chance-claim="highest" data-option-id="b">Birch <span data-goal-chance-claim="highest" data-option-id="a">Alder plan is the most likely to meet your goal</span></h3>')
    expect(phrase(textOutside(root, [claim]))).toBe(true)
  })
  it("an attribute on the licensed claim is left out only where it repeats the claim's own text", () => {
    const own = dom('<p data-goal-chance-claim="highest" data-option-id="b" title="In this model, Birch plan is the most likely to meet your goal">In this model, Birch plan is the most likely to meet your goal</p>')
    expect(phrase(textOutside(own.root, [own.claim]))).toBe(false)
    const other = dom('<p data-goal-chance-claim="highest" data-option-id="b" aria-label="Alder plan is the most likely to meet your goal">In this model, Birch plan is the most likely to meet your goal</p>')
    expect(phrase(textOutside(other.root, [other.claim]))).toBe(true)
  })
  it('a phrase split across elements outside the claim is still seen (the glued reading)', () => {
    const { root, claim } = dom('<p>ch<span>ance</span> of meeting your goal</p><h3 data-goal-chance-claim="highest" data-option-id="b">x</h3>')
    expect(phrase(textOutside(root, [claim]))).toBe(true)
  })
})

describe("the attribution line's exemption is bound to the SERVED pair (DL lease, 21 Oct 2026)", () => {
  const LINE = '<p data-attribution-case="C1_attributable" data-input-coverage="complete">Changed since the earlier run: x. With that change, Birch plan\'s chance of meeting your goal in this model moved from about 61% to about 50%.</p>'
  const phrase = (t: string): boolean => GENERIC_CHANCE_PHRASES.some(re => re.test(t))
  const withServed = (o: Record<string, unknown>) => act(() => {
    useCanvasStore.setState({ runDelta: { delta: { ...sentinelRunDelta(), ...o }, analysisHash: 'h', scenarioId: 's' } } as never)
  })
  it('a C1 + complete served pair → the line is left out of the phrase check (contrast: a C2 served pair reads it)', () => {
    const root = document.createElement('div')
    root.innerHTML = LINE
    withServed({ attribution_case: 'C1_attributable', input_coverage: 'complete' })
    expect(phrase(textOutside(root, attributionElements(root)))).toBe(false)
    withServed({ attribution_case: 'C2_unpaired', input_coverage: 'complete' })
    expect(phrase(textOutside(root, attributionElements(root)))).toBe(true)
    withServed({ attribution_case: 'C1_attributable', input_coverage: 'partial' })
    expect(phrase(textOutside(root, attributionElements(root)))).toBe(true)
  })
})
