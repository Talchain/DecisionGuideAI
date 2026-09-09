/**
 * ⭐⭐ "NEEDS YOUR JUDGEMENT" IS A BADGE, ON EVERY NODE THE STATE ADMITS.
 *
 * Paul's re-ruling, 8 Sep 2026. `BaseNode` returned `'border-warning'` for an
 * incomplete node, REPLACING the kind hue, so colour was the SOLE channel for
 * the state — which the design system's own Developer Checklist forbids — and
 * the amber was least distinguishable on the node class the rule most often
 * applies to (goal: ΔE2000 5.5 under deuteranopia, 8.6 under protanopia, against
 * 9.0 / 12.3 for the risk collision that prompted the original question).
 *
 * ── THE CARRIER IS THE ONE THAT ALREADY EXISTED ────────────────────────────
 * `StatusPill` — amber, visible text, its own accessible name — already carried
 * this exact state, for `factor` and `goal` only. `BaseNode`'s own comment said
 * the rest "keep the warning border only", and Paul has now removed that
 * border. So `decision` and `option` would have been left with NOTHING.
 *
 * The gate is therefore `isIncomplete` ALONE. The hand-listed
 * `(nodeType === 'factor' || nodeType === 'goal')` pair is DELETED rather than
 * complemented: a second carrier for the other node types would be two
 * renderings of one state that nothing keeps in step (CLAUDE.md trap 12), and a
 * mute dot beside a pill that says the words is a worse answer for the sighted
 * user than the pill on both. One state, one carrier, one predicate.
 *
 * ── WHAT THIS FILE PINS THAT NO OTHER FILE DOES ────────────────────────────
 *  1. The badge on EACH node type the state admits, bound BY NODE IDENTITY —
 *     inside `node-corner-stack-{id}` of the node under test, never "some node
 *     on screen has a pill" (CLAUDE.md trap 19).
 *  2. The external-factor exemption surviving the MOVE. Amber leaving the
 *     border is not a licence for it to arrive as a badge.
 *  3. What assistive technology is handed, because the badge is the whole
 *     accessibility argument for the ruling.
 *  4. The corner-stack contract change this makes, source-derived.
 *
 * ⚠ SCOPE, STATED SO A GREEN RUN IS NOT READ AS MORE THAN IT IS. These are
 * jsdom renders. The accessible-name assertions run the same accname algorithm
 * a browser exposes (`dom-accessibility-api`, via Testing Library), so they are
 * evidence about the NAME COMPUTATION — they are NOT a screen-reader session,
 * and they say nothing about visibility, focus order or announcement timing
 * (CLAUDE.md trap 3).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))
vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((s: (x: { layoutNodeWidth: number | null }) => unknown) =>
    s({ layoutNodeWidth: null })) as unknown as (...a: never[]) => unknown),
}))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
    winRate: null,
    isResultsMode: false,
    predictedOutcome: null,
    valueOfInformation: null,
    voiRank: null,
  })),
}))

import { useCanvasStore } from '../../store'
import { FactorNode } from '../FactorNode'
import { OptionNode } from '../OptionNode'
import { GoalNode } from '../GoalNode'
import { DecisionNode } from '../DecisionNode'

const baseProps = {
  selected: false,
  dragging: false,
  zIndex: 0,
  isConnectable: false,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

const FACTOR_ID = 'fac_hiring'
const OPTION_ID = 'opt_rebuild'
const GOAL_ID = 'goal_revenue'
const DECISION_ID = 'dec_platform'

function mockStore(over: Record<string, unknown>) {
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    selector({
      hoveredOptionId: null,
      nodes: [],
      edges: [],
      ceeAnalysisReady: null,
      results: { status: 'idle', report: null },
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set() },
      goalThreshold: null,
      goalConstraints: [],
      setHoveredOption: vi.fn(),
      runMeta: { ceeReview: null },
      viewMode: 'expert',
      ...over,
    } as never),
  )
}

/** The corner stack OF THE NODE UNDER TEST — the identity every badge assertion binds through. */
const stackOf = (id: string) => screen.getByTestId(`node-corner-stack-${id}`)

function renderFactor(data: Record<string, unknown>) {
  mockStore({ nodes: [{ id: FACTOR_ID, type: 'factor', data }] })
  return render(
    <ReactFlowProvider>
      <FactorNode {...(baseProps as any)} type="factor" id={FACTOR_ID} data={data as any} />
    </ReactFlowProvider>,
  )
}

/** An option CEE assessed and found carrying no interventions — the incomplete option. */
function renderIncompleteOption() {
  const data = { label: 'Rebuild', type: 'option' }
  mockStore({
    nodes: [{ id: OPTION_ID, type: 'option', data }],
    ceeAnalysisReady: {
      options: [{ id: OPTION_ID, label: 'Rebuild', interventions: {} }],
      goal_node_id: 'goal_1',
      status: 'ready',
    },
  })
  return render(
    <ReactFlowProvider>
      <OptionNode {...(baseProps as any)} type="option" id={OPTION_ID} data={data as any} />
    </ReactFlowProvider>,
  )
}

/** A goal with no success target — `isGoalDefined` false on both threshold and constraints. */
function renderTargetlessGoal(over: Record<string, unknown> = {}) {
  const data = { label: 'Increase revenue', type: 'goal' }
  mockStore({ nodes: [{ id: GOAL_ID, type: 'goal', data }], ...over })
  return render(
    <ReactFlowProvider>
      <GoalNode {...(baseProps as any)} type="goal" id={GOAL_ID} data={data as any} />
    </ReactFlowProvider>,
  )
}

/** A decision with no option hanging off it — no edge whose `source` is this node. */
function renderOptionlessDecision(edges: unknown[] = []) {
  const data = { label: 'Platform choice', type: 'decision' }
  mockStore({ nodes: [{ id: DECISION_ID, type: 'decision', data }], edges })
  return render(
    <ReactFlowProvider>
      <DecisionNode {...(baseProps as any)} type="decision" id={DECISION_ID} data={data as any} />
    </ReactFlowProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

/* ────────────────────────────────────────────────────────────────────────────
 * 1 · EVERY NODE TYPE THE STATE ADMITS, EACH BOUND TO ITS OWN NODE
 *
 * Four separate cases rather than one loop, deliberately: they are what makes
 * the DISCRIMINATING MUTANT PAIR possible. Removing the badge for all nodes
 * must RED all four; removing it for ONE node kind must RED that kind's case
 * and leave the other three GREEN. A single "some incomplete node has a pill"
 * assertion could not tell those two mutants apart.
 * ──────────────────────────────────────────────────────────────────────────── */
describe('the badge renders on every node type `isIncomplete` admits', () => {
  it('FACTOR (controllable, no value) — badge inside THIS factor\'s corner stack', () => {
    renderFactor({ label: 'Hiring rate', type: 'factor', category: 'controllable' })
    // Precondition pinned in-test: the assertion below is about a node in the
    // incomplete state, not about a card that renders a pill unconditionally.
    expect(screen.getByTestId('overlay-missing-value')).toBeTruthy()
    expect(within(stackOf(FACTOR_ID)).getByTestId('needs-input-pill')).toBeTruthy()
  })

  it('GOAL (no success target) — badge inside THIS goal\'s corner stack', () => {
    renderTargetlessGoal()
    expect(screen.getByTestId('overlay-missing-threshold-node')).toBeTruthy()
    expect(within(stackOf(GOAL_ID)).getByTestId('needs-input-pill')).toBeTruthy()

    // OPPOSITE DIRECTION, same component, same props — only the target differs.
    // Without this the case above could pass on a card that always shows a pill.
    cleanup()
    renderTargetlessGoal({ goalThreshold: { value: 12, unit: '%' } })
    expect(screen.queryByTestId('needs-input-pill')).toBeNull()
  })

  it('⭐ OPTION (assessed, no interventions) — NEWLY COVERED by the re-ruling', () => {
    renderIncompleteOption()
    expect(screen.getByTestId('overlay-missing-value')).toBeTruthy()
    expect(within(stackOf(OPTION_ID)).getByTestId('needs-input-pill')).toBeTruthy()
  })

  it('⭐ DECISION (no options linked) — NEWLY COVERED by the re-ruling', () => {
    renderOptionlessDecision()
    expect(screen.getByTestId('overlay-missing-value')).toBeTruthy()
    expect(within(stackOf(DECISION_ID)).getByTestId('needs-input-pill')).toBeTruthy()

    // OPPOSITE DIRECTION: give the decision an option and the badge must go.
    // A decision node's incompleteness is the ONLY one of the four that is a
    // property of the GRAPH rather than of the node's own data, so its twin is
    // worth spending a case on.
    cleanup()
    renderOptionlessDecision([{ id: 'e1', source: DECISION_ID, target: OPTION_ID }])
    expect(screen.queryByTestId('needs-input-pill')).toBeNull()
  })
})

/* ────────────────────────────────────────────────────────────────────────────
 * 2 · THE EXEMPTION SURVIVES THE MOVE
 * ──────────────────────────────────────────────────────────────────────────── */
describe('⛔ external factors are outside your control, not awaiting your judgement', () => {
  it('EXTERNAL factor with no value — no badge, and not incomplete at all', () => {
    renderFactor({ label: 'Market rate', type: 'factor', category: 'external' })
    expect(screen.queryByTestId('overlay-missing-value')).toBeNull()
    expect(within(stackOf(FACTOR_ID)).queryByTestId('needs-input-pill')).toBeNull()
    // The dash — this node's real signal — is untouched by the ruling.
    expect(screen.getByRole('group')).toHaveAttribute('title', 'Outside your control')
  })
})

/* ────────────────────────────────────────────────────────────────────────────
 * 3 · WHAT ASSISTIVE TECHNOLOGY IS HANDED
 *
 * ⚠ THE FAILURE MODE THIS SECTION EXISTS FOR: `aria-label` REPLACES descendant
 * text for the element that carries it. A badge added inside a labelled
 * container, or a container given a label of its own, can swallow the node's
 * name and leave a screen-reader user with a card that announces only its
 * state. The card is `role="group"` — a CONTAINER role, so its label names the
 * group and its children stay in the tree as their own nodes — and the pill is
 * a sibling-level `role="status"` with its own name. Both are asserted, because
 * "a container role does not prune" is a claim about the code as written, and
 * the next edit is what breaks it.
 * ──────────────────────────────────────────────────────────────────────────── */
describe('what a screen reader is handed', () => {
  it('the node keeps its OWN accessible name — the badge does not swallow it', () => {
    renderIncompleteOption()
    const card = screen.getByRole('group')
    // The node's identity, not its state, is what names the card.
    expect(card).toHaveAccessibleName(/^option node: Rebuild\./)
    // Named by the label the user gave it — asserted separately so a change
    // that kept the shape and dropped the label REDs here.
    expect(card.getAttribute('aria-label')).toContain('Rebuild')
  })

  it('the badge is its OWN named node in the tree, reachable by role and name', () => {
    renderIncompleteOption()
    const card = screen.getByRole('group')
    // `role="status"`, named — so it is announced as a status, not read as part
    // of the card's label. Queried WITHIN the card, so this also proves the
    // badge did not escape the node it describes.
    const badge = within(card).getByRole('status', { name: 'Missing required input' })
    expect(badge).toBe(screen.getByTestId('needs-input-pill'))
  })

  it('both channels are populated — visible words for sighted users, a name for AT', () => {
    renderIncompleteOption()
    const badge = screen.getByTestId('needs-input-pill')
    // The visible text. This is the half that makes the state legible WITHOUT
    // colour, which is the entire point of the ruling — a bare coloured mark
    // would have moved the defect rather than fixed it.
    expect(badge.textContent).toBe('Needs input')
    // The accessible name, which `aria-label` substitutes for that text.
    expect(badge).toHaveAccessibleName('Missing required input')
    // And a tooltip for the pointer user, carrying the same sentence.
    expect(badge.getAttribute('title')).toBe('Missing required input')
  })
})

/* ────────────────────────────────────────────────────────────────────────────
 * 4 · THE CORNER-STACK CONTRACT THIS CHANGES
 *
 * `BaseNode`'s corner-stack comment declares five members and which pairs can
 * never co-occur. One of those impossibilities was `cornerSlot` vs `StatusPill`,
 * held "disjoint by NODE TYPE" — `cornerSlot`'s only caller passes
 * `nodeType="option"`, and the pill was gated to factor/goal.
 *
 * ⚠ DELETING THAT GATE DELETES THAT MECHANISM. The pair is STILL impossible,
 * but for a different reason, and a reason recorded in the wrong place is how a
 * later session concludes the two can overlap and re-measures nothing:
 * `cornerSlot`'s only caller renders it under `isRecommended`, which requires
 * `isResultsMode` (`resultsStatus === 'complete'`); the pill requires
 * `isPreRunMode` (`resultsStatus !== 'complete'`). Exact complements on one
 * store field — the same shape as the pill-vs-rank impossibility beside it.
 *
 * Asserted at the SOURCE rather than by rendering, for the reason the sibling
 * pin already records: a render assertion here would be satisfied by this
 * file's own fixture (no report, no verdict) whatever the gates say, and would
 * be a guard agreeing with itself (CLAUDE.md trap 13b).
 * ──────────────────────────────────────────────────────────────────────────── */
describe('IMPOSSIBILITY PIN — the badge and the "Most supported" pill are exact complements', () => {
  it('the two gates test one store field in opposite directions', () => {
    const baseNode = readFileSync(resolve(__dirname, '../BaseNode.tsx'), 'utf8')
    const optionNode = readFileSync(resolve(__dirname, '../OptionNode.tsx'), 'utf8')
    const metadataHook = readFileSync(
      resolve(__dirname, '../../hooks/useNodeDisplayMetadata.ts'), 'utf8')

    // Positive controls: prove each read can SEE its file's content at all, so a
    // false zero cannot pass as a satisfied assertion (CLAUDE.md trap 13).
    expect(baseNode).toContain('node-corner-stack-')
    expect(optionNode).toContain('cornerSlot=')
    expect(metadataHook).toContain('useNodeDisplayMetadata')

    // The badge mounts only before a run…
    expect(baseNode).toContain("const isPreRunMode = resultsStatus !== 'complete'")
    // …and `cornerSlot`'s only caller only after one.
    expect(optionNode).toContain('cornerSlot={isRecommended ? (')
    expect(optionNode).toContain('if (!displayMetadata.isResultsMode')
    expect(metadataHook).toContain("const isResultsMode = resultsStatus === 'complete'")
  })

  /**
   * ⚠ THIS GUARD READS CODE, AND THE FIRST CUT OF IT DID NOT — it scanned the
   * raw file and went RED on the COMMENT that explains the deletion, because
   * that comment quotes the deleted expression verbatim. A guard that fires on
   * prose is a broken alarm: the next session's fix is to stop writing the
   * history down, which is the opposite of what this file wants. Comments are
   * stripped first, with a positive control asserting the stripper left the
   * source intact (CLAUDE.md trap 13 — an absence probe over a mangled input
   * returns a clean zero and looks identical to a satisfied assertion).
   */
  it('the badge gate reads `isIncomplete` alone — no node-type list to drift', () => {
    const raw = readFileSync(resolve(__dirname, '../BaseNode.tsx'), 'utf8')
    const code = raw
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^[^\n]*?\/\/[^\n]*$/gm, '')

    // Positive controls, both directions. The first proves the read reached the
    // file; the second proves the stripper removed comments WITHOUT removing the
    // code around them, so an absence below is the product's and not the
    // instrument's.
    expect(raw).toContain('node-corner-stack-')
    expect(code).toContain('const isIncomplete = (() => {')
    expect(code).toContain('<StatusPill')
    // Contrast control: the deleted expression IS present in the raw file (in
    // the comment recording the ruling), so a clean zero below is the stripper
    // working, not a sweep that could never have found anything.
    expect(raw).toContain("isIncomplete && (nodeType === 'factor' || nodeType === 'goal')")

    // ⭐ THE MIRROR THAT MUST NOT COME BACK. That pair is what confined the badge
    // to two of the four node types the state admits; a future edit that
    // re-introduces it beside the pill would silently leave `decision` and
    // `option` with no channel at all, exactly as they were before this ruling.
    expect(code).not.toContain(
      "isIncomplete && (nodeType === 'factor' || nodeType === 'goal')",
    )
  })
})
