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
 *     inside `node-state-row-{id}` of the node under test (it was
 *     `node-corner-stack-{id}` until gap 11, 25 Sep 2026, moved the worded
 *     state out of the corner and into the card's in-flow state row), never
 *     "some node on screen has a pill" (CLAUDE.md trap 19).
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
import { readFileSync, readdirSync } from 'node:fs'
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
import { DecisionNode, DECISION_RESTING_COPY } from '../DecisionNode'
import { STRUCTURAL_UNSET } from '../shared/metricVocabulary'

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

/** The corner stack OF THE NODE UNDER TEST — since gap 11 it holds only marks, never a pill. */
const stackOf = (id: string) => screen.getByTestId(`node-corner-stack-${id}`)
/** The state row OF THE NODE UNDER TEST — the identity every badge PRESENCE assertion binds through (gap 11). */
const stateRowOf = (id: string) => screen.getByTestId(`node-state-row-${id}`)
/** The card OF THE NODE UNDER TEST — the stack's own parent — for ABSENCE assertions that must cover the whole card. */
const cardOf = (id: string) => stackOf(id).parentElement as HTMLElement

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
function renderTargetlessGoal(over: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  const data = { label: 'Increase revenue', type: 'goal', ...extra }
  mockStore({ nodes: [{ id: GOAL_ID, type: 'goal', data }], ...over })
  return render(
    <ReactFlowProvider>
      <GoalNode {...(baseProps as any)} type="goal" id={GOAL_ID} data={data as any} />
    </ReactFlowProvider>,
  )
}

/** The option the twin cases link to this decision — a real node, because the
 *  predicate now resolves the far end's KIND and a bare edge id names nothing. */
const OPTION_NODE = { id: OPTION_ID, type: 'option', data: { label: 'Rebuild', type: 'option' } }
/** A non-option, for the mirror case: an OUTGOING edge that is not an option
 *  link. An outcome rather than a factor deliberately — a valueless factor in
 *  `nodes` would also change `DecisionNode`'s triage line, and a fixture that
 *  moves two things at once cannot say which one the assertion is about. */
const OUTCOME_NODE = { id: 'out_margin', type: 'outcome', data: { label: 'Margin', type: 'outcome' } }

/**
 * A decision with no option linked to it.
 *
 * ⚠ `otherNodes` IS NOT CONVENIENCE — it is what the repaired predicate needs.
 * The arm used to ask "is there any edge whose `source` is this node", which
 * could be satisfied by an edge pointing at an id no node in the store carries.
 * It now asks "is an OPTION linked to this node", so the far end has to be a
 * node the fixture actually seeds. A fixture that omits it is asserting the
 * dangling-edge case, not the linked-option one.
 */
function renderOptionlessDecision(edges: unknown[] = [], otherNodes: unknown[] = []) {
  const data = { label: 'Platform choice', type: 'decision' }
  mockStore({ nodes: [{ id: DECISION_ID, type: 'decision', data }, ...otherNodes], edges })
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
  it('FACTOR (controllable, no value) — badge inside THIS factor\'s body row, not its corner stack', () => {
    renderFactor({ label: 'Hiring rate', type: 'factor', category: 'controllable' })
    // Precondition pinned in-test: the assertion below is about a node in the
    // incomplete state, not about a card that renders a pill unconditionally.
    expect(screen.getByTestId('overlay-missing-value')).toBeTruthy()
    // NODE-ANATOMY v3.2 (24 Sep): a factor says "Needs input · Value not set
    // yet" as line 2 of its BODY — "not a border pill" — so the corner stack
    // withholds it (`incompleteStatedOnCard`, the goal's gap-U4 prop).
    expect(within(screen.getByTestId(`factor-needs-input-row-${FACTOR_ID}`)).getByTestId('needs-input-pill')).toBeTruthy()
    expect(within(stackOf(FACTOR_ID)).queryByTestId('needs-input-pill')).toBeNull()
  })

  it('GOAL (no success target) — badge inside THIS goal\'s corner stack', () => {
    // ⚠ CONTRACT v3.1 (gap U4, 24 Sep 2026): one state, once. With no target
    // ANYWHERE the goal card's own "Target not captured" chip states the gap and
    // the pill is withheld; the node is still incomplete.
    renderTargetlessGoal()
    expect(screen.getByTestId('overlay-missing-threshold-node')).toBeTruthy()
    expect(screen.getByTestId('goal-node-no-target-chip')).toBeTruthy()
    expect(screen.queryByTestId('needs-input-pill')).toBeNull()

    // The pill still reaches a goal whose NODE carries a target while the store
    // scalar has none (the chip is silent there) — inside THIS goal's stack.
    cleanup()
    renderTargetlessGoal({}, { goal_threshold_raw: 12, goal_threshold_unit: '%' })
    expect(screen.getByTestId('overlay-missing-threshold-node')).toBeTruthy()
    expect(within(stateRowOf(GOAL_ID)).getByTestId('needs-input-pill')).toBeTruthy()
    expect(within(stackOf(GOAL_ID)).queryByTestId('needs-input-pill')).toBeNull()

    // OPPOSITE DIRECTION, same component, same props — only the target differs.
    // Without this the case above could pass on a card that always shows a pill.
    cleanup()
    renderTargetlessGoal({ goalThreshold: { value: 12, unit: '%' } })
    expect(screen.queryByTestId('needs-input-pill')).toBeNull()
  })

  it('⭐ OPTION (assessed, no interventions) — NEWLY COVERED by the re-ruling', () => {
    renderIncompleteOption()
    expect(screen.getByTestId('overlay-missing-value')).toBeTruthy()
    expect(within(stateRowOf(OPTION_ID)).getByTestId('needs-input-pill')).toBeTruthy()
  })

  it('⭐ DECISION (no options linked) — its own pill, because its absence is a different KIND', () => {
    renderOptionlessDecision()
    expect(screen.getByTestId('overlay-missing-value')).toBeTruthy()

    /* ⭐⭐ REPAIRED, AND DELIBERATELY STRENGTHENED — this case used to assert
       `needs-input-pill` here. That assertion was TRUE and it bound to the
       wrong claim: the same testid, label and title served all four arms, so
       it would have stayed green on a decision rendering the quantitative
       sentence "Missing required input", which is false of a card whose
       options do not exist. The comment below already said these were
       different kinds; the assertion did not.

       It now binds by IDENTITY to the structural pill (trap 19) and pins the
       pooled one ABSENT in the same case — so a revert that puts "Needs input"
       back on a decision REDs here rather than passing. */
    expect(within(stateRowOf(DECISION_ID)).getByTestId('no-options-linked-pill')).toBeTruthy()
    expect(within(cardOf(DECISION_ID)).queryByTestId('needs-input-pill')).toBeNull()

    // OPPOSITE DIRECTION: give the decision an option and the badge must go.
    // A decision node's incompleteness is the ONLY one of the four that is a
    // property of the GRAPH rather than of the node's own data, so its twin is
    // worth spending a case on.
    cleanup()
    renderOptionlessDecision(
      [{ id: 'e1', source: DECISION_ID, target: OPTION_ID }],
      [OPTION_NODE],
    )
    expect(screen.queryByTestId('no-options-linked-pill')).toBeNull()
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
    expect(within(cardOf(FACTOR_ID)).queryByTestId('needs-input-pill')).toBeNull()
    // The dash — this node's real signal — is untouched by the ruling.
    // Design audit #13 (26 Sep): carried as the description, not a native title.
    expect(screen.getByRole('group')).toHaveAttribute('aria-description', 'Outside your control')
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
  /**
   * ⛔ UPDATED 24 Sep 2026 (GAP-36, DESIGN-GAP-AUDIT-20260924.md row 36;
   * contract §01): the accessible name now starts "Option: …" — the
   * user-facing kind word from `NODE_REGISTRY` — never the internal code id
   * "option node:". The property this test protects (the badge does not
   * swallow the card's own name) is unchanged.
   */
  it('the node keeps its OWN accessible name — the badge does not swallow it', () => {
    renderIncompleteOption()
    const card = screen.getByRole('group')
    // The node's identity, not its state, is what names the card.
    expect(card).toHaveAccessibleName(/^Option: Rebuild\./)
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
 *
 * ⭐ AND THEN THE MECHANISM CHANGED AGAIN — ED #63 5799353114 DECISION 1 (23 Sep
 * 2026): "Drop 'Most supported'. It reads as a recommendation." `OptionNode`,
 * the ONLY caller that ever passed `cornerSlot`, no longer passes it at all. So
 * the pair is impossible for a third, simpler reason: `cornerSlot` has NO
 * product caller. The prop is still declared and rendered by `BaseNode`, which
 * is why the pin is re-pointed rather than deleted: a new caller would re-open
 * the pairing, and it must RED here so its gate is placed deliberately.
 * ──────────────────────────────────────────────────────────────────────────── */
describe('IMPOSSIBILITY PIN — the badge and the retired "Most supported" pill cannot co-occur', () => {
  it('`cornerSlot` has NO product caller any more (ED #63 5799353114 decision 1); the badge gate is unchanged', () => {
    const nodesDir = resolve(__dirname, '..')
    /** Comments stripped, so prose that quotes the old call cannot fire the guard. */
    const codeOf = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[^\n]*?\/\/[^\n]*$/gm, '')
    const baseNode = readFileSync(resolve(nodesDir, 'BaseNode.tsx'), 'utf8')
    const metadataHook = readFileSync(
      resolve(__dirname, '../../hooks/useNodeDisplayMetadata.ts'), 'utf8')

    // THE MANIFEST — derived, not listed: every node renderer that mounts
    // `<BaseNode` (the only component that consumes `cornerSlot`). Scope: the
    // top-level renderers in `src/canvas/nodes/`; a caller elsewhere, or one
    // forwarding the prop through a spread, is outside what this proves.
    const callers = readdirSync(nodesDir)
      .filter(f => f.endsWith('.tsx') && f !== 'BaseNode.tsx')
      .map(f => ({ f, code: codeOf(readFileSync(resolve(nodesDir, f), 'utf8')) }))
      .filter(({ code }) => /<BaseNode\b/.test(code))
    // Positive control on the manifest: it reached the option renderer and
    // more than one caller, so an empty sweep cannot read as a clean one.
    expect(callers.map(c => c.f)).toContain('OptionNode.tsx')
    expect(callers.length).toBeGreaterThan(1)

    // CONTRAST CONTROL — a same-family `BaseNode` slot prop IS passed by the
    // option renderer, so the probe can see a slot prop when there is one.
    const optionCode = callers.find(c => c.f === 'OptionNode.tsx')!.code
    expect(optionCode).toMatch(/\bheaderSlot=/)
    // …and the target: no caller passes `cornerSlot`, and the option card no
    // longer builds the pill it used to put there.
    for (const { f, code } of callers) {
      expect(code, `${f} passes cornerSlot again — re-derive its gate against the StatusPill`).not.toMatch(/\bcornerSlot=/)
    }
    expect(optionCode).not.toMatch(/leading-option-pill-/)
    expect(optionCode).not.toMatch(/Most supported/)

    // The prop is still consumed, which is why a new caller would matter.
    expect(codeOf(baseNode)).toContain('{cornerSlot}')

    // The badge still mounts only before a run (unchanged half of the old pin).
    expect(baseNode).toContain('node-corner-stack-')
    expect(baseNode).toContain("const isPreRunMode = resultsStatus !== 'complete'")
    expect(metadataHook).toContain('useNodeDisplayMetadata')
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

/* ────────────────────────────────────────────────────────────────────────────
 * 5 · THE WORDS, AND THE CHANNEL THE LAST ROUND LEFT UNGUARDED
 *
 * ⚠ UNRUN AT THE TIME OF WRITING. No suite, no typecheck and no browser was
 * executed for this section — the cost constraints on the lane barred all
 * three. CI is the authority on whether it passes; it is written to be RED
 * against the code as it stood one commit ago, which is the only claim being
 * made for it here.
 *
 * ⛔ WHY LITERALS, WHEN THIS ESTATE'S STANDING RULE IS "DERIVE, DON'T MIRROR".
 * Because the two rules answer different questions (CLAUDE.md trap 12d, stated
 * in full there): a DERIVED assertion proves the surfaces AGREE with the
 * record, and can never notice that the record itself now says something else.
 * `getByText(DECISION_RESTING_COPY.noOptionsLine)` is the shape to avoid — the
 * render and the assertion read one constant, so a copy change moves both and
 * the guard stays green while the product's sentence changes under it. Every
 * literal below is therefore deliberate and hand-written, and the derived
 * assertions sit BESIDE them rather than instead of them: the literals notice
 * a copy change, the derived ones notice the two surfaces drifting apart.
 *
 * ⚠ SCOPE, same as §3: these are jsdom renders and accname computations, not a
 * screen-reader session (CLAUDE.md trap 3).
 * ──────────────────────────────────────────────────────────────────────────── */
describe('the structural absence says one sentence per channel — and the sentences are pinned', () => {
  it('⛔ COPY PIN — both members of STRUCTURAL_UNSET, as hand-written literals', () => {
    // Hand-written on purpose. Change either sentence and this REDs, which is
    // the whole job: nothing else in the tree can notice `nothingCompared`
    // changing, because nothing else spells it.
    expect(STRUCTURAL_UNSET.noOptions).toBe('No options linked yet')
    expect(STRUCTURAL_UNSET.nothingCompared).toBe('Nothing to compare yet')
    // And they are two sentences, not one aliased twice — the premise the
    // corner/body split rests on.
    expect(STRUCTURAL_UNSET.nothingCompared).not.toBe(STRUCTURAL_UNSET.noOptions)
  })

  it('⭐ THE PILL: visible text, tooltip and accessible name are ONE string — the body line is not it', () => {
    renderOptionlessDecision()
    // Precondition pinned in-test: this card IS in the structural-absence
    // state, so the assertions below are about the pill under test and not
    // about a card that renders a pill unconditionally (trap 13b).
    expect(screen.getByTestId('overlay-missing-value')).toBeTruthy()

    const pill = within(stateRowOf(DECISION_ID)).getByTestId('no-options-linked-pill')

    // LITERALS — what a user sees, what a pointer user hovers, what AT says.
    expect(pill.textContent).toBe('Nothing to compare yet')
    expect(pill.getAttribute('title')).toBe('Nothing to compare yet')
    expect(pill).toHaveAccessibleName('Nothing to compare yet')
    // DERIVED, beside the literals: the pill renders the record's member.
    expect(pill.textContent).toBe(STRUCTURAL_UNSET.nothingCompared)

    /* ⛔⛔ THE ASSERTION THIS SECTION EXISTS FOR. The shipped arm passed
       `title={STRUCTURAL_UNSET.noOptions}`, and `StatusPill` composes
       `aria-label={title ?? label}` — so the pill ANNOUNCED the body line's
       sentence verbatim while the body announced it too. `getByText` reads
       text content and is blind to `aria-label`, so the spec that certified
       the split could not see it. These three are RELATIONAL and therefore
       derived on purpose: the claim is "not the body's string", whatever that
       string becomes. */
    expect(pill.getAttribute('aria-label')).not.toBe(DECISION_RESTING_COPY.noOptionsLine)
    expect(pill.getAttribute('title')).not.toBe(DECISION_RESTING_COPY.noOptionsLine)
    expect(pill).not.toHaveAccessibleName(DECISION_RESTING_COPY.noOptionsLine)
  })

  it('⭐ THE CARD: the cause is stated ONCE in the visible channel, and it is the body that states it', () => {
    renderOptionlessDecision()
    const pill = within(stateRowOf(DECISION_ID)).getByTestId('no-options-linked-pill')
    expect(pill).toBeTruthy()

    // The body still carries the cause — LITERAL, so a copy change REDs here
    // rather than moving the assertion with it.
    const resting = screen.getByTestId('decision-node-resting-state')
    expect(resting.textContent).toContain('No options linked yet')
    expect(resting.textContent).toContain(DECISION_RESTING_COPY.noOptionsLine)

    /* …and exactly one element on the card says it OUT LOUD. Both surfaces
       render together in this fixture, which is what makes this case able to
       fail at all: put the cause back on the pill's LABEL and the count goes
       to 2.

       ⛔ STATED PRECISELY, BECAUSE THE IMPRECISE VERSION IS THE DEFECT THIS
       SECTION EXISTS FOR: `getAllByText` reads TEXT CONTENT, so this counts
       the VISIBLE channel and NOTHING ELSE. It would not move if the sentence
       came back as `aria-label` or `title` — which is precisely how the
       duplication survived the first fix. The a11y channel is pinned in the
       case above, and neither case substitutes for the other. */
    expect(screen.getAllByText('No options linked yet')).toHaveLength(1)

    // OPPOSITE DIRECTION (trap 22b): the consequence is the pill's, and the
    // body does not repeat THAT either.
    expect(resting.textContent).not.toContain('Nothing to compare yet')
  })
})

/* ────────────────────────────────────────────────────────────────────────────
 * 6 · THE SENTENCE IS BOUND TO THE FACT IT STATES
 *
 * ⚠ UNRUN AT THE TIME OF WRITING. No suite, no typecheck and no browser was
 * executed for this section — the cost constraints on the lane barred all
 * three. CI is the authority on whether it passes; it is written to be RED
 * against the code as it stood one commit ago, which is the only claim being
 * made for it here.
 *
 * ── WHAT THE LAST ROUND SHIPPED ────────────────────────────────────────────
 * §1 replaced a vague pill with a precise one — and left the predicate behind
 * it reading `edges.some(e => e.source === id)`, which answers "does this
 * decision have any OUTGOING EDGE". The pill says the decision has no OPTIONS.
 * Two facts, one predicate, and they come apart in BOTH directions:
 *
 *   FALSE CLAIM  `option → decision` is a permitted draw (`isValidConnection`
 *                applies no kind or direction rule) and is not outgoing, so the
 *                card stated "Nothing to compare yet" about a decision whose
 *                option was on the canvas. ⛔ Note the DIRECTION of that
 *                regression: the vague "Needs input" it replaced made no claim
 *                about the graph at all. A precise sentence bound to the wrong
 *                predicate is worse than a vague one bound to nothing — which
 *                is §1's own thesis, arriving back at §1.
 *   SILENT GAP   `decision → outcome` IS outgoing, so any such edge suppressed
 *                the pill on a decision that genuinely has nothing to compare.
 *
 * ── WHY BOTH CASES, AND WHY EACH PINS ITS OWN PRECONDITION ─────────────────
 * One predicate guarding two opposite harms needs a corpus pointing BOTH ways
 * (CLAUDE.md trap 22b — a corpus that tests one direction is a guard watching
 * one door, and §1's twin case pointed only at the suppressing direction). Each
 * case below asserts, in-test, that its fixture WOULD have satisfied the old
 * outgoing-edge predicate — so the verdict is provably the new predicate's
 * doing and not the fixture quietly failing to reproduce the state
 * (CLAUDE.md trap 13b).
 * ──────────────────────────────────────────────────────────────────────────── */
describe('⭐ the pill claims "no options", so it must be ABOUT options', () => {
  it('⛔ REVERSED LINK — an `option → decision` edge is an option, and the card must not deny it', () => {
    const edges = [{ id: 'e1', source: OPTION_ID, target: DECISION_ID }]

    // PRECONDITION, pinned in-test: this fixture is exactly the state the OLD
    // predicate got wrong — no edge whose `source` is the decision, and an
    // option node genuinely joined to it. Without this, a green result could
    // come from a fixture that linked nothing.
    expect(edges.some(e => e.source === DECISION_ID)).toBe(false)
    expect(edges.some(e => e.source === OPTION_ID && e.target === DECISION_ID)).toBe(true)
    expect(OPTION_NODE.type).toBe('option')

    renderOptionlessDecision(edges, [OPTION_NODE])

    // The claim under test: no structural pill, because there IS something to
    // compare. Bound by identity to THIS decision's card (trap 19) — the whole
    // card, since the pill left the corner stack for the state row (gap 11).
    expect(within(cardOf(DECISION_ID)).queryByTestId('no-options-linked-pill')).toBeNull()
    // And not re-pooled into the quantitative one on the way out.
    expect(within(cardOf(DECISION_ID)).queryByTestId('needs-input-pill')).toBeNull()
    // The sentence itself, as a literal — so a testid rename cannot hide it.
    expect(screen.queryByText('Nothing to compare yet')).toBeNull()
  })

  it('⛔ MIRROR — an outgoing edge to a NON-option leaves the gap open, so the pill must still fire', () => {
    const edges = [{ id: 'e1', source: DECISION_ID, target: OUTCOME_NODE.id }]

    // PRECONDITION: the old predicate was SATISFIED by this fixture (there is an
    // outgoing edge), which is why it suppressed the pill — and no option is
    // linked in either direction, so the pill's sentence is true here.
    expect(edges.some(e => e.source === DECISION_ID)).toBe(true)
    expect(OUTCOME_NODE.type).not.toBe('option')

    renderOptionlessDecision(edges, [OUTCOME_NODE])

    expect(within(stateRowOf(DECISION_ID)).getByTestId('no-options-linked-pill')).toBeTruthy()
    expect(within(cardOf(DECISION_ID)).queryByTestId('needs-input-pill')).toBeNull()
    expect(screen.getByText('Nothing to compare yet')).toBeTruthy()
  })

  it('⛔ DANGLING — an edge to an id no node carries names no option, so the pill still fires', () => {
    // The state the old predicate treated as "has options": an outgoing edge
    // whose far end is not in `nodes` at all. An id is not an option.
    renderOptionlessDecision([{ id: 'e1', source: DECISION_ID, target: 'ghost_node' }], [])
    expect(within(stateRowOf(DECISION_ID)).getByTestId('no-options-linked-pill')).toBeTruthy()
  })
})
