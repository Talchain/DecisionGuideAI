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
 *  · ⚠ IT READS LEAF ELEMENTS ONLY. Text sitting beside a child element (mixed
 *    content) is never collected — found on the Detailed edge pill during the
 *    locked Canvas design (23 Sep 2026), whose run is therefore a hand call.
 *  · `title` and `sr-only` text are deliberately EXCLUDED from the offence
 *    set — both are the destination this change moves copy TO.
 *    ⛔⛔ SO IT CANNOT SEE AN ACCESSIBILITY REGRESSION, AND THAT IS NOT A
 *    QUIBBLE — IT MISSED ONE. A clause moved to a `title` AND an out-of-flow
 *    span, and a clause moved to a `title` ALONE (announced to nobody, absent
 *    on touch), produce byte-identical censuses. The first cut of the two
 *    compacted lines below did the second and every assertion here passed.
 *    A compaction guard cannot certify its own accessibility: that obligation
 *    is pinned separately, by `twoCarrier`.
 *  · ⛔ AT THE `lod-line` RUNG IT CAN ONLY SEE A WHOLE-LINE REPEAT. Below the
 *    legibility floor the caption and its value are ONE leaf (`Ahead 47%`), so
 *    an invariant CAPTION can never be isolated there — those buckets can fire
 *    only when two cards' entire reduced lines match. Their emptiness against
 *    THIS fixture is therefore weak evidence: the fixture's siblings differ by
 *    construction, so the zero is close to guaranteed. It is not proof that the
 *    rung is clean, and it must not be read as one.
 *  · Three siblings, not N. A run identical on three cards could still differ
 *    on a fourth; the census is a floor on repetition, never a proof of it.
 *  · It cannot tell a caption from a redundant noun. `High Risk` beside
 *    `70% likely · High impact` is adjudicated by a human below, not derived.
 *  · ⭐⭐ AND THE ONE TO READ FIRST — WHICH VERDICTS ARE MEASUREMENTS AND WHICH
 *    ARE OPINIONS. `ADJUDICATED_POSITIONS` marks each `by: 'census' | 'hand'`,
 *    and the REACH test proves every one of them is genuinely mounted by some
 *    bucket. The rows marked `by: 'hand'` were decided by a person: the census
 *    did not and COULD NOT rule on them, because their runs differ across
 *    siblings and so can never enter an identical-across-siblings set. Each
 *    carries its own `why`, required by the type.
 *    ⚠ THIS PARAGRAPH DELIBERATELY STATES NO COUNT. It used to say "Four are
 *    decided BY HAND" while the manifest held FIVE, and the fifth — the risk
 *    exposure line — appeared in no prose at all, so its verdict had no written
 *    reason anywhere. The miscount then travelled through the PR body and a
 *    relay to the reviewer without anyone counting. A tally of a list, kept by
 *    hand beside the list, is the mirror this estate keeps paying for
 *    (CLAUDE.md trap 12) — and it had grown inside the mechanism built to stop
 *    mis-sourced verdicts. **Read the manifest. Do not read a number here.**
 *    ⚠ Two lines this PR COMPACTS are among them, and they were originally
 *    presented as census findings when they are not: the change-count line was
 *    reached by ZERO buckets until `option · no-baseline · expert` was added,
 *    and the completeness line reads `1 / 2 / 3 of 6 factors`. A hand call is a
 *    legitimate way to decide a line; presenting one as an instrument's output
 *    is not.
 *  · ⚠ THE EXACT-SET DISCIPLINE THAT MAKES THE REACH TEST BITE IS APPLIED TO
 *    ONE POSITION, AND THE MANIFEST READS STRONGER THAN THAT. `option · the
 *    change-COUNT line` is asserted to be reached by EXACTLY
 *    `option · no-baseline · expert` — which is what catches an imposter
 *    position rendering the same words, the failure that broke the first
 *    version of this probe. Every other text-bound predicate asserts only
 *    "reached SOMEWHERE", so a second position rendering `Driven by:` or
 *    `What reduces this?` would satisfy it. No such imposter exists today
 *    (checked), and the guarantee is narrower than the row list looks. Stated
 *    rather than widened, because widening it needs a per-position expected-set
 *    and that is a piece of work, not a line.
 *    Locked Canvas design (23 Sep 2026): the change-COUNT line is retired from
 *    the face; the exact-set discipline now binds its successor, `+N more`, by
 *    testid, and a separate assertion requires the retired testid on NO card.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { OptionNode } from '../OptionNode'
import { optionTargetsChannels } from '../OptionNode'
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
import { useGuidanceStore } from '../../stores/guidanceStore'

/**
 * Locked Canvas design (23 Sep 2026): each card's ONE question is now the rail's
 * coaching icon (`node-coaching-icon-<id>`), which renders only where an ask
 * surface is registered (`canReceiveAsk`) — the ordinary product state, since
 * the assistant panel registers one. The census registers one so the icon is
 * MOUNTED and its position can be reached; it is an icon with an accessible
 * name and no visible text, so it contributes no run to any bucket.
 */
const ASK_SURFACE_NULLS = {
  _prefillChat: useGuidanceStore.getState()._prefillChat,
  _sendMessage: useGuidanceStore.getState()._sendMessage,
  _dispatchAction: useGuidanceStore.getState()._dispatchAction,
  guidanceItems: useGuidanceStore.getState().guidanceItems,
}

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

/**
 * Disjoint by construction: no factor is touched by two options.
 *
 * ⚠ AND DISJOINT AS RENDERED, NOT ONLY AS NUMBERS. Locked Canvas design (23 Sep
 * 2026): the option face now shows its change rows (`→ Very high`) in the
 * `no-baseline` bucket, and a tier word bands several numbers into one string.
 * `option-2`'s `factor-4` was 0.86 — a THIRD `→ Very high` beside 0.95 and 0.93
 * — so the census reported the fixture's banding as repeated copy (the same
 * failure the shared-factor label caused in the first cut; see PRECONDITION).
 * 0.5 bands to `Medium`, so each option's leading rows read differently.
 * The same holds for DIRECTION: where a `scale` target has no reading, the row
 * says `Increases` / `Decreases` against the factor's value, and with every
 * option raising something all three cards read `Increases`. `option-1`'s
 * `factor-1` was 0.95 (above its 0.8); at 0.65 it lowers it, so no direction
 * word is on every sibling either.
 */
const CEE = {
  options: [
    { id: 'option-1', interventions: { 'factor-1': 0.65 } },
    { id: 'option-2', interventions: { 'factor-2': 0.11, 'factor-4': 0.5 } },
    { id: 'option-3', interventions: { 'factor-3': 0.93, 'factor-5': 0.72, 'factor-6': 0.17 } },
  ],
}

const OPTION_IDS = ['option-1', 'option-2', 'option-3']
const FACTOR_IDS = ['factor-1', 'factor-2', 'factor-3']
const RISK_IDS = ['risk-1', 'risk-2', 'risk-3']
const OUTCOME_IDS = ['outcome-1', 'outcome-2', 'outcome-3']

// Contract v3.1 pt 5: only a RANKED factor carries a driver line, so the three
// factors carry a licensed ranking (set 3, ranked 3 — the contract fixture's
// own "Driver N of 3"). Before v3.1 they were implicitly unranked (no set size)
// and the line read the quantity noun `Influence`, which v3.1 retires.
const RANKED = { influenceSetSize: 3, influenceRankedCount: 3 }
const META: Record<string, Record<string, unknown>> = {
  'factor-1': { sensitivityRank: 1, influence: 0.82, influenceProvenance: 'model', confidence: 0.71, inSensitivityAnalysis: true, ...RANKED },
  'factor-2': { sensitivityRank: 2, influence: 0.41, influenceProvenance: 'model', confidence: 0.33, inSensitivityAnalysis: true, ...RANKED },
  'factor-3': { sensitivityRank: 3, influence: 0.24, influenceProvenance: 'model', confidence: 0.58, inSensitivityAnalysis: true, ...RANKED },
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

function applyStore(phase: Phase, viewMode: ViewMode, rung: Rung, nodes: typeof NODES = NODES) {
  vi.mocked(useCanvasStore).mockImplementation((selector: any) => selector({
    hoveredOptionId: null,
    nodes,
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
    // Locked Canvas design (23 Sep 2026): the driver line and the option's
    // `Current model` caption are CURRENT-RUN claims (spec §8;
    // `useAnalysisResultsAreCurrent`, `useRunCurrency`). A completed run with no
    // freshness verdict reads as cannot-confirm and hides the driver line, so
    // the post phase states the ordinary post-run fact: the run is current.
    analysisFreshness: phase === 'post' ? { freshness: 'fresh' } : null,
    analysisFreshnessDirty: false,
    importPendingServerRegistration: false,
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

/**
 * THE FACTORS WITHOUT OBSERVED VALUES. This also has no declared reference
 * option, so the delta rows are empty and the card uses its change-COUNT line.
 * Since the reference-identity repair, the ordinary board also has no declared
 * reference: observedState alone no longer licenses a before/after pair.
 * The two fixtures retain coverage with and without observed values. The fallback is
 * a REAL card state — it is what a user sees on a graph CEE drafted without
 * observed values — and it was reachable by NO bucket in the first version of
 * this file, which is how the line this PR edits came to be credited to a
 * census that never saw it.
 */
const NODES_NO_BASELINE = NODES.map((n) =>
  n.id.startsWith('factor-') ? { ...n, data: { ...n.data, observedState: undefined } } : n,
) as typeof NODES

function censusFor(
  kind: string, ids: string[], phase: Phase, viewMode: ViewMode, rung: Rung,
  metaOverlay: Record<string, unknown> = {}, nodes: typeof NODES = NODES,
) {
  applyStore(phase, viewMode, rung, nodes)
  return invariantRuns(ids.map((id) => visibleRuns(mountCard(kind, id, phase, metaOverlay))))
}

const BUCKETS: Array<
  [string, string, string[], Phase, ViewMode, Rung, Record<string, unknown>?, (typeof NODES)?]
> = [
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
  // No observed values and no declared reference — the ordinary expert draft
  // now also reaches the change-COUNT line, without borrowing observed values.
  ['option · no-baseline · expert', 'option', OPTION_IDS, 'pre', 'expert', 'full', {}, NODES_NO_BASELINE],
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
/*
 * ⭐⭐ LOCKED CANVAS DESIGN (23 Sep 2026) — RE-ADJUDICATED, NOT RE-RECORDED.
 * Every change below is a named ruling, not a measurement copied back in:
 *
 *  · THE FACE QUESTIONS LEFT THE FACE. `What could go wrong?` (option),
 *    `What would we see first?` (risk) and `What would falsify this?` (outcome)
 *    were CONTROLs on the Standard face; each card's ONE question is now the
 *    rail's coaching icon (spec §2 "Coaching is one consistent icon"; ED 02:31Z
 *    D4; ED 11:52Z points 3–5). The icon has an accessible name and NO visible
 *    text, so it contributes no run — its position is pinned by REACH below
 *    (`… · the rail coaching icon`), and Detailed keeps its chip rows here.
 *  · `Support` → `Current model` (ED 11:52Z point 4: "Do not use `Support` as
 *    the result label … must be explicitly model-relative"). Still a CAPTION.
 *    The post fixture now carries a CURRENT run (`applyStore`), the ordinary
 *    state straight after a run and the one the driver line needs.
 *  · `Strength` → `Link strength` (ED 11:52Z point 5: "if strength is shown
 *    on-node, call it link strength"). Still a CAPTION.
 *  · CONTRACT v3.1 (gap U1, 24 Sep 2026): `Link strength` LEAVES the risk and
 *    outcome cards at every rung — "Outcome/risk records are distinct from the
 *    strength of their connections". Removed from all eight risk/outcome
 *    buckets below, and its two REACH positions are retired with it.
 *  · The factor `Influence` row is now the driver line (ED 02:31Z D1a). Contract
 *    v3.1 pt 5 then retired its unranked arm (the `Influence` noun caption):
 *    the fixture's factors are ranked, and their `Driver N of 3 ranked in this
 *    run` varies per card, so the caption is no invariant run any more.
 *  · The option face now LEADS with its change rows (spec §4; ED 11:52Z
 *    point 4). Their runs are data (a reading, a band, or a direction word), so
 *    they enter no bucket while the fixture stays disjoint AS RENDERED — see
 *    the note on `CEE`. This census caught a row rendering a bare `→` for a
 *    target with no reading while this change was in review; production now
 *    says the direction instead (`optionChangeRows.ts`, "NEVER AN ARROW
 *    POINTING AT NOTHING"), so a bare `→` is not in the allowed set anywhere.
 *  · BOUNDED ANATOMY (ED #63 5809278282, 24 Sep 2026: "Option = top change
 *    pre-run or current-model share post-run … The fuller S3 reasoning detail
 *    — change rows … — can move to the existing hover/focus popover"). In
 *    STANDARD view the rows, `+N more` and the differentiator left the resting
 *    card for the popover this census excludes. Pre-run the face keeps ONE line
 *    — the top change, value and mark first — so its mark and separator stay in
 *    `option · pre · standard`; post-run the share line replaces it, so they
 *    LEAVE the two Standard post-run buckets. Detailed keeps its inline rows and
 *    its buckets are unchanged.
 */
const EXPECTED_CENSUS: Record<string, string[]> = {
  'option · pre · standard': [
    // ⭐ WAS `What could go wrong?` (CONTROL, ADDED 15 Sep 2026: measured on
    // deployed `79866c44`, 4 of 4 option cards asked nothing on their face).
    // Locked Canvas design (23 Sep 2026): the question is still on the card, as
    // the rail's coaching icon — no visible run. See REACH.
    // Bounded anatomy (ED #63 5809278282): the two runs below now come from the
    // face's ONE line — the top change's mark and its separators.
    'no source', // MARK — Paul 23 Sep point 7 + Codex #63 5801529767: an UNSOURCED target says so; it is never relabelled as Olumi's (est.) or yours. These fixtures' targets carry no source literal.
    //          option target is marked (this fixture's interventions carry no `source`).
    '·', // MARK SEPARATOR — contract v3.1 pt 7 (gap U12, "→ 1 brief" read as a unit): punctuation, not wording, aria-hidden; the mark it sets apart is the run above.
  ],
  'option · pre · expert': [
    // Locked Canvas design (23 Sep 2026): `What could go wrong?` was the card
    // question in BOTH views; it is the rail icon in both now.
    'no source', // MARK — Paul 23 Sep point 7 + Codex #63 5801529767: an UNSOURCED target says so; it is never relabelled as Olumi's (est.) or yours. These fixtures' targets carry no source literal.
    //          option target is marked (this fixture's interventions carry no `source`).
    '·', // MARK SEPARATOR — contract v3.1 pt 7 (gap U12, "→ 1 brief" read as a unit): punctuation, not wording, aria-hidden; the mark it sets apart is the run above.
  ],
  'option · post · standard': [
    'Current model', // CAPTION — `OPTION_RESULT_COPY.current`, beside `N% of runs`.
    //            ⭐ WAS 'Ahead' until 7 Sep 2026, then 'Support' until the
    //            locked Canvas design (23 Sep 2026; ED 11:52Z point 4). The
    //            sentence is on the `title` and in `sr-only` text.
    // ⛔ `no source` and `·` LEFT this bucket (bounded anatomy, ED #63
    // 5809278282): post-run the share line is the face's one line and the
    // change rows — whose marks they were — are in the popover.
  ],
  // Sorted, because `invariantRuns` sorts — the pinned set must be read as a
  // SET, and an order that depended on render order would RED on an unrelated
  // reshuffle and teach the next session to stop reading it.
  'option · post · expert': [
    'Current model', // CAPTION
    'View parameters', // CONTROL
    'What this option sets:', // HEADING
    'What would make this better supported?', // CONTROL
    'no source', // MARK — Paul 23 Sep point 7 + Codex #63 5801529767: an UNSOURCED target says so; it is never relabelled as Olumi's (est.) or yours. These fixtures' targets carry no source literal.
    //          option target is marked (this fixture's interventions carry no `source`).
    '·', // MARK SEPARATOR — contract v3.1 pt 7 (gap U12, "→ 1 brief" read as a unit): punctuation, not wording, aria-hidden; the mark it sets apart is the run above.
  ],
  'factor · pre · standard': [],
  'factor · pre · expert': [
    // ⚠ EMPTY BECAUSE THE COLLECTOR CANNOT SEE THE ONE INVARIANT RUN HERE — not
    // because there is none. Locked Canvas design (23 Sep 2026), MT-19: a
    // Detailed edge pill for an unconfirmed Olumi strength reads `· Link
    // strength est.` on every such card, with its figure on the `title` and in
    // an sr-only child. That child makes the span MIXED content, and
    // `visibleRuns` reads LEAF elements only, so the run is never collected.
    // It is adjudicated by hand in the manifest (`factor · the edge pill …`).
  ],
  // ⭐ ADJUDICATED 24 Sep 2026 — contract v3.1 pt 5 retires the unranked
  // driver line, so the quantity-noun caption `Influence` is gone. The ranked
  // line reads `Driver N of M analysed` (ED #63 5806207128), which VARIES per card, so it
  // is no invariant run; its position is pinned by REACH (`factor · the driver
  // line`).
  'factor · post · standard': [],
  'factor · post · expert': [
    'Confidence', // CAPTION
    'Influences:', // HEADING
    'View parameters', // CONTROL
  ],
  'risk · pre · standard': [
    // WAS `Link strength` (CAPTION; ED 11:52Z point 5) — retired by contract
    // v3.1 (gap U1): strength is the connection's fact, not the card's.
    // ⭐ WAS ALSO `What would we see first?` (CONTROL, ADJUDICATED 9 Sep 2026,
    // promoted from the hover popover). Locked Canvas design (23 Sep 2026): it
    // is the rail's coaching icon now — still on the card, no visible run.
    '· entered', // PROVENANCE — ADJUDICATED 24 Sep 2026 (ED #63 5809278282: value
    // provenance stays explicit on the card, never tooltip-only). The entered
    // likelihood/impact pair's qualifier ("Entered estimate") in its short form.
  ],
  'risk · pre · expert': [
    'Driven by:', // HEADING
    'Explore mitigation', // CONTROL
    'What reduces this?', // CONTROL
    'What would we see first?', // CONTROL
  ],
  'risk · post · standard': [
    // WAS `Link strength` (CAPTION) — retired by contract v3.1 (gap U1). The
    // face question is the rail icon; see the pre bucket.
    '· entered', // PROVENANCE — see the pre bucket.
  ],
  'risk · post · expert': [
    'Depends on:', // HEADING
    'Explore mitigation', // CONTROL
    'What reduces this?', // CONTROL
    'What would we see first?', // CONTROL
  ],
  'outcome · pre · standard': [
    // WAS `Link strength` (CAPTION) — retired by contract v3.1 (gap U1).
    // ⭐ WAS ALSO `What would falsify this?` (CONTROL, ADJUDICATED 9 Sep 2026).
    // Locked Canvas design (23 Sep 2026): the rail's coaching icon asks it now.
    // ⭐ ADJUDICATED 24 Sep 2026 as KEPT — contract v3.1 OR-02 / RHY-09. STATE,
    // by the `Not computed` precedent below: invariant on every unquantified
    // outcome BY DESIGN, because it IS the statement of the state, and it sits
    // in the position the outcome's own value takes when one exists (v3.1
    // fixture: `small-state` / `own-value`). v3.1 point 8: "use that space for
    // actual outcome state". The risk card's `Likelihood and impact not set
    // yet` is the same kind of line; this fixture's risks carry values, so it
    // does not appear in their buckets.
    // ⭐ RE-ADJUDICATED 24 Sep 2026 — ED #63 5809278282 (bounded anatomy, "title
    // + one primary line … Outcome/Risk = state"): the Standard line SHOWS the
    // sentence's own tail, `Not quantified` (fits the ~19-character landing
    // line); the whole sentence `Outcome not quantified` is on the `title`, in
    // sr-only text and in the popover — none of which this census counts. Still
    // STATE, still invariant by design; Detailed buckets keep the full sentence.
    'Not quantified',
  ],
  'outcome · pre · expert': [
    'Driven by:', // HEADING
    'Explore consequences', // CONTROL
    'Outcome not quantified', // STATE — see `outcome · pre · standard`
    'What affects this?', // CONTROL
    'What would falsify this?', // CONTROL
  ],
  'outcome · post · standard': [
    // WAS `Link strength` (CAPTION) — retired by contract v3.1 (gap U1). The
    // falsification question is still asked after a run (the `!isPostAnalysis`
    // gate stays gone), by the rail icon.
    'Not quantified', // STATE — see `outcome · pre · standard` (ED 5809278282 short form)
  ],
  'outcome · post · expert': [
    'Depends on:', // HEADING
    'Explore consequences', // CONTROL
    'Outcome not quantified', // STATE — see `outcome · pre · standard`
    'Validate this assumption', // CONTROL
    // ⭐ ADJUDICATED 9 Sep 2026 — the phase gate that deleted this question on a
    // completed run is gone, so Detailed post now carries it as Detailed pre
    // always did.
    'What would falsify this?', // CONTROL
  ],
  // ⚠⚠ EVERY LOD BUCKET IS EMPTY, AND THAT ZERO IS NEARLY GUARANTEED —
  // DO NOT READ IT AS A CLEAN BILL. (Until contract v3.1 pt 5 the exception was
  // `factor · post · lod-line`, whose unranked cards had no reduced line; the
  // census factors are ranked now — see that bucket.) At this rung the caption and its value are ONE
  // leaf (`Ahead 47%`), so no invariant caption can be isolated here; a bucket
  // fires only if two cards' ENTIRE reduced lines match, and this fixture's
  // siblings are disjoint by construction. The zeros are consistent with the
  // rung being clean and equally consistent with the census being unable to
  // look. What the LOD buckets DO establish is REACH — `node-lod-line` is in
  // `ADJUDICATED_POSITIONS` and the reach test proves these buckets mount it.
  //
  // ⭐ THE REAL SETTLEMENT OF THE INSTANCE THIS LANE WAS OPENED ON IS THE
  // VARIATION, NOT THE EMPTINESS. A witness of deployed `a1fd39cc` read
  // "Changes 2 factors" byte-identical on three of four option cards. Mounted
  // against options that change 1, 2 and 3 factors, the same position reads
  // "Changes 1 factor" / "Changes 2 factors" / "Changes 3 factors" — so the
  // deployed sighting was three options that genuinely each changed two
  // factors, NOT wording that says the same thing on every card. The reduced
  // line is already the compact form: one noun, one number, sentence on the
  // `title`. Nothing to move. That conclusion rests on the three cards reading
  // DIFFERENTLY — a fact about the per-card runs, which the reach test and the
  // fixture's disjointness both pin — and not on these buckets being empty.
  'option · not-computed · standard': [
    // ⭐ RESIDUAL, and adjudicated as KEPT. `NOT_COMPUTED_BADGE` is invariant on
    // every failed option by design — it is the statement of the state, and
    // `OptionNode`'s own header argues at length for why a word beats silence
    // here (silence in a row of bars reads as "it came last"). The SENTENCE
    // that explains the state is already where this lane would have put it:
    // on the `title` and in sr-only text, neither of which the census counts.
    'Not computed',
    // ⛔ `no source` and `·` LEFT this bucket with the change rows (bounded
    // anatomy, ED #63 5809278282): after a run the face's one line is the run's
    // own line (here the not-computed badge); the rows are in the popover.
  ],
  // The change-COUNT fallback lives here and nowhere else. It does NOT enter
  // the census — `Changes 1 factor` / `Changes 2 factors` / `Changes 3 factors`
  // differ — and that is the point of the bucket: the position is REACHED, so
  // the reach test below can prove it, and the adjudication of its wording is
  // an honest hand call rather than a claim the census never tested.
  'option · no-baseline · expert': [
    // Locked Canvas design (23 Sep 2026): `What could go wrong?` is the rail
    // icon now (see `option · pre · standard`). The change-COUNT line this
    // bucket exists to reach is RETIRED from the face — its routes are `+N
    // more` and the rail's edit-targets icon (REACH, and the two-carrier case).
    'no source', // MARK — Paul 23 Sep point 7 + Codex #63 5801529767: an UNSOURCED target says so; it is never relabelled as Olumi's (est.) or yours. These fixtures' targets carry no source literal.
    //          option target is marked (this fixture's interventions carry no `source`).
    '·', // MARK SEPARATOR — contract v3.1 pt 7 (gap U12, "→ 1 brief" read as a unit): punctuation, not wording, aria-hidden; the mark it sets apart is the run above.
  ],
  'option · pre · lod-line': [],
  'option · post · lod-line': [],
  'factor · pre · lod-line': [],
  // ⭐ ADJUDICATED 24 Sep 2026 (contract v3.1 pt 5): the factors are ranked
  // now, so each has a reduced line — `Driver N of M analysed`, which
  // varies per card — and no invariant run is left at this rung.
  'factor · post · lod-line': [],
  'risk · pre · lod-line': [],
  'outcome · pre · lod-line': [
    // STATE — see `outcome · pre · standard`. The outcome declares no reduced
    // line, so its body is not blanked at this rung and the state line is
    // collected here, exactly as `factor · post · lod-line` collects its caption.
    'Not quantified', // ED 5809278282 short form — see `outcome · pre · standard`
  ],
}

/**
 * ⭐⭐⭐ THE REACH MANIFEST — WITHOUT THIS, "SCORED CLEAN" AND "NEVER LOOKED AT"
 * ARE THE SAME RESULT.
 *
 * ⚠ THIS EXISTS BECAUSE THE CENSUS WAS CREDITED WITH FINDING TWO LINES IT HAD
 * NEVER SEEN. Reviewed and reproduced:
 *
 *   · the change-COUNT line was reached by **0 of 24** buckets — it renders
 *     only where no factor has an observed value, and no bucket built that
 *     graph. (`option · no-baseline · expert` is that bucket, added since.)
 *   · the completeness line VARIES across siblings (`1 / 2 / 3 of 6 factors`),
 *     so it can never enter an identical-across-siblings census at all.
 *
 * Both were HAND-ADJUDICATED. That is a legitimate way to decide a line; it is
 * not a census finding, and the difference has to be visible in the file rather
 * than implied by adjacency.
 *
 * ⛔ AND THE CONSEQUENCE IS BIGGER THAN THOSE TWO LINES: every position the
 * census scored CLEAN is only as trustworthy as its reach. A position the
 * fixture never mounts produces an empty contribution, which is
 * indistinguishable from a position that mounted and carried nothing repeated.
 * So each adjudicated position is bound BY IDENTITY — a testid, or a predicate
 * over the card's own runs — and asserted to be genuinely collected somewhere.
 *
 * ⚠ IDENTITY, NOT TEXT, AND THAT IS NOT PEDANTRY. A first attempt at this
 * probe matched on the string `Changes 1 factor` and reported the position
 * REACHED — by finding the LOW-ZOOM reduced line, a DIFFERENT position that
 * happens to render the same words. Two positions, one string: the estate's
 * signature defect, inside the instrument written to prove reach.
 */
type Position =
  | {
      what: string
      /**
       * DECIDED BY THE CENSUS. The position's run either is or is not in
       * `EXPECTED_CENSUS`, and that set is asserted exactly — so the verdict is
       * the instrument's and needs no prose.
       */
      by: 'census'
      present: (card: HTMLElement, runs: string[]) => boolean
    }
  | {
      what: string
      /**
       * DECIDED BY HAND. The census did not and COULD NOT rule on it: the run
       * differs across siblings, so it can never enter an
       * identical-across-siblings set.
       */
      by: 'hand'
      /**
       * ⭐⭐ REQUIRED BY THE TYPE, AND THAT IS THE POINT — the reason is not
       * optional prose, it is a field a hand call cannot be added without.
       *
       * ⚠ THIS FIELD EXISTS BECAUSE THE PROSE VERSION DRIFTED IMMEDIATELY.
       * The scope note above used to read "Four are decided BY HAND" while the
       * manifest held FIVE, and the fifth — the risk exposure line — was named
       * in no prose anywhere, so its KEPT verdict had NO WRITTEN REASON AT ALL.
       * The miscount then propagated through the PR body and the relay to the
       * reviewer: three hops, none of which counted.
       *
       * That is the hand-maintained mirror (CLAUDE.md trap 12) living INSIDE
       * the mechanism built to stop mis-sourced verdicts — a count of a list,
       * kept by hand, beside the list. The fix is not a corrected count. It is
       * that no count is written down any more: the prose points AT the
       * manifest, and `why` makes each hand call carry its own justification
       * where it cannot be separated from the row it justifies.
       */
      why: string
      present: (card: HTMLElement, runs: string[]) => boolean
    }

const byTestId = (suffix: string) => (card: HTMLElement) =>
  card.querySelector(`[data-testid$="${suffix}"]`) != null

const ADJUDICATED_POSITIONS: Position[] = [
  // ── decided BY THE CENSUS: these runs are (or are not) in EXPECTED_CENSUS
  // Locked Canvas design (23 Sep 2026): the caption reads `Current model` (was
  // `Ahead`, then `Support`; ED 11:52Z point 4). Same position, same testid.
  { what: 'option · the model-relative result caption', by: 'census', present: byTestId('-win-anchor-option-1') },
  // ⚠ RE-CLASSIFIED (review round 2). This was marked `by: 'census'` and it
  // renders `47% / 31% / 15%` — it varies, so it sits in NO census bucket, and
  // that is byte-for-byte the status of the completeness line below, which was
  // marked `by: 'hand'`. One position, two provenances, decided by which line I
  // happened to be looking at. Either reading is defensible; the two had to get
  // the SAME one, and `hand` is the honest one because the census cannot rule
  // on a run that can never repeat.
  {
    what: 'option · the win percentage',
    by: 'hand',
    why: 'KEPT — it is the varying quantity itself, which is the whole thing '
      + "Paul's ruling says to put on the card, now read `N% of runs`. Its CAPTION "
      + '(`Current model`) is the census-decided half, one row up.',
    present: byTestId('-win-readout-option-1'),
  },
  // Locked Canvas design (23 Sep 2026): the `Influence` metric row
  // (`factor-influence-row`) is RETIRED; the driver line replaced it on the face
  // (ED 02:31Z D1a).
  // ⭐ RE-POINTED, ED #63 5809278282 (bounded anatomy, 24 Sep): "The fuller S3
  // reasoning detail — change rows, driver wording, turning-point
  // explanation/findings — can move to the existing hover/focus popover and
  // inspector rather than expanding layout geometry." The driver line left the
  // resting face for the factor's popover, which this census strips as "already
  // the hover treatment" — so the census can no longer rule on it, and the row
  // is a HAND call. `present` still binds by the exact testid, and refuses a
  // match on the face: the line must be reached INSIDE the popover. (The face's
  // wordless driver cue rides the value line, which these bare-amount fixtures
  // do not print; it is pinned in `FactorNode.boundedAnatomy.spec.tsx`.)
  // ⭐ RE-POINTED AGAIN — prototype, Paul 25 Sep 2026: where ED 5809278282
  // conflicts with the prototype's card bodies, the prototype wins. The driver
  // line is back ON the resting face (and the wordless cue is retired). It stays
  // a HAND call: `Driver N of M analysed` varies per card, so it is no invariant
  // run (see 'factor · post · standard'). `present` now binds the exact testid
  // ON the face and refuses a match inside the popover.
  {
    what: 'factor · the driver line (on the resting face, prototype 25 Sep)',
    by: 'hand',
    why: 'KEPT — the prototype puts `Driver N of M` + its bar on the resting factor card '
      + '(Paul 25 Sep, superseding ED #63 5809278282 for card bodies). Its wording and '
      + 'stale label are pinned where it lives: FactorNode.anatomyV32 / '
      + 'driverLineContractV31 / influenceRanking / prototypeBodyAtRest, each bound on the face.',
    present: (c) => {
      const line = c.querySelector('[data-testid="factor-driver-line"]')
      return line != null && line.closest('[data-testid="node-popover"]') == null
    },
  },
  // ⛔ RETIRED (contract v3.1, gap U1): 'risk · the `Link strength` metric row'
  // (`risk-strength-row`) and 'outcome · the `Link strength` metric row'
  // (`outcome-strength-row`). Their absence is pinned by identity in
  // `outcomeRisk.paulContractFeedback.spec.tsx`.
  { what: 'option · the not-computed badge', by: 'census', present: byTestId('-not-computed-option-1') },
  { what: 'factor · the `Confidence` readout', by: 'census', present: (_c, r) => r.some((x) => x.startsWith('Confidence')) },
  { what: 'risk · the coaching chips', by: 'census', present: (_c, r) => r.includes('What reduces this?') },
  { what: 'outcome · the coaching chip', by: 'census', present: (_c, r) => r.includes('Explore consequences') },
  // Contract v3.1 OR-02 / RHY-09: the outcome's own-state line, bound by testid.
  // ED 5809278282: shows `Not quantified`, announces `Outcome not quantified`.
  { what: 'outcome · the own-state line `Not quantified`', by: 'census', present: (c) => c.querySelector('[data-testid="outcome-unquantified"]') != null },
  // Locked Canvas design (23 Sep 2026): the face question is the rail's
  // coaching icon on every kind (spec §2; ED 02:31Z D4). No visible text, so the
  // census's verdict on it is that it adds no run — which is only a measurement
  // if the icon is genuinely MOUNTED, hence these rows.
  { what: 'option · the rail coaching icon', by: 'census', present: (c) => c.querySelector('[data-testid^="node-coaching-icon-option-"]') != null },
  { what: 'risk · the rail coaching icon', by: 'census', present: (c) => c.querySelector('[data-testid^="node-coaching-icon-risk-"]') != null },
  { what: 'outcome · the rail coaching icon', by: 'census', present: (c) => c.querySelector('[data-testid^="node-coaching-icon-outcome-"]') != null },
  // The change-COUNT line's route, moved to the rail (no visible text).
  { what: 'option · the rail edit-targets icon', by: 'census', present: (c) => c.querySelector('[data-testid^="option-edit-targets-"]') != null },
  { what: 'shared · the `Driven by:` / `Depends on:` headings', by: 'census', present: (_c, r) => r.includes('Driven by:') || r.includes('Depends on:') },
  { what: 'factor · the `Influences:` heading', by: 'census', present: (_c, r) => r.includes('Influences:') },
  { what: 'option · the `What this option sets:` heading', by: 'census', present: (_c, r) => r.includes('What this option sets:') },
  { what: 'shared · the reduced line below the legibility floor', by: 'census', present: (c) => c.querySelector('[data-testid="node-lod-line"]') != null },

  // ── decided BY HAND: reached, but their runs can never enter an
  //    identical-across-siblings census, so the census cannot rule on them.
  //    Named here so nobody reads their absence from EXPECTED_CENSUS as a pass.
  //    Each carries its own `why`; there is deliberately no count of them
  //    anywhere in this file.
  {
    // Locked Canvas design (23 Sep 2026): the change-COUNT line
    // (`option-change-count-*`) is RETIRED from the face (spec §4; ED 11:52Z
    // point 4). Its count survives as `+N more` beside the change rows — N from
    // the ONE total — and its route as the rail's edit-targets icon (above).
    what: 'option · the `+N more` control (the change-COUNT line, compacted)',
    by: 'hand',
    why: 'COMPACTED — `+N more` varies with each option\'s own total, so the census '
      + 'cannot rule on it; the invariant sentence it compacts (the targets and '
      + 'where to change them) is its accessible name. Reached by an exact set.',
    present: (c) => c.querySelector('[data-testid^="option-change-more-"]') != null,
  },
  {
    what: 'option · the completeness line (compacted by this PR)',
    by: 'hand',
    why: 'COMPACTED — the denominator is a graph-wide factor count and so is '
      + 'identical on every option card by construction; the brackets and the '
      + 'participle carried nothing. The sentence survives on both carriers.',
    present: byTestId('-completeness-option-3'),
  },
  // ⛔ RETIRED FROM THE RESTING CARD (bounded anatomy, ED #63 5809278282, 24 Sep
  // 2026): 'option · the differentiator sentence'. Its hand verdict was KEPT —
  // "the sentence frame IS the caption for the factor name it carries" — and it
  // is kept, WHOLE, in the option's popover (which opens on hover, tap and
  // keyboard focus), not deleted. This census measures the resting card and
  // excludes the popover as "already the hover treatment", so no bucket can
  // reach it here; its presence and wording are pinned by identity in
  // `OptionNode.boundedAnatomy.spec.tsx` and
  // `OptionNode.differentiatorRecoverable.spec.tsx`.
  {
    what: 'option · the one primary change line (bounded anatomy)',
    by: 'hand',
    why: 'KEPT — ED #63 5809278282: "Option = top change pre-run". Its value, '
      + 'mark and factor label vary per option, so the census cannot rule on '
      + 'them; the invariant runs it adds (the mark and its separator) are in '
      + '`option · pre · standard`. The whole sentence is its title and sr-only text.',
    present: byTestId('-primary-change-option-1'),
  },
  {
    what: 'risk · the severity badge `{Severity} risk`',
    by: 'hand',
    why: 'KEPT — only the noun ` Risk` is invariant, and it says what "High" is '
      + 'high ON. That is the caption shape (`Ahead 47%`) written backwards, and '
      + 'captions stay. NOT deferred on card height, which was a false claim. '
      + 'Detailed only since the locked Canvas design (23 Sep 2026). Sentence '
      + 'case since contract v3.1 (T13): the noun is kept, only its capital goes.',
    present: (_c, r) => r.some((x) => /^(High|Medium|Low) risk$/.test(x)),
  },
  {
    // Locked Canvas design (23 Sep 2026), MT-19 — see `factor · pre · expert`.
    what: 'factor · the edge pill `· Link strength est.`',
    by: 'hand',
    why: 'KEPT — invariant on every Olumi-estimated link BY RULING (MT-19: no '
      + 'bare-percent pill; the figure is on the `title` and an sr-only child), so '
      + 'the words left name the quantity and its status. Hand, because the span is '
      + 'mixed content and `visibleRuns` collects leaf elements only.',
    present: (c) => c.querySelector('[data-testid^="edge-pill-strength-estimate-"]') != null,
  },
  {
    what: 'risk · the exposure line `N% likely · X impact`',
    by: 'hand',
    // ⭐ THE ROW WHOSE VERDICT HAD NO REASON WRITTEN ANYWHERE. It was in the
    // manifest and in no prose, which is exactly what the miscount concealed.
    why: 'KEPT — `likely` and `impact` are the nouns naming the two quantities '
      + 'beside them, so both are captions; only the separator is invariant. It '
      + 'is also the line the severity badge above it is DERIVED from, so it is '
      + 'the half of that pair that must survive if either does.',
    present: (_c, r) => r.some((x) => x.includes('likely ·')),
  },
]

describe('canvas card copy census (Paul, 31 Aug 2026)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useGuidanceStore.setState({ _prefillChat: vi.fn(), _sendMessage: vi.fn(), _dispatchAction: vi.fn(), guidanceItems: [] } as never)
  })
  afterEach(() => { useGuidanceStore.setState(ASK_SURFACE_NULLS as never) })

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
    for (const [name, kind, ids, phase, viewMode, rung, metaOverlay, nodes] of BUCKETS) {
      measured[name] = censusFor(kind, ids, phase, viewMode, rung, metaOverlay, nodes)
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
    // Locked Canvas design (23 Sep 2026): the register captions by their new
    // names (ED 11:52Z points 4–5), and the retired ones must NOT survive.
    // Contract v3.1 (gap U1): the risk/outcome `Link strength` caption is
    // retired; the risk card is witnessed by its Detailed heading instead, and
    // no risk/outcome bucket may carry the retired caption.
    expect(measured['risk · pre · expert']).toContain('Driven by:')
    for (const [bucket, runs] of Object.entries(measured)) {
      if (bucket.startsWith('risk') || bucket.startsWith('outcome')) expect(runs, bucket).not.toContain('Link strength')
    }
    // Contract v3.1 pt 5 retired the factor's `Influence` noun caption; the
    // factor register caption that MUST still be found is `Confidence`.
    expect(measured['factor · post · expert']).toContain('Confidence')
    expect(Object.values(measured).flat()).not.toContain('Influence')
    expect(measured['option · post · standard']).toContain('Current model')
    expect(Object.values(measured).flat()).not.toContain('Support')
    expect(Object.values(measured).flat()).not.toContain('Strength')
    expect(Object.values(measured).flat().length).toBeGreaterThan(15)
  })

  /**
   * ⭐⭐ THE COMPACTED LINES, AND THE ASSERTION THAT MATTERS MOST IS THE
   * SR-ONLY ONE.
   *
   * The first cut of this change moved each clause to a bare `title` on a
   * NON-FOCUSABLE `<p>`. Every visible assertion passed and it was an
   * ACCESSIBILITY REGRESSION: the clause had been ordinary rendered text and
   * was announced; a `title` there announces to nobody, and is absent on touch.
   * `OptionNode` records the same mistake being found and fixed on 31 Aug, and
   * `NodeMetricRow.tsx:58` makes the two-carrier rule a contract.
   *
   * ⛔ AND THE CENSUS IS STRUCTURALLY BLIND TO IT — which is why this is pinned
   * here as a separate obligation rather than left to the census. `visibleRuns`
   * removes `sr-only` and never reads `title`, on the grounds that both are
   * "the destination". That is right for measuring repetition and useless for
   * measuring LOSS: a clause moved-and-kept and a clause moved-and-dropped look
   * identical to it. A compaction guard cannot certify its own accessibility.
   */
  const twoCarrier = (line: Element | null, short: string, full: string, what: string) => {
    expect(line, `${what}: the line did not mount`).not.toBeNull()
    const visible = line!.querySelector('[aria-hidden="true"]')
    const announced = line!.querySelector('.sr-only')
    expect(visible, `${what}: no aria-hidden visible span`).not.toBeNull()
    expect(announced, `${what}: NO SR-ONLY CARRIER — the clause is announced to nobody`).not.toBeNull()
    // The sighted reader gets the short form…
    expect(visible!.textContent).toBe(short)
    // …the pointer user gets the sentence on hover…
    expect(line!.getAttribute('title')).toBe(full)
    // …and keyboard/screen-reader users get it too, which is the half the
    // first cut dropped.
    expect(announced!.textContent).toBe(full)
    // The compaction is real: the clause is genuinely off the visible line.
    const clause = full.slice(short.length).trim()
    expect(clause.length, `${what}: nothing was actually compacted`).toBeGreaterThan(8)
    expect(visible!.textContent).not.toContain(clause)
  }

  it('the completeness line compacts for the eye and says the whole sentence to everyone else', () => {
    applyStore('pre', 'expert', 'full')
    const card = mountCard('option', 'option-3', 'pre')
    twoCarrier(
      card.querySelector('[data-testid="option-completeness-option-3"]'),
      '3 of 6 factors',
      '3 of 6 factors specified for this option',
      'completeness',
    )
  })

  it('…and so does the change-count line, with no observed values or declared reference', () => {
    // Bound to the SAME fixture the `option · no-baseline · expert` bucket
    // uses, so this case and the census cannot drift apart into two different
    // notions of "the branch that renders it".
    applyStore('pre', 'expert', 'full', NODES_NO_BASELINE)
    const card = mountCard('option', 'option-2', 'pre')
    // ⛔ Locked Canvas design (23 Sep 2026): the change-COUNT line is RETIRED
    // from the face (spec §4; ED 11:52Z point 4 — design summary, Option:
    // "REMOVED: … the 'N factor targets' line (`option-change-count-<id>`) — the
    // `+N more` button and a rail pencil icon (`option-edit-targets-<id>`) are
    // the routes"). Absent here, and its two carriers are asserted at their new
    // homes below — the obligation this case exists for (the sentence reaches
    // keyboard and screen-reader users, not only the eye) is unchanged.
    expect(card.querySelector('[data-testid="option-change-count-option-2"]')).toBeNull()
    // Positive control: the card mounted, with its change rows.
    expect(card.querySelector('[data-testid="option-change-rows-option-2"]')).not.toBeNull()

    // ⚠ DERIVED, NOT RESTATED (22 Sep 2026). The sentence is composed from
    // `modelOptionIntervention` — a real `option_intervention_edit` carrier — so
    // the wording has an owner. A literal here would be a second
    // hand-maintained copy of it (trap 12).
    //
    // THE ROUTE: the rail's edit-targets icon, a focusable BUTTON whose
    // accessible name IS the sentence — announced, keyboard-reachable, and the
    // tooltip for the pointer. No visible text for the sentence to crowd.
    const pencil = card.querySelector('[data-testid="option-edit-targets-option-2"]')
    expect(pencil, 'edit-targets route: the control did not mount').not.toBeNull()
    expect(pencil!.tagName).toBe('BUTTON')
    expect(pencil!.getAttribute('aria-label')).toBe(optionTargetsChannels({ count: 2 }).full)

    // THE COUNT: `+N more`, N from the ONE total, on the option with more
    // targets than rows (option-3: 3 targets, 2 rows). The sighted reader gets
    // the short form; the accessible name carries the whole sentence.
    applyStore('pre', 'expert', 'full', NODES_NO_BASELINE)
    const card3 = mountCard('option', 'option-3', 'pre')
    const more = card3.querySelector('[data-testid="option-change-more-option-3"]')
    expect(more, '+N more: the control did not mount').not.toBeNull()
    expect(more!.tagName).toBe('BUTTON')
    expect(more!.textContent).toBe('+1 more')
    const full3 = optionTargetsChannels({ count: 3 }).full
    expect(more!.getAttribute('aria-label')).toContain(full3)
    // The compaction is real: the sentence is genuinely off the visible line.
    expect(more!.textContent).not.toContain(full3)
  })

  /**
   * ⭐ REACH. An absence claim is worth nothing from an instrument that never
   * looked (CLAUDE.md trap 13 / 13e). This walks every bucket and asserts each
   * adjudicated position is genuinely COLLECTED somewhere — so a position that
   * no fixture mounts REDs by name instead of scoring clean.
   */
  it('REACH: every adjudicated position is actually collected by some bucket', () => {
    const reachedIn = new Map<string, string[]>()
    const retiredChangeCountIn: string[] = []
    for (const [name, kind, ids, phase, viewMode, rung, metaOverlay, nodes] of BUCKETS) {
      applyStore(phase, viewMode, rung, nodes)
      for (const id of ids) {
        // `visibleRuns` MUTATES the tree it is given (it strips popovers and the
        // LOD-hidden body), so the positions are probed on a SECOND, untouched
        // mount. Probing the stripped tree would report the popover-only and
        // LOD positions as unreachable and the failure would look like a real
        // finding.
        const runs = visibleRuns(mountCard(kind, id, phase, metaOverlay ?? {}))
        applyStore(phase, viewMode, rung, nodes)
        const card = mountCard(kind, id, phase, metaOverlay ?? {})
        if (card.querySelector('[data-testid^="option-change-count-"]') != null) retiredChangeCountIn.push(`${name} ${id}`)
        for (const pos of ADJUDICATED_POSITIONS) {
          if (pos.present(card, runs)) {
            reachedIn.set(pos.what, [...(reachedIn.get(pos.what) ?? []), name])
          }
        }
      }
    }

    const unreached = ADJUDICATED_POSITIONS.filter((p) => !reachedIn.has(p.what))
    expect(
      unreached.map((p) => `${p.what}  [decided by ${p.by}]`),
      'these positions are ADJUDICATED but NO bucket mounts them — the verdict on them is ' +
        'an opinion, not a measurement. Add a bucket that reaches each, or move it out of ' +
        'the manifest and say in the scope note that it is undecided:',
    ).toEqual([])

    // DISCRIMINATION: the probe must be capable of returning FALSE. A `present`
    // that always answers yes would satisfy the assertion above for every row.
    // The not-computed badge is the discriminator — it exists in exactly one
    // bucket and must be absent from the ordinary post-analysis one.
    expect(reachedIn.get('option · the not-computed badge')).toEqual(
      expect.arrayContaining(['option · not-computed · standard']),
    )
    expect(reachedIn.get('option · the not-computed badge')).not.toContain('option · post · standard')
    // …and the two lines this PR edits are reached by exactly the buckets that
    // can render them, bound by name rather than by count.
    expect(reachedIn.get('option · the `+N more` control (the change-COUNT line, compacted)'))
      .toEqual(expect.arrayContaining(['option · no-baseline · expert']))
    expect(new Set(reachedIn.get('option · the `+N more` control (the change-COUNT line, compacted)')))
      // ⭐ Locked Canvas design (23 Sep 2026) — RE-ADJUDICATED. The retired
      // change-COUNT line was reached by the four buckets its gate allowed (the
      // 22 Sep adjudication recorded in git history: it had moved out of the
      // Expert-only fragment because the product OPENS in Standard). Its count
      // now lives in `+N more`, which belongs to the change rows, and the rows
      // are the option face's LEAD in every state (spec §4 "Always lead with
      // what this option changes"; ED 11:52Z point 4) — so every option bucket
      // mounts it: both views, both phases, the not-computed run, and both LOD
      // rungs. At the LOD rungs the rows are inside the body that the reduced
      // line blanks — present in the DOM, which is what this untouched-mount
      // probe measures (see the note above on `option · pre · lod-line`).
      .toEqual(new Set([
        'option · pre · standard',
        'option · pre · expert',
        'option · post · standard',
        'option · post · expert',
        'option · not-computed · standard',
        'option · no-baseline · expert',
        'option · pre · lod-line',
        'option · post · lod-line',
      ]))
    // ⛔ …and the RETIRED line is reached NOWHERE (rule: absent at its old home,
    // present at its new ones — `+N more` above and the rail's edit-targets icon).
    expect(retiredChangeCountIn, 'the retired change-COUNT line is back on a card face').toEqual([])
    expect(reachedIn.get('option · the rail edit-targets icon'))
      .toEqual(expect.arrayContaining(['option · pre · standard', 'option · no-baseline · expert']))

    // Locked Canvas design (23 Sep 2026): the face questions that were CONTROLs
    // in the Standard buckets are asked by the rail's coaching icon, and it is
    // MOUNTED in exactly those buckets — so their leaving the census is a move,
    // not a loss (spec §2; ED 02:31Z D4).
    expect(reachedIn.get('option · the rail coaching icon'))
      .toEqual(expect.arrayContaining(['option · pre · standard', 'option · pre · expert', 'option · no-baseline · expert']))
    expect(reachedIn.get('risk · the rail coaching icon'))
      .toEqual(expect.arrayContaining(['risk · pre · standard', 'risk · post · standard']))
    expect(reachedIn.get('outcome · the rail coaching icon'))
      .toEqual(expect.arrayContaining(['outcome · pre · standard', 'outcome · post · standard']))
  })

  /**
   * ⭐ EVERY HAND CALL CARRIES ITS OWN REASON, AND NOTHING ANYWHERE COUNTS THEM.
   *
   * The type already forces `why` to exist. This asserts it is a REASON and not
   * a placeholder, and — the part that matters — that no prose in this file
   * states how many hand calls there are. A tally beside a list is the mirror
   * that produced the defect this row exists to close: the scope note said four
   * while the manifest held five, and the row the miscount hid had no written
   * justification at all.
   */
  it('PROVENANCE: every hand-decided position carries a real reason, and no count is written down', () => {
    const hand = ADJUDICATED_POSITIONS.filter((p) => p.by === 'hand')
    const census = ADJUDICATED_POSITIONS.filter((p) => p.by === 'census')
    // Discrimination: both kinds must be populated, or the loops below are inert.
    expect(hand.length, 'no hand calls — this test is vacuous').toBeGreaterThan(3)
    expect(census.length, 'no census calls — the manifest is one-sided').toBeGreaterThan(5)

    for (const p of hand) {
      // A `why` that just restates the verdict is not a reason.
      expect(p.why.length, `${p.what}: \`why\` is too short to be a reason`).toBeGreaterThan(60)
      expect(p.why, `${p.what}: \`why\` must state the verdict it justifies`)
        .toMatch(/^(KEPT|COMPACTED)\b/)
    }

    // ⛔ THE ANTI-MIRROR ASSERTION. No sentence in this file may state a tally
    // of the hand calls — the manifest is the only place the number lives, and
    // it is read, never restated.
    //
    // ⚠⚠ IT SWEEPS THE COMMENTS, AND TWO EARLIER CUTS OF THIS GOT IT WRONG IN
    // OPPOSITE DIRECTIONS — which is the whole lesson of the row.
    //
    //   cut 1 swept the RAW file and fired on its own explanatory comment and
    //     its own positive control: a rule that cannot tell a USE from a
    //     MENTION reads your explanation as the offence
    //     (`metricNounVocabulary.canvas.spec.ts` records hitting this in the
    //     same directory);
    //   cut 2 "fixed" that by STRIPPING COMMENTS — and a mutant restating the
    //     tally in the scope note SURVIVED, green. The scope note IS a comment.
    //     The guard had been made blind to the only place the defect has ever
    //     occurred, and its own comment said so ("the doc block is where the
    //     defect lived") while the code did the opposite.
    //
    // ⛔ SO THE DISCRIMINATOR IS USE-vs-MENTION, NOT CODE-vs-COMMENT. A tally
    // inside quotation marks is a QUOTATION of the historic defect; a bare one
    // is an assertion. Quoted spans are removed and everything else — comments
    // included, because prose is where this lives — is swept.
    const raw = readFileSync(path.resolve(__dirname, 'cardCopyCensus.canvas.spec.tsx'), 'utf8')
    const source = raw.replace(/"[^"\n]*"/g, '""')
    const TALLY = /\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:of\s+them\s+)?(?:are|is|rows?|positions?)?\s*(?:are\s+)?decided\s+by\s+hand/i
    const offenders = source.split('\n')
      .map((line, i) => ({ line, i }))
      .filter(({ line }) => TALLY.test(line))
      .map(({ line, i }) => `${i + 1}: ${line.trim()}`)
    expect(offenders, 'a hand-maintained tally of the manifest has come back:').toEqual([])

    // POSITIVE CONTROL — the sweep must fire on the exact sentence that shipped
    // the defect, or the empty result above means only that it cannot see.
    const theSentenceThatShipped = ['Four', 'are', 'decided', 'BY', 'HAND'].join(' ')
    expect(TALLY.test(`${theSentenceThatShipped} and the census could not rule`)).toBe(true)
    // …and it must NOT fire on the manifest's own rows, or it would ban the
    // classification itself rather than a count of it.
    expect(TALLY.test("by: 'hand',")).toBe(false)
    // ⭐ THE ARM THAT CUT 2 DELETED. The sweep must reach COMMENT PROSE — that
    // is the only place this defect has ever occurred — so a doc-block line is
    // asserted to be visible to it. Without this the guard passes while blind.
    expect(source, 'the sweep is not reading the doc block').toContain('THE CENSUS')
    expect(source.split('\n').length, 'the sweep lost lines').toBe(raw.split('\n').length)
    // …and the quote-stripper must actually strip, or the use/mention rule is
    // inert and the historic quotations would RED.
    expect(raw).toContain('"Four are decided BY HAND"')
    expect(source, 'quoted mentions are not being neutralised').not.toContain('"Four are decided BY HAND"')
  })
})
