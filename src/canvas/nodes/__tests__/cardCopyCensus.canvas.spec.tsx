/**
 * ⭐⭐ THE CENSUS — WHICH COPY IS BYTE-IDENTICAL ON EVERY SIBLING CARD.
 *
 * Paul, 31 Aug 2026, looking at the board: *"Saying the same copy on every node
 * is a waste of space. For example, 'came out ahead in 7% of simulated
 * scenarios' should be a hover-over. It should show the bar with the percentage
 * next to it to save space."*
 *
 * The principle underneath the example, which is the thing worth guarding: **a
 * label that is byte-identical across every sibling card carries no information
 * AT THAT POSITION.** A reader comparing three option cards learns nothing from
 * the words the three have in common; those words are paying rent in the
 * narrowest column on the screen, at a counter-scaled type size, to say
 * something a section heading or a hover could say once.
 *
 * ⛔ AND THE HALF OF THE PRINCIPLE THAT IS EASY TO GET WRONG — WHICH IS WHY
 * THIS FILE PINS A SET RATHER THAN BANNING A SHAPE. Some identical copy is
 * load-bearing and MUST stay:
 *
 *   · a CAPTION beside a quantity. `Strength ▬▬ 70%` — the noun is invariant by
 *     construction and it is the only thing that says what the number counts.
 *     `NodeMetricRow`'s own header rules on this: *"THE CAPTION IS VISIBLE TEXT,
 *     NEVER A `title`"*, for UI-SEM-089 and because a `title` is unreachable by
 *     keyboard on a non-focusable row and absent on touch. `metricVocabulary.ts`
 *     exists precisely to make those four nouns identical everywhere.
 *   · a BUTTON or CHIP label. An affordance that read differently on each card
 *     would be a different affordance.
 *   · a SECTION HEADING. Paul's own instruction names the heading as one of the
 *     places the invariant wording is supposed to go.
 *
 * So the guard cannot be "no identical run". It is the honest form CLAUDE.md
 * 22f prescribes for a known, adjudicated set: **the census is asserted
 * EXACTLY, so it REDs when the set GROWS (new repeated copy arrived) and REDs
 * when it SHRINKS (a line was removed and nobody re-adjudicated).** Every entry
 * below carries the reason it is allowed to be there. A future session cannot
 * add a line of identical card copy without this file failing and forcing the
 * adjudication into the open.
 *
 * ⭐ THE FIXTURE'S DATA IS PAIRWISE DISJOINT, AND THAT IS THE WHOLE INSTRUMENT.
 * If two siblings shared a factor, that factor's LABEL would read as identical
 * copy and the census would flag the DATA rather than the WRITING. The first
 * cut of this fixture did exactly that — three options all intervening on
 * "Competitor pricing" put that label in the census. Disjointness is asserted
 * in-test (`PRECONDITION`) rather than assumed, because a guard whose
 * discrimination depends on a fixture nothing pins is a guard agreeing with
 * itself (CLAUDE.md trap 13b).
 *
 * ⚠ WHAT THIS CANNOT DO, stated so a green run is not read as more than it is:
 *  · It censuses the RESTING CARD only. Popover content is removed before the
 *    collection — a popover is already the hover treatment, so identical copy
 *    there is the fix, not the defect. Nothing here says anything about panels
 *    or the inspector.
 *  · It sees the states this fixture reaches. Baseline options, the close-call
 *    line, lens modes and the assistant focus state are NOT mounted, so a
 *    repeated line living only in one of those is invisible to it. `BUCKETS` is
 *    the honest scope, and it is the list to read — not this sentence. (This
 *    line named the not-computed branch as unmounted for exactly as long as it
 *    took to add that bucket, which is the drift this whole file is about.)
 *  · Three of the six card kinds are accounted for WITHOUT mounting, and the
 *    reasons are derivations rather than samples. `ActionNode.tsx` is 21 lines
 *    and renders one interpolation, `{props.data.description}` — it has no
 *    authored copy that COULD repeat. `goal` and `decision` are singletons:
 *    every card that reads them uses `.find()` (`OptionNode:1024`,
 *    `RiskNode:46`, `OutcomeNode:39`, `DecisionNode:311`), and
 *    "byte-identical across siblings" is vacuous where there are none.
 *  · `title` text is deliberately EXCLUDED from the offence set. A `title` that
 *    repeats on every card is the destination this change moves copy TO.
 *  · Three siblings, not N. A run identical on three cards could still differ
 *    on a fourth; the census is a floor on repetition, never a proof of it.
 *  · It cannot tell a caption from a redundant noun. `High Risk` beside
 *    `70% likely · High impact` is adjudicated by a human below, not derived.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { OptionNode } from '../OptionNode'
import { OutcomeNode } from '../OutcomeNode'
import { RiskNode } from '../RiskNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null }),
  ),
}))
// Spread the real flags module so a newly-added flag never goes silently absent
// and throws at render — CLAUDE.md trap 12 (derive, don't mirror).
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isGraphBadgesEnabled: vi.fn(() => false),
  isCrossHighlightEnabled: vi.fn(() => false),
  isGraphLensEnabled: vi.fn(() => false),
}))
vi.mock('../../hooks/useScienceIcons', () => ({ useScienceIcons: vi.fn(() => []) }))
vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({ useNodeDisplayMetadata: vi.fn() }))
// Transparent popover, so the collector can SEE popover content in order to
// REMOVE it by testid. Left opaque it would be absent for a different reason
// and the exclusion would be untestable.
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="node-popover">{children}</div>
  ),
}))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'

// ─────────────────────────────────────────────────────────────────────────────
// The board. Every string and every number that reaches a card is unique to one
// sibling — see PRECONDITION below, which proves it rather than trusting it.
// ─────────────────────────────────────────────────────────────────────────────

const NODES = [
  { id: 'goal-1', type: 'goal', data: { type: 'goal', label: 'Sustainable margin' } },
  { id: 'outcome-1', type: 'outcome', data: { type: 'outcome', label: 'Revenue' } },
  { id: 'outcome-2', type: 'outcome', data: { type: 'outcome', label: 'Brand reach' } },
  { id: 'outcome-3', type: 'outcome', data: { type: 'outcome', label: 'Churn' } },
  { id: 'risk-1', type: 'risk', data: { type: 'risk', label: 'Supply shock', probability: 0.7, impact: 'high' } },
  { id: 'risk-2', type: 'risk', data: { type: 'risk', label: 'Regulatory delay', probability: 0.2, impact: 'low' } },
  { id: 'risk-3', type: 'risk', data: { type: 'risk', label: 'Talent loss', probability: 0.45, impact: 'medium' } },
  { id: 'factor-1', type: 'factor', data: { type: 'factor', label: 'Marketing budget', category: 'controllable', observedState: { value: 0.8, extractionType: 'explicit', unit: 'scale' } } },
  { id: 'factor-2', type: 'factor', data: { type: 'factor', label: 'Competitor pricing', category: 'external', observedState: { value: 0.3, extractionType: 'inferred', source: 'cee_inference', unit: 'scale' } } },
  { id: 'factor-3', type: 'factor', data: { type: 'factor', label: 'Team capacity', category: 'controllable', observedState: { value: 0.55, extractionType: 'inferred', source: 'cee_inference', unit: 'scale' } } },
  { id: 'factor-4', type: 'factor', data: { type: 'factor', label: 'Channel depth', category: 'controllable', observedState: { value: 0.42, extractionType: 'explicit', unit: 'scale' } } },
  { id: 'factor-5', type: 'factor', data: { type: 'factor', label: 'Regional demand', category: 'external', observedState: { value: 0.24, extractionType: 'explicit', unit: 'scale' } } },
  { id: 'factor-6', type: 'factor', data: { type: 'factor', label: 'Pricing latitude', category: 'controllable', observedState: { value: 0.66, extractionType: 'explicit', unit: 'scale' } } },
  { id: 'option-1', type: 'option', data: { type: 'option', label: 'Aggressive plan' } },
  { id: 'option-2', type: 'option', data: { type: 'option', label: 'Phased rollout' } },
  { id: 'option-3', type: 'option', data: { type: 'option', label: 'Partner first' } },
]

const EDGES = [
  { id: 'ef1', source: 'factor-1', target: 'outcome-1', data: { weight: 0.91, direction: 'positive', weightSource: 'cee' } },
  { id: 'ef2', source: 'factor-2', target: 'outcome-2', data: { weight: 0.44, direction: 'negative', weightSource: 'cee' } },
  { id: 'ef3', source: 'factor-3', target: 'outcome-3', data: { weight: 0.67, direction: 'positive', weightSource: 'cee' } },
  { id: 'er1', source: 'risk-1', target: 'goal-1', data: { weight: 0.71, direction: 'negative', weightSource: 'cee' } },
  { id: 'er2', source: 'risk-2', target: 'goal-1', data: { weight: 0.26, direction: 'negative', weightSource: 'cee' } },
  { id: 'er3', source: 'risk-3', target: 'goal-1', data: { weight: 0.53, direction: 'negative', weightSource: 'user' } },
  { id: 'eo1', source: 'outcome-1', target: 'goal-1', data: { weight: 0.82, direction: 'positive', weightSource: 'cee' } },
  { id: 'eo2', source: 'outcome-2', target: 'goal-1', data: { weight: 0.37, direction: 'positive', weightSource: 'cee' } },
  { id: 'eo3', source: 'outcome-3', target: 'goal-1', data: { weight: 0.61, direction: 'negative', weightSource: 'user' } },
  // Inbound to the risks, so the risk siblings reach the same layer-2 state the
  // outcome siblings do. Without these, "Depends on:" would appear in the
  // outcome buckets and not the risk ones, and the asymmetry would read as an
  // inconsistency in the pinned set rather than as a gap in the fixture.
  { id: 'erf1', source: 'factor-4', target: 'risk-1', data: { weight: 0.58, direction: 'positive', weightSource: 'cee' } },
  { id: 'erf2', source: 'factor-5', target: 'risk-2', data: { weight: 0.29, direction: 'positive', weightSource: 'cee' } },
  { id: 'erf3', source: 'factor-1', target: 'risk-3', data: { weight: 0.74, direction: 'positive', weightSource: 'cee' } },
  { id: 'ed1', source: 'decision-1', target: 'option-1', data: {} },
  { id: 'ed2', source: 'decision-1', target: 'option-2', data: {} },
  { id: 'ed3', source: 'decision-1', target: 'option-3', data: {} },
]

/** Disjoint by construction: no factor is touched by two options. */
const CEE = {
  options: [
    { id: 'option-1', interventions: { 'factor-1': 0.95 } },
    { id: 'option-2', interventions: { 'factor-2': 0.11, 'factor-4': 0.86 } },
    { id: 'option-3', interventions: { 'factor-3': 0.93, 'factor-5': 0.72, 'factor-6': 0.17 } },
  ],
}

const OPTION_IDS = ['option-1', 'option-2', 'option-3']
const FACTOR_IDS = ['factor-1', 'factor-2', 'factor-3']
const RISK_IDS = ['risk-1', 'risk-2', 'risk-3']
const OUTCOME_IDS = ['outcome-1', 'outcome-2', 'outcome-3']

const META: Record<string, Record<string, unknown>> = {
  'factor-1': { sensitivityRank: 1, influence: 0.82, influenceProvenance: 'model', confidence: 0.71, inSensitivityAnalysis: true },
  'factor-2': { sensitivityRank: 2, influence: 0.41, influenceProvenance: 'model', confidence: 0.33, inSensitivityAnalysis: true },
  'factor-3': { sensitivityRank: 3, influence: 0.24, influenceProvenance: 'model', confidence: 0.58, inSensitivityAnalysis: true },
  'option-1': { winRate: 0.47 },
  'option-2': { winRate: 0.31 },
  'option-3': { winRate: 0.15 },
  'outcome-1': { achievementProbability: 0.62, achievementProbabilityIsModelledBasis: false },
  'outcome-2': { achievementProbability: 0.38, achievementProbabilityIsModelledBasis: false },
  'outcome-3': { achievementProbability: 0.51, achievementProbabilityIsModelledBasis: false },
}

const BASE_META = {
  sensitivityRank: null, influence: null, influenceProvenance: null, confidence: null,
  inSensitivityAnalysis: false, achievementProbability: null,
  achievementProbabilityIsModelledBasis: null, stabilityPercentage: null,
  winRate: null, isResultsMode: false,
}

/**
 * ⭐ THE NOT-COMPUTED BRANCH, AND WHY IT IS A BUCKET RATHER THAN A CAVEAT.
 *
 * `visibleRuns` excludes `sr-only` text, and a mutant DELETING that exclusion
 * survived against the first version of this fixture — for a reason worth
 * writing down: the one invariant sr-only run it reached
 * (`NodeMetricRow`'s `phrase` on the factor influence row) is byte-identical to
 * the VISIBLE caption beside it, so the set-dedupe absorbed it and the census
 * did not move. The exclusion was inert, and an inert filter with a comment
 * claiming it is load-bearing is a guard agreeing with itself (CLAUDE.md 13c —
 * an equivalent mutant must be demonstrated, never assumed).
 *
 * This branch is what makes it bite. On a run where the simulation produced no
 * valid samples for any option, all three cards carry the SAME sr-only
 * sentence — invariant, and different from anything visible. With the exclusion
 * in place the census records only the visible `Not computed` badge; with it
 * deleted, a sentence that is already IN a hover-equivalent position would be
 * reported as repeated card copy, i.e. the fix would read as the defect.
 *
 * One reason across all three siblings is the realistic shape, not a contrived
 * one: `n_valid === 0` is a property of the run, so it fails every option at
 * once.
 */
const NOT_COMPUTED_META = {
  winRate: null,
  winComputationFailed: true,
  winComputationFailedReason: undefined,
}

type Phase = 'pre' | 'post'
type ViewMode = 'standard' | 'expert'
type Rung = 'full' | 'line'

function applyStore(phase: Phase, viewMode: ViewMode, rung: Rung) {
  vi.mocked(useCanvasStore).mockImplementation((selector: any) => selector({
    hoveredOptionId: null,
    nodes: NODES,
    edges: EDGES,
    ceeAnalysisReady: CEE,
    results: {
      status: phase === 'post' ? 'complete' : 'idle',
      report: phase === 'post'
        ? {
            recommendation: { recommended_option_id: 'option-1' },
            option_win_probabilities: { 'option-1': 0.47, 'option-2': 0.31, 'option-3': 0.15 },
          }
        : null,
    },
    highlightedNodes: new Set(),
    dimmedNodeIds: new Set(),
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: 0.6,
    goalConstraints: [],
    setHoveredOption: vi.fn(),
    runMeta: { ceeReview: null },
    viewMode,
    // `selectLodBodyHidden` reads this; 'line' is the rung below the legibility
    // floor, where the body hides and one reduced line comes back.
    lodRung: rung,
  }))
}

const COMPONENTS: Record<string, React.ComponentType<any>> = {
  option: OptionNode, factor: FactorNode, risk: RiskNode, outcome: OutcomeNode,
}

/**
 * Every run of VISIBLE text on the resting card.
 *
 * Three exclusions, each with a reason rather than a convenience:
 *  · the popover subtree — already the hover treatment;
 *  · `sr-only` text — carried FOR assistive tech precisely because the visible
 *    form was compacted, so it is the fix and not the defect;
 *  · the LOD-hidden body — `visibility: hidden` below the legibility floor,
 *    except the one reduced line that re-declares itself visible.
 */
function visibleRuns(root: HTMLElement): string[] {
  root.querySelectorAll('[data-testid="node-popover"]').forEach((el) => el.remove())
  root.querySelectorAll('[data-lod-hidden]').forEach((el) => {
    const reducedLine = el.querySelector('[data-testid="node-lod-line"]')
    el.replaceWith(...(reducedLine ? [reducedLine] : []))
  })
  const out: string[] = []
  root.querySelectorAll('*').forEach((el) => {
    if (el.children.length > 0) return
    if (el.closest('.sr-only') != null) return
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (text) out.push(text)
  })
  return out
}

function mountCard(
  kind: string, id: string, phase: Phase, metaOverlay: Record<string, unknown> = {},
): HTMLElement {
  vi.mocked(useNodeDisplayMetadata).mockReturnValue({
    ...BASE_META, ...(META[id] ?? {}), isResultsMode: phase === 'post', ...metaOverlay,
  } as any)
  const node = NODES.find((n) => n.id === id)!
  const Card = COMPONENTS[kind]
  const { container } = render(
    <ReactFlowProvider>
      <Card
        id={id} type={kind} data={node.data} position={{ x: 0, y: 0 }} selected={false}
        isConnectable positionAbsoluteX={0} positionAbsoluteY={0} dragging={false}
        zIndex={0} deletable={false} selectable draggable
      />
    </ReactFlowProvider>,
  )
  return container as HTMLElement
}

/** The runs present, byte for byte, on EVERY sibling. */
function invariantRuns(perSibling: string[][]): string[] {
  if (perSibling.length === 0) return []
  return [...new Set(perSibling[0].filter((run) => perSibling.every((s) => s.includes(run))))].sort()
}

function censusFor(
  kind: string, ids: string[], phase: Phase, viewMode: ViewMode, rung: Rung,
  metaOverlay: Record<string, unknown> = {},
) {
  applyStore(phase, viewMode, rung)
  return invariantRuns(ids.map((id) => visibleRuns(mountCard(kind, id, phase, metaOverlay))))
}

const BUCKETS: Array<[string, string, string[], Phase, ViewMode, Rung, Record<string, unknown>?]> = [
  ['option · pre · standard', 'option', OPTION_IDS, 'pre', 'standard', 'full'],
  ['option · pre · expert', 'option', OPTION_IDS, 'pre', 'expert', 'full'],
  ['option · post · standard', 'option', OPTION_IDS, 'post', 'standard', 'full'],
  ['option · post · expert', 'option', OPTION_IDS, 'post', 'expert', 'full'],
  ['factor · pre · standard', 'factor', FACTOR_IDS, 'pre', 'standard', 'full'],
  ['factor · pre · expert', 'factor', FACTOR_IDS, 'pre', 'expert', 'full'],
  ['factor · post · standard', 'factor', FACTOR_IDS, 'post', 'standard', 'full'],
  ['factor · post · expert', 'factor', FACTOR_IDS, 'post', 'expert', 'full'],
  ['risk · pre · standard', 'risk', RISK_IDS, 'pre', 'standard', 'full'],
  ['risk · pre · expert', 'risk', RISK_IDS, 'pre', 'expert', 'full'],
  ['risk · post · standard', 'risk', RISK_IDS, 'post', 'standard', 'full'],
  ['risk · post · expert', 'risk', RISK_IDS, 'post', 'expert', 'full'],
  ['outcome · pre · standard', 'outcome', OUTCOME_IDS, 'pre', 'standard', 'full'],
  ['outcome · pre · expert', 'outcome', OUTCOME_IDS, 'pre', 'expert', 'full'],
  ['outcome · post · standard', 'outcome', OUTCOME_IDS, 'post', 'standard', 'full'],
  ['outcome · post · expert', 'outcome', OUTCOME_IDS, 'post', 'expert', 'full'],
  // Below the legibility floor. Every card is reduced to ONE line here, and
  // this is the rung a real board sits at after "Show whole model" (~0.49), so
  // it is where repeated copy costs the most.
  // The run that computed nothing — see NOT_COMPUTED_META.
  ['option · not-computed · standard', 'option', OPTION_IDS, 'post', 'standard', 'full', NOT_COMPUTED_META],
  ['option · pre · lod-line', 'option', OPTION_IDS, 'pre', 'standard', 'line'],
  ['option · post · lod-line', 'option', OPTION_IDS, 'post', 'standard', 'line'],
  ['factor · pre · lod-line', 'factor', FACTOR_IDS, 'pre', 'standard', 'line'],
  ['factor · post · lod-line', 'factor', FACTOR_IDS, 'post', 'standard', 'line'],
  ['risk · pre · lod-line', 'risk', RISK_IDS, 'pre', 'standard', 'line'],
  ['outcome · pre · lod-line', 'outcome', OUTCOME_IDS, 'pre', 'standard', 'line'],
]

/**
 * ⭐⭐ THE CENSUS, ADJUDICATED. Asserted EXACTLY: it REDs on a new repeated
 * line AND on a silently removed one.
 *
 * Every entry is one of four sanctioned kinds. If you are adding a fifth, the
 * answer is almost certainly to move the wording to a `title`, a heading or the
 * canvas legend instead — that is what this file is for.
 *
 *   CAPTION  a noun beside a quantity. Invariant by construction, and it is the
 *            only statement of what the number counts. `metricVocabulary.ts`
 *            makes it identical on purpose; `NodeMetricRow` forbids hiding it
 *            in a `title` (unreachable on touch, and by keyboard on a
 *            non-focusable row).
 *   CONTROL  a button or chip label — an affordance, identical by definition.
 *   HEADING  a section label introducing varying content. One of the two
 *            destinations Paul's ruling names for invariant wording.
 *   RESIDUAL adjudicated, kept, and named so it is not mistaken for settled.
 */
const EXPECTED_CENSUS: Record<string, string[]> = {
  // Nothing. The differentiator sentence is the only line every option card
  // carries here, and its subject is a factor label, so it varies.
  'option · pre · standard': [],
  'option · pre · expert': [
    'What could go wrong?', // CONTROL
  ],
  'option · post · standard': [
    'Ahead', // CAPTION — `METRIC_NOUN.ahead`, beside the bar and the percentage.
    //          This IS the shape Paul asked for: the sentence
    //          "Came out ahead in 47% of simulated scenarios" is already on the
    //          `title` and in `sr-only` text, and the card shows the bar and
    //          the figure. His own example was fixed before this lane opened.
  ],
  // Sorted, because `invariantRuns` sorts — the pinned set must be read as a
  // SET, and an order that depended on render order would RED on an unrelated
  // reshuffle and teach the next session to stop reading it.
  'option · post · expert': [
    'Ahead', // CAPTION
    'View parameters', // CONTROL
    'What this option changes:', // HEADING
    'What would make this lead?', // CONTROL
  ],
  'factor · pre · standard': [],
  'factor · pre · expert': [],
  'factor · post · standard': [
    'Influence', // CAPTION — `METRIC_NOUN.influence`, beside its bar.
  ],
  'factor · post · expert': [
    'Confidence', // CAPTION
    'Influence', // CAPTION
    'Influences:', // HEADING
    'View parameters', // CONTROL
  ],
  'risk · pre · standard': [
    'Strength', // CAPTION — `METRIC_NOUN.strength`, beside its bar.
  ],
  'risk · pre · expert': [
    'Add mitigation', // CONTROL
    'Driven by:', // HEADING
    'Strength', // CAPTION
    'What reduces this?', // CONTROL
  ],
  'risk · post · standard': ['Strength'],
  'risk · post · expert': [
    'Add mitigation', // CONTROL
    'Depends on:', // HEADING
    'Strength', // CAPTION
    'What reduces this?', // CONTROL
  ],
  'outcome · pre · standard': ['Strength'],
  'outcome · pre · expert': [
    'Driven by:', // HEADING
    'Strength', // CAPTION
    'What strengthens this?', // CONTROL
  ],
  'outcome · post · standard': ['Strength'],
  'outcome · post · expert': [
    'Depends on:', // HEADING
    'Strength', // CAPTION
  ],
  // ⭐ EVERY LOD BUCKET IS EMPTY, AND THAT IS THE MEASUREMENT THAT SETTLED THE
  // INSTANCE THIS LANE WAS OPENED ON. A witness of deployed `a1fd39cc` read
  // "Changes 2 factors" byte-identical on three of four option cards. Mounted
  // against options that change 1, 2 and 3 factors, the same position reads
  // "Changes 1 factor" / "Changes 2 factors" / "Changes 3 factors" — so the
  // deployed sighting was three options that genuinely each changed two
  // factors, NOT wording that says the same thing on every card. The reduced
  // line is already the compact form: one noun, one number, sentence on the
  // `title`. Nothing to move.
  'option · not-computed · standard': [
    // ⭐ RESIDUAL, and adjudicated as KEPT. `NOT_COMPUTED_BADGE` is invariant on
    // every failed option by design — it is the statement of the state, and
    // `OptionNode`'s own header argues at length for why a word beats silence
    // here (silence in a row of bars reads as "it came last"). The SENTENCE
    // that explains the state is already where this lane would have put it:
    // on the `title` and in sr-only text, neither of which the census counts.
    'Not computed',
  ],
  'option · pre · lod-line': [],
  'option · post · lod-line': [],
  'factor · pre · lod-line': [],
  'factor · post · lod-line': [],
  'risk · pre · lod-line': [],
  'outcome · pre · lod-line': [],
}

describe('canvas card copy census (Paul, 31 Aug 2026)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('PRECONDITION: no two siblings share a datum, so identical copy is COPY', () => {
    // The instrument's discriminating power depends entirely on this. Two
    // options intervening on one factor would put that factor's LABEL in the
    // census, and the census would then be reporting the fixture rather than
    // the writing — a guard whose discrimination rests on an unpinned fixture
    // (CLAUDE.md trap 13b). Asserted, not assumed.
    const claimed = CEE.options.map((o) => Object.keys(o.interventions))
    const all = claimed.flat()
    expect(new Set(all).size, `two options intervene on one factor: ${all.join(', ')}`).toBe(all.length)

    // …and the same for every other datum a card can render as text. The
    // fingerprint is the union of everything a card reads: its own `data`, the
    // display metadata it is handed, and the weights on the edges it touches —
    // a risk's severity comes from `data`, its strength from an edge, and its
    // influence figures from META, so checking only one of the three would
    // leave two ways for two siblings to render the same number.
    const labels = NODES.map((n) => n.data.label)
    expect(new Set(labels).size, 'two nodes share a label').toBe(labels.length)
    const fingerprint = (id: string) => JSON.stringify([
      NODES.find((n) => n.id === id)?.data,
      META[id] ?? null,
      EDGES.filter((e) => e.source === id || e.target === id).map((e) => e.data.weight).sort(),
    ])
    for (const group of [RISK_IDS, OUTCOME_IDS, FACTOR_IDS, OPTION_IDS]) {
      const prints = group.map(fingerprint)
      expect(new Set(prints).size, `siblings in ${group[0]}'s group are not distinguishable`).toBe(prints.length)
    }
  })

  it('POSITIVE CONTROL: the collector reads real card text, and the intersector can SEE a shared run', () => {
    // Half one — an empty collection satisfies every `toEqual([])` below
    // (CLAUDE.md trap 13). Each card must yield real runs.
    applyStore('post', 'expert', 'full')
    for (const id of OPTION_IDS) {
      const runs = visibleRuns(mountCard('option', id, 'post'))
      expect(runs.length, `card ${id} rendered no text at all`).toBeGreaterThan(3)
      expect(runs, `card ${id} is not rendering its own label`).toContain(
        NODES.find((n) => n.id === id)!.data.label,
      )
    }

    // Half two — and the intersector must actually find a shared run when one
    // exists, and must NOT find one that only some siblings carry. Both
    // directions, because an intersector that returns everything and one that
    // returns nothing both pass a one-sided check.
    expect(invariantRuns([['Ahead', '47%'], ['Ahead', '31%'], ['Ahead', '15%']])).toEqual(['Ahead'])
    expect(invariantRuns([['Ahead', '47%'], ['Ahead', '31%'], ['Behind', '15%']])).toEqual([])
  })

  it('the census is exactly what has been adjudicated — nothing added, nothing silently dropped', () => {
    const measured: Record<string, string[]> = {}
    for (const [name, kind, ids, phase, viewMode, rung, metaOverlay] of BUCKETS) {
      measured[name] = censusFor(kind, ids, phase, viewMode, rung, metaOverlay)
    }
    // ⚠ `toEqual` on the WHOLE object, not per bucket: a per-bucket loop with a
    // `?? []` default would pass for a bucket the pinned set forgot, which is
    // the drift this file exists to catch.
    expect(measured).toEqual(EXPECTED_CENSUS)

    // DISCRIMINATION. The assertion above is satisfied by two censuses that
    // agree on nothing: one where every bucket is empty because the collector
    // broke, and one where the pinned set was emptied to make a failure go
    // away. Both are pinned against here, by identity — the four register
    // captions are the runs that MUST be found, and they are the ones whose
    // disappearance would mean the collector had stopped reading cards.
    expect(measured['risk · pre · standard']).toContain('Strength')
    expect(measured['factor · post · standard']).toContain('Influence')
    expect(measured['option · post · standard']).toContain('Ahead')
    expect(Object.values(measured).flat().length).toBeGreaterThan(15)
  })

  it('the two lines this lane compacted keep their sentence on the hover, and only the quantity on the card', () => {
    // Bound by TESTID, never by a value predicate a sibling line could satisfy
    // (CLAUDE.md trap 19). Both live in Detailed pre-analysis.
    applyStore('pre', 'expert', 'full')
    const card = mountCard('option', 'option-3', 'pre')

    const completeness = card.querySelector('[data-testid="option-completeness-option-3"]')
    expect(completeness, 'the completeness line did not mount').not.toBeNull()
    expect(completeness!.textContent).toBe('3 of 6 factors')
    expect(completeness!.getAttribute('title')).toBe('3 of 6 factors specified for this option')
    // The participle is off the card and recoverable on the hover — the two
    // halves of the claim, asserted separately so neither can carry the other.
    expect(completeness!.textContent).not.toContain('specified')
    expect(completeness!.getAttribute('title')).toContain('specified')
  })

  it('…and the change-count line does the same, on the branch that renders it', () => {
    // This branch needs interventions with NO resolvable baseline, so the delta
    // rows are empty and the count line is what the card falls back to.
    const noBaseline = NODES.map((n) =>
      n.id.startsWith('factor-') ? { ...n, data: { ...n.data, observedState: undefined } } : n,
    )
    vi.mocked(useCanvasStore).mockImplementation((selector: any) => selector({
      hoveredOptionId: null, nodes: noBaseline, edges: EDGES, ceeAnalysisReady: CEE,
      results: { status: 'idle', report: null },
      highlightedNodes: new Set(), dimmedNodeIds: new Set(),
      lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
      goalThreshold: 0.6, goalConstraints: [], setHoveredOption: vi.fn(),
      runMeta: { ceeReview: null }, viewMode: 'expert', lodRung: 'full',
    }))
    const card = mountCard('option', 'option-2', 'pre')

    const line = card.querySelector('[data-testid="option-change-count-option-2"]')
    expect(line, 'the change-count fallback did not mount — check the baseline fixture').not.toBeNull()
    expect(line!.textContent).toBe('Changes 2 factors')
    expect(line!.getAttribute('title')).toBe('Changes 2 factors. Open the inspector to see which ones.')
    expect(line!.textContent).not.toContain('inspector')
    expect(line!.getAttribute('title')).toContain('inspector')
  })
})
